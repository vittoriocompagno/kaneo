// Computed, read-only indicator. It never writes to the project's manual
// status: a project can be "chiuso" and still report late work.
export const PROJECT_HEALTH = [
  "not_started",
  "on_track",
  "at_risk",
  "late",
  "complete",
] as const;

export type ProjectHealth = (typeof PROJECT_HEALTH)[number];

export type HealthInput = {
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
};

// A quarter of the open work past due is no longer a slip, it is lateness.
const LATE_OVERDUE_SHARE = 0.25;
// Work due within a week with less than half the project done is a warning.
const AT_RISK_PROGRESS = 50;

export function computeProjectHealth(input: HealthInput): ProjectHealth {
  const { totalTasks, doneTasks, overdueTasks, dueSoonTasks } = input;
  if (totalTasks === 0) return "not_started";

  const remaining = totalTasks - doneTasks;
  if (remaining <= 0) return "complete";

  if (overdueTasks > 0 && overdueTasks / remaining >= LATE_OVERDUE_SHARE) {
    return "late";
  }
  if (overdueTasks > 0) return "at_risk";

  const progress = (doneTasks / totalTasks) * 100;
  if (dueSoonTasks > 0 && progress < AT_RISK_PROGRESS) return "at_risk";

  return "on_track";
}
