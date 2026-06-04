import { getUserSettings } from "@/lib/repositories/settingsRepository";
import {
  getAssignmentById,
  replaceSubtasks,
  restoreSoftDeletedAssignment,
  softDeleteAssignment,
  upsertAssignment
} from "@/lib/repositories/assignmentRepository";
import { listCourses, upsertCourse } from "@/lib/repositories/courseRepository";
import { createAiExtractionLog } from "@/lib/repositories/aiLogRepository";
import { calculatePriorityScore } from "@/lib/services/priorityService";
import { scheduleAssignmentNotifications } from "@/lib/services/notificationService";
import { queueAndTryAssignmentCalendarSync } from "@/lib/services/calendarSyncQueueService";
import { createAssignmentStepsFromTitles } from "@/lib/services/assignmentStepTemplateService";
import { regenerateTodayStudyPlan } from "@/lib/services/studyBlockPlanningService";
import { normalizeDueAtYearForSource } from "@/lib/ai/dueDateYearNormalizer";
import type { AiExtractionCandidate, Assignment, AssignmentUpsertInput, Course, UserSettings } from "@/lib/types/domain";

async function resolveCourseIdByName(
  userId: string,
  courseName?: string | null,
  courseIdCache?: Map<string, string | null>,
  coursesSnapshot?: Course[]
): Promise<string | null> {
  if (!courseName) {
    return null;
  }

  const cacheKey = courseName.trim().toLowerCase();
  if (courseIdCache?.has(cacheKey)) {
    return courseIdCache.get(cacheKey) ?? null;
  }

  const courses = coursesSnapshot ?? await listCourses(userId);
  const existing = courses.find((course) => course.name.toLowerCase() === courseName.toLowerCase());
  if (existing) {
    courseIdCache?.set(cacheKey, existing.id);
    return existing.id;
  }

  // TODO: Course auto-create can be toggled in user settings in future.
  const created = await upsertCourse({
    userId,
    name: courseName,
    dayOfWeek: "Mon",
    startTime: "09:00",
    endTime: "10:30",
    room: null,
    instructor: null,
    color: "#38bdf8",
    memo: "AI入力から自動作成された授業"
  });

  courseIdCache?.set(cacheKey, created.id);
  if (coursesSnapshot) {
    coursesSnapshot.push(created);
  }
  return created.id;
}

type SaveIntegrationsContext = {
  courses?: Course[];
  settings?: UserSettings;
};

