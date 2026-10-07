import { computeProjectHealth, type ProjectHealth } from "./project-health";

export type ProjectMetrics = {
  totalTasks: number;
  doneTasks: number;
  remainingTasks: number;
  progress: number;
  overdueTasks: number;
  dueSoonTasks: number;
  nextDueDate: Date | null;
  trackedSeconds: number;
  health: ProjectHealth;
};

export type MetricsInput = Pick<
  ProjectMetrics,
  | "totalTasks"
  | "doneTasks"
  | "overdueTasks"
  | "dueSoonTasks"
  | "nextDueDate"
  | "trackedSeconds"
>;

export const EMPTY_METRICS_INPUT: MetricsInput = {
  totalTasks: 0,
  doneTasks: 0,
  overdueTasks: 0,
  dueSoonTasks: 0,
  nextDueDate: null,
  trackedSeconds: 0,
};

export function toProjectMetrics(input: MetricsInput): ProjectMetrics {
  const { totalTasks, doneTasks } = input;
  return {
    ...input,
    remainingTasks: Math.max(0, totalTasks - doneTasks),
    progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    health: computeProjectHealth(input),
  };
}

// Sums raw counts before deriving percentages and health: averaging the
// children's percentages would weight a 2-task subproject like a 200-task one.
export function sumMetricsInputs(inputs: MetricsInput[]): MetricsInput {
  return inputs.reduce<MetricsInput>(
    (sum, item) => ({
      totalTasks: sum.totalTasks + item.totalTasks,
      doneTasks: sum.doneTasks + item.doneTasks,
      overdueTasks: sum.overdueTasks + item.overdueTasks,
      dueSoonTasks: sum.dueSoonTasks + item.dueSoonTasks,
      trackedSeconds: sum.trackedSeconds + item.trackedSeconds,
      nextDueDate:
        sum.nextDueDate && item.nextDueDate
          ? sum.nextDueDate < item.nextDueDate
            ? sum.nextDueDate
            : item.nextDueDate
          : (sum.nextDueDate ?? item.nextDueDate),
    }),
    EMPTY_METRICS_INPUT,
  );
}
