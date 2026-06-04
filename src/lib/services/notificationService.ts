import { subDays, setHours, setMinutes } from "date-fns";
import { getAssignmentById } from "@/lib/repositories/assignmentRepository";
import {
  enqueueNotification,
  listDueNotifications,
  requeueFailedNotifications,
  markNotificationFailed,
  markNotificationSent
} from "@/lib/repositories/notificationRepository";
import { listPushSubscriptions } from "@/lib/repositories/settingsRepository";
import { getUserEmailById } from "@/lib/repositories/userRepository";
import { resolveNotificationEmailRecipients, sendEmailNotification } from "@/lib/notifications/email";
import { sendWebPushNotification } from "@/lib/notifications/push";

function buildNotifyMoments(dueAt: string) {
  const due = new Date(dueAt);
  return {
    oneWeek: subDays(due, 7),
    threeDays: subDays(due, 3),
    oneDay: subDays(due, 1),
    sameDayMorning: setMinutes(setHours(due, 8), 0)
  };
}

export async function scheduleAssignmentNotifications(params: {
  userId: string;
  assignmentId: string;
  dueAt: string;
  emailEnabled: boolean;
  webPushEnabled: boolean;
  timing: {
    oneWeek: boolean;
    threeDays: boolean;
    oneDay: boolean;
    sameDayMorning: boolean;
  };
}) {
  const moments = buildNotifyMoments(params.dueAt);

  const toEnqueue: string[] = [];
  if (params.timing.oneWeek) toEnqueue.push(moments.oneWeek.toISOString());
  if (params.timing.threeDays) toEnqueue.push(moments.threeDays.toISOString());
  if (params.timing.oneDay) toEnqueue.push(moments.oneDay.toISOString());
  if (params.timing.sameDayMorning) toEnqueue.push(moments.sameDayMorning.toISOString());

  const jobs: Promise<void>[] = [];

  if (params.emailEnabled) {
    toEnqueue.forEach((notifyAt) => {
      jobs.push(
        enqueueNotification({
          userId: params.userId,
          assignmentId: params.assignmentId,
          channel: "email",
          notifyAt
        })
      );
    });
  }

  if (params.webPushEnabled) {
    toEnqueue.forEach((notifyAt) => {
      jobs.push(
        enqueueNotification({
          userId: params.userId,
          assignmentId: params.assignmentId,
          channel: "web_push",
          notifyAt
        })
      );
    });
  }

  await Promise.all(jobs);
}

export async function dispatchDueNotifications(
  limit = 20,
  options?: {
    retryFailed?: boolean;
    retryFailedLimit?: number;
    userId?: string;
  }
) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const retryFailedLimit = Math.min(Math.max(Math.trunc(options?.retryFailedLimit ?? safeLimit), 1), 200);
  const useSystemAccess = !options?.userId;
  const requeued =
    options?.retryFailed && options.userId
      ? await requeueFailedNotifications(options.userId, retryFailedLimit)
      : 0;
  const jobs = await listDueNotifications(new Date().toISOString(), safeLimit, options?.userId, {
    useAdmin: useSystemAccess
  });
  const userEmailCache = new Map<string, string | null>();
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const assignment = await getAssignmentById(job.userId, job.assignmentId, {
        useAdmin: useSystemAccess
      });
      if (!assignment) {
        await markNotificationFailed(job.id, "Assignment not found", { useAdmin: useSystemAccess });
        failed += 1;
        continue;
      }

      if (job.channel === "email") {
        const resolvedEmail = userEmailCache.has(job.userId)
          ? userEmailCache.get(job.userId) ?? null
          : await getUserEmailById(job.userId);

        if (!userEmailCache.has(job.userId)) {
          userEmailCache.set(job.userId, resolvedEmail);
        }

        const recipients = resolveNotificationEmailRecipients(resolvedEmail);

        if (recipients.length === 0) {
          await markNotificationFailed(job.id, "Recipient email not found", { useAdmin: useSystemAccess });
          failed += 1;
          continue;
        }

        const res = await sendEmailNotification({
          to: recipients,
          subject: `課題締切: ${assignment.title}`,
          body: `${assignment.title} の締切は ${assignment.dueAt} です。`
        });

        if (!res.ok) {
          await markNotificationFailed(job.id, res.reason ?? "Email provider failed", { useAdmin: useSystemAccess });
          failed += 1;
          continue;
        }
      } else if (job.channel === "web_push") {
        const subscriptions = await listPushSubscriptions(job.userId, { useAdmin: useSystemAccess });

        if (subscriptions.length === 0) {
          await markNotificationFailed(job.id, "No push subscription", { useAdmin: useSystemAccess });
          failed += 1;
          continue;
        }

        let pushOk = false;
        for (const subscription of subscriptions) {
          const response = await sendWebPushNotification(subscription, {
            title: "課題リマインド",
            body: `${assignment.title} の締切が近づいています`,
            url: `/assignments/${assignment.id}`
          });

          if (response.ok) {
            pushOk = true;
          }
        }

        if (!pushOk) {
          await markNotificationFailed(job.id, "Push send failed", { useAdmin: useSystemAccess });
          failed += 1;
          continue;
        }
      }

      await markNotificationSent(job.id, { useAdmin: useSystemAccess });
      sent += 1;
    } catch (error) {
      await markNotificationFailed(job.id, error instanceof Error ? error.message : "Unknown notification error", {
        useAdmin: useSystemAccess
      });
      failed += 1;
    }
  }

  return {
    total: jobs.length,
    sent,
    failed,
    requeued,
    processedLimit: safeLimit
  };
}

export async function dispatchDueNotificationsUntilEmpty(options?: {
  batchLimit?: number;
  maxRounds?: number;
  retryFailed?: boolean;
  retryFailedLimit?: number;
  userId?: string;
}) {
  const batchLimit = Math.min(Math.max(options?.batchLimit ?? 100, 1), 200);
  const maxRounds = Math.min(Math.max(options?.maxRounds ?? 10, 1), 100);

  let rounds = 0;
  let processed = 0;
  let sent = 0;
  let failed = 0;
  let requeued = 0;
  let drained = false;

  while (rounds < maxRounds) {
    rounds += 1;
    const result = await dispatchDueNotifications(batchLimit, {
      retryFailed: rounds === 1 ? options?.retryFailed : false,
      retryFailedLimit: options?.retryFailedLimit,
      userId: options?.userId
    });
    processed += result.total;
    sent += result.sent;
    failed += result.failed;
    requeued += result.requeued;

    if (result.total < batchLimit) {
      drained = true;
      break;
    }
  }

  return {
    processed,
    sent,
    failed,
    requeued,
    rounds,
    drained,
    batchLimit,
    maxRounds
  };
}