export async function saveAssignmentWithIntegrations(
  input: AssignmentUpsertInput,
  context?: SaveIntegrationsContext,
  options?: {
    refreshStudyPlan?: boolean;
    deferIntegrations?: boolean;
  }
): Promise<{
  assignment: Assignment;
  integration: {
    calendarQueued: boolean;
    calendarSynced: boolean;
    calendarError: string | null;
    notificationScheduled: boolean;
    notificationError: string | null;
  };
}> {
  const settings = context?.settings ?? await getUserSettings(input.userId);
  const courses = context?.courses ?? await listCourses(input.userId);
  const matchedCourse = courses.find((item) => item.id === input.courseId);

  const priority = calculatePriorityScore(
    {
      dueAt: input.dueAt,
      assignmentType: input.assignmentType,
      isHeavy: input.isHeavy ?? false,
      estimatedHours: input.estimatedHours ?? 1,
      progress: input.progress ?? 0,
      courseName: matchedCourse?.name,
      title: input.title
    },
    settings
  );

  const assignment = await upsertAssignment({
    ...input,
    priorityLabel: input.priorityLabel ?? priority.label,
    priorityScore: priority.score
  });

  if (input.suggestedSubtasks) {
    await replaceSubtasks(input.userId, assignment.id, input.suggestedSubtasks);

    void createAssignmentStepsFromTitles({
        userId: input.userId,
        assignmentId: assignment.id,
        titles: input.suggestedSubtasks
      }).catch((error) => {
        console.error("Assignment step creation failed", error);
      });
  }

  let calendarSynced = false;
  let calendarError: string | null = null;
  let calendarQueued = false;
  const calendarSyncEnabled = settings.googleCalendarEnabled === true;

  let notificationScheduled = false;
  let notificationError: string | null = null;

  if (options?.deferIntegrations) {
    calendarQueued = calendarSyncEnabled;
    calendarSynced = false;
    calendarError = null;
    notificationScheduled = true;
    notificationError = null;

    // 非同期連携は待たずに実行し、課題保存の体感速度を優先する。
    void (async () => {
      const [calendarResult, notificationResult] = await Promise.allSettled([
        calendarSyncEnabled
          ? queueAndTryAssignmentCalendarSync({
            userId: input.userId,
            assignment,
            operation: "create_or_update"
          })
          : Promise.resolve(null),
        scheduleAssignmentNotifications({
          userId: input.userId,
          assignmentId: assignment.id,
          dueAt: assignment.dueAt,
          emailEnabled: settings.notificationConfig.email,
          webPushEnabled: settings.notificationConfig.webPush,
          timing: {
            oneWeek: settings.notificationConfig.oneWeek,
            threeDays: settings.notificationConfig.threeDays,
            oneDay: settings.notificationConfig.oneDay,
            sameDayMorning: settings.notificationConfig.sameDayMorning
          }
        })
      ]);

      if (calendarSyncEnabled && calendarResult.status === "rejected") {
        console.error("Deferred calendar sync failed", calendarResult.reason);
      }

      if (notificationResult.status === "rejected") {
        console.error("Deferred notification scheduling failed", notificationResult.reason);
      }
    })();
  } else {
    const calendarPromise = calendarSyncEnabled
      ? queueAndTryAssignmentCalendarSync({
        userId: input.userId,
        assignment,
        operation: "create_or_update"
      })
      : Promise.resolve({
        queued: false,
        synced: false,
        error: null as string | null
      });

    const [calendarResult, notificationResult] = await Promise.allSettled([
      calendarPromise,
      scheduleAssignmentNotifications({
        userId: input.userId,
        assignmentId: assignment.id,
        dueAt: assignment.dueAt,
        emailEnabled: settings.notificationConfig.email,
        webPushEnabled: settings.notificationConfig.webPush,
        timing: {
          oneWeek: settings.notificationConfig.oneWeek,
          threeDays: settings.notificationConfig.threeDays,
          oneDay: settings.notificationConfig.oneDay,
          sameDayMorning: settings.notificationConfig.sameDayMorning
        }
      })
    ]);

    if (!calendarSyncEnabled) {
      calendarQueued = false;
      calendarSynced = false;
      calendarError = null;
    } else if (calendarResult.status === "fulfilled") {
      calendarQueued = calendarResult.value.queued;
      calendarSynced = calendarResult.value.synced;
      calendarError = calendarResult.value.error ?? null;
    } else {
      calendarQueued = false;
      calendarSynced = false;
      calendarError =
        calendarResult.reason instanceof Error
          ? calendarResult.reason.message
          : "Unknown calendar sync error";
    }

    if (notificationResult.status === "fulfilled") {
      notificationScheduled = true;
    } else {
      notificationScheduled = false;
      notificationError =
        notificationResult.reason instanceof Error
          ? notificationResult.reason.message
          : "Unknown notification error";
    }
  }

  const shouldRefreshStudyPlan = options?.refreshStudyPlan ?? true;
  if (shouldRefreshStudyPlan) {
    // Study-plan refresh is intentionally best effort. Assignment save must remain the source of truth.
    void regenerateTodayStudyPlan(input.userId).catch((error) => {
      console.error("Study plan refresh failed", error);
    });
  }

  return {
    assignment,
    integration: {
      calendarQueued,
      calendarSynced,
      calendarError,
      notificationScheduled,
      notificationError
    }
  };
}

