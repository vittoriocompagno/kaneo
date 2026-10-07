import { and, asc, count, eq, inArray, isNull, sum } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable, timeEntryTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import {
  EMPTY_METRICS_INPUT,
  type MetricsInput,
  sumMetricsInputs,
  toProjectMetrics,
} from "../project-metrics";
import {
  doneTaskCount,
  dueSoonTaskCount,
  nextOpenDueDate,
  overdueTaskCount,
} from "../task-metrics";
import getProject from "./get-project";

async function loadMetricsInputs(projectIds: string[]) {
  const [taskRows, timeRows] = await Promise.all([
    db
      .select({
        projectId: taskTable.projectId,
        totalTasks: count(),
        doneTasks: doneTaskCount,
        overdueTasks: overdueTaskCount,
        dueSoonTasks: dueSoonTaskCount,
        nextDueDate: nextOpenDueDate,
      })
      .from(taskTable)
      .where(inArray(taskTable.projectId, projectIds))
      .groupBy(taskTable.projectId),
    // time_entry.duration is whole seconds and stays null until the timer
    // stops, so a running timer adds nothing yet.
    db
      .select({
        projectId: taskTable.projectId,
        seconds: sum(timeEntryTable.duration),
      })
      .from(timeEntryTable)
      .innerJoin(taskTable, eq(timeEntryTable.taskId, taskTable.id))
      .where(inArray(taskTable.projectId, projectIds))
      .groupBy(taskTable.projectId),
  ]);

  const byProject = new Map<string, MetricsInput>();
  for (const row of taskRows) {
    byProject.set(row.projectId, {
      totalTasks: Number(row.totalTasks),
      doneTasks: Number(row.doneTasks),
      overdueTasks: Number(row.overdueTasks),
      dueSoonTasks: Number(row.dueSoonTasks),
      nextDueDate: row.nextDueDate ?? null,
      trackedSeconds: 0,
    });
  }
  for (const row of timeRows) {
    const current = byProject.get(row.projectId) ?? EMPTY_METRICS_INPUT;
    byProject.set(row.projectId, {
      ...current,
      trackedSeconds: Number(row.seconds ?? 0),
    });
  }
  return byProject;
}

// Numbers cover only projects the caller can open: a restricted member's
// totals must not include hours or tasks from subprojects they were not
// granted, so for them a parent's aggregate can be smaller than the truth.
async function getProjectDashboard(
  id: string,
  workspaceId: string,
  userId: string,
) {
  const project = await getProject(id, workspaceId);

  const [children, [parent]] = await Promise.all([
    db
      .select({
        id: projectTable.id,
        name: projectTable.name,
        slug: projectTable.slug,
        icon: projectTable.icon,
        status: projectTable.status,
      })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.parentProjectId, id),
          eq(projectTable.workspaceId, workspaceId),
          eq(projectTable.isTemplate, false),
          isNull(projectTable.archivedAt),
          projectAccessCondition(userId, projectTable.id),
        ),
      )
      .orderBy(
        asc(projectTable.position),
        asc(projectTable.createdAt),
        asc(projectTable.id),
      ),
    project.parentProjectId
      ? db
          .select({
            id: projectTable.id,
            name: projectTable.name,
            icon: projectTable.icon,
          })
          .from(projectTable)
          .where(
            and(
              eq(projectTable.id, project.parentProjectId),
              eq(projectTable.workspaceId, workspaceId),
              projectAccessCondition(userId, projectTable.id),
            ),
          )
      : Promise.resolve([]),
  ]);

  const inputs = await loadMetricsInputs([
    id,
    ...children.map((child) => child.id),
  ]);
  const inputFor = (projectId: string) =>
    inputs.get(projectId) ?? EMPTY_METRICS_INPUT;

  const ownInput = inputFor(id);
  return {
    project,
    parent: parent ?? null,
    own: toProjectMetrics(ownInput),
    summary: toProjectMetrics(
      sumMetricsInputs([
        ownInput,
        ...children.map((child) => inputFor(child.id)),
      ]),
    ),
    subprojects: children.map((child) => ({
      ...child,
      metrics: toProjectMetrics(inputFor(child.id)),
    })),
  };
}

export default getProjectDashboard;
