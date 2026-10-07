import { and, count, eq, isNull, min } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { computeProjectHealth, type ProjectHealth } from "../project-health";
import {
  doneTaskCount,
  dueSoonTaskCount,
  overdueTaskCount,
} from "../task-metrics";

type ProjectStatistics = {
  completionPercentage: number;
  totalTasks: number;
  dueDate: Date | null;
  overdueTasks: number;
  health: ProjectHealth;
};

const EMPTY_STATISTICS: ProjectStatistics = {
  completionPercentage: 0,
  totalTasks: 0,
  dueDate: null,
  overdueTasks: 0,
  health: "not_started",
};

async function getProjectStatistics(
  workspaceId: string,
  userId: string,
  includeArchived: boolean,
) {
  const statisticsByProject = new Map<string, ProjectStatistics>();

  // Aggregate in the database instead of loading every task row into memory.
  // This endpoint needs three numbers per project; the previous
  // `with: { tasks: true }` made both the query and the response grow linearly
  // with the number of tasks in the workspace. Scoping by workspaceId through
  // a join (rather than an `IN (...projectIds)` list) keeps the statement size
  // constant regardless of how many projects the workspace has.
  const rows = await db
    .select({
      projectId: taskTable.projectId,
      totalTasks: count(),
      completedTasks: doneTaskCount,
      overdueTasks: overdueTaskCount,
      dueSoonTasks: dueSoonTaskCount,
      dueDate: min(taskTable.dueDate),
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      includeArchived
        ? and(
            eq(projectTable.workspaceId, workspaceId),
            eq(projectTable.isTemplate, false),
          )
        : and(
            eq(projectTable.workspaceId, workspaceId),
            eq(projectTable.isTemplate, false),
            isNull(projectTable.archivedAt),
          ),
    )
    .groupBy(taskTable.projectId)
    .having(projectAccessCondition(userId, taskTable.projectId));

  for (const row of rows) {
    const totalTasks = Number(row.totalTasks);
    const completedTasks = Number(row.completedTasks);

    const overdueTasks = Number(row.overdueTasks);

    statisticsByProject.set(row.projectId, {
      totalTasks,
      completionPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      dueDate: row.dueDate ?? null,
      overdueTasks,
      health: computeProjectHealth({
        totalTasks,
        doneTasks: completedTasks,
        overdueTasks,
        dueSoonTasks: Number(row.dueSoonTasks),
      }),
    });
  }

  return statisticsByProject;
}

async function getProjects(
  workspaceId: string,
  userId: string,
  includeArchived = false,
) {
  const projects = await db.query.projectTable.findMany({
    where: and(
      eq(projectTable.workspaceId, workspaceId),
      eq(projectTable.isTemplate, false),
      includeArchived ? undefined : isNull(projectTable.archivedAt),
      projectAccessCondition(userId, projectTable.id),
    ),
    // `id` is the deterministic tie-breaker: without it, rows sharing both a
    // position and a createdAt come back in an unspecified order.
    orderBy: (project, { asc }) => [
      asc(project.position),
      asc(project.createdAt),
      asc(project.id),
    ],
  });

  const statisticsByProject = await getProjectStatistics(
    workspaceId,
    userId,
    includeArchived,
  );

  return projects.map((project) => ({
    ...project,
    statistics: statisticsByProject.get(project.id) ?? EMPTY_STATISTICS,
    archivedTasks: [],
    plannedTasks: [],
    columns: [],
  }));
}

export default getProjects;