export async function saveAssignmentsFromAiCandidates(params: {
  userId: string;
  sourceText: string;
  sourceType: "chat" | "pdf" | "image";
  candidates: AiExtractionCandidate[];
}) {
  const saved: Assignment[] = [];
  const savedCandidateIndexes: number[] = [];
  const skippedCandidateIndexes: number[] = [];
  const failed: Array<{ index: number; reason: string; title: string }> = [];
  let skippedDueCount = 0;
  const courseIdCache = new Map<string, string | null>();
  const sharedSettings = await getUserSettings(params.userId);
  const sharedCourses = await listCourses(params.userId);

  for (const [index, candidate] of params.candidates.entries()) {
    const normalizedDueAt = normalizeDueAtYearForSource(candidate.dueAt, params.sourceText);

    if (!normalizedDueAt) {
      // Due date is required for assignment creation. The preview stays editable, so skip only this candidate.
      skippedDueCount += 1;
      skippedCandidateIndexes.push(index);
      continue;
    }

    const parsedDueAt = new Date(normalizedDueAt);
    if (Number.isNaN(parsedDueAt.getTime())) {
      failed.push({
        index,
        title: candidate.title,
        reason: "締切日時を読み取れませんでした。"
      });
      continue;
    }

    try {
      const courseId = await resolveCourseIdByName(
        params.userId,
        candidate.courseName,
        courseIdCache,
        sharedCourses
      );

      const { assignment } = await saveAssignmentWithIntegrations(
        {
          userId: params.userId,
          courseId,
          title: candidate.title,
          dueAt: parsedDueAt.toISOString(),
          submissionTarget: candidate.submissionTarget,
          assignmentType: candidate.assignmentType,
          memo: candidate.memo,
          priorityLabel: candidate.priorityLabel,
          progress: 0,
          status: "todo",
          estimatedHours: candidate.estimatedHours,
          aiSourceText: params.sourceText,
          aiConfidence: candidate.confidence,
          isHeavy: candidate.isHeavy,
          tags: candidate.tags,
          suggestedSubtasks: candidate.suggestedSubtasks
        },
        {
          settings: sharedSettings,
          courses: sharedCourses
        },
        {
          refreshStudyPlan: false,
          deferIntegrations: true
        }
      );

      saved.push(assignment);
      savedCandidateIndexes.push(index);
    } catch (error) {
      console.error("AI candidate assignment save failed", error);
      failed.push({
        index,
        title: candidate.title,
        reason: "課題化に失敗しました。入力内容は画面に残っています。"
      });
    }
  }

  const confidenceAvg =
    params.candidates.length > 0
      ? params.candidates.reduce((sum, candidate) => sum + candidate.confidence, 0) / params.candidates.length
      : null;

  try {
    await createAiExtractionLog({
      userId: params.userId,
      sourceType: params.sourceType,
      sourceText: params.sourceText,
      extractedJson: params.candidates,
      confidenceAvg
    });
  } catch (error) {
    console.error("AI extraction log failed after assignment save", error);
  }

  if (saved.length > 0) {
    // Bulk保存時は最後に1回だけ再計算して体感待ち時間を短くする。
    void regenerateTodayStudyPlan(params.userId).catch((error) => {
      console.error("Study plan refresh failed after AI bulk save", error);
    });
  }

  return {
    failed,
    saved,
    savedCandidateIndexes,
    skippedCandidateIndexes,
    skippedDueCount
  };
}

export async function deleteAssignmentWithCalendarSync(userId: string, assignmentId: string) {
  const assignment = await getAssignmentById(userId, assignmentId);

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  const settings = await getUserSettings(userId);

  await softDeleteAssignment(userId, assignmentId);

  if (!settings.googleCalendarEnabled) {
    return;
  }

  // 削除同期は失敗しても課題本体の削除を巻き戻さない。
  try {
    await queueAndTryAssignmentCalendarSync({
      userId,
      assignment,
      operation: "delete"
    });
  } catch (error) {
    console.error("Calendar delete sync failed", error);
  }
}

export async function restoreAssignmentWithCalendarSync(userId: string, assignmentId: string) {
  const assignment = await restoreSoftDeletedAssignment(userId, assignmentId);

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  const settings = await getUserSettings(userId);
  if (!settings.googleCalendarEnabled) {
    return assignment;
  }

  // 復元後のGoogle同期もbest effort。復元本体を失敗させない。
  try {
    await queueAndTryAssignmentCalendarSync({
      userId,
      assignment,
      operation: "create_or_update"
    });
  } catch (error) {
    console.error("Calendar restore sync failed", error);
  }

  return assignment;
}
