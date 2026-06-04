import { isToday, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { listCourses } from "@/lib/repositories/courseRepository";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import type { DashboardSummary } from "@/lib/types/domain";

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const [assignments, courses] = await Promise.all([
    listAssignments(userId, { sortBy: "due" }),
    listCourses(userId)
  ]);

  const incomplete = assignments.filter((assignment) => assignment.status !== "done");
  const todayStart = startOfDay(new Date());

  const dueToday = incomplete.filter((assignment) => isToday(parseISO(assignment.dueAt)));
  const overdue = incomplete.filter((assignment) => parseISO(assignment.dueAt).getTime() < Date.now());

  const coursesSummary = courses.map((course) => {
    const linked = assignments.filter((assignment) => assignment.courseId === course.id);
    return {
      course,
      incompleteCount: linked.filter((assignment) => assignment.status !== "done").length,
      doneCount: linked.filter((assignment) => assignment.status === "done").length
    };
  });

  return {
    totalIncomplete: incomplete.length,
    dueTodayCount: dueToday.length,
    overdueCount: overdue.length,
    highPriorityCount: incomplete.filter((assignment) => assignment.priorityLabel === "high").length,
    heavyCount: incomplete.filter((assignment) => assignment.isHeavy).length,
    todayItems: incomplete
      .filter((assignment) => {
        const due = parseISO(assignment.dueAt);
        return isWithinInterval(due, {
          start: todayStart,
          end: new Date(todayStart.getTime() + 24 * 3600 * 1000 - 1)
        });
      })
      .slice(0, 8),
    upcoming: incomplete.slice(0, 8),
    courses: coursesSummary
  };
}
