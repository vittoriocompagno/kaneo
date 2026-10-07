import { describe, expect, it } from "vite-plus/test";
import { computeProjectHealth } from "../../../apps/api/src/project/project-health";
import {
  EMPTY_METRICS_INPUT,
  sumMetricsInputs,
  toProjectMetrics,
} from "../../../apps/api/src/project/project-metrics";

const base = {
  totalTasks: 10,
  doneTasks: 5,
  overdueTasks: 0,
  dueSoonTasks: 0,
};

describe("computeProjectHealth", () => {
  it("is not_started without tasks", () => {
    expect(computeProjectHealth({ ...base, totalTasks: 0, doneTasks: 0 })).toBe(
      "not_started",
    );
  });

  it("is complete when nothing is open, even with stale overdue counts", () => {
    expect(
      computeProjectHealth({ ...base, doneTasks: 10, overdueTasks: 3 }),
    ).toBe("complete");
  });

  it("is on_track with no overdue and nothing urgent", () => {
    expect(computeProjectHealth(base)).toBe("on_track");
  });

  it("is at_risk when a few tasks are overdue", () => {
    expect(computeProjectHealth({ ...base, overdueTasks: 1 })).toBe("at_risk");
  });

  it("is late once a quarter of the open tasks are overdue", () => {
    // 5 open tasks: 1 overdue is 20%, 2 overdue is 40%
    expect(computeProjectHealth({ ...base, overdueTasks: 1 })).toBe("at_risk");
    expect(computeProjectHealth({ ...base, overdueTasks: 2 })).toBe("late");
  });

  it("flags work due within a week only while under half done", () => {
    expect(
      computeProjectHealth({ ...base, doneTasks: 4, dueSoonTasks: 2 }),
    ).toBe("at_risk");
    expect(
      computeProjectHealth({ ...base, doneTasks: 5, dueSoonTasks: 2 }),
    ).toBe("on_track");
  });
});

describe("project metrics", () => {
  it("derives remaining and rounded progress", () => {
    expect(
      toProjectMetrics({
        ...EMPTY_METRICS_INPUT,
        totalTasks: 3,
        doneTasks: 1,
      }),
    ).toMatchObject({ remainingTasks: 2, progress: 33, health: "on_track" });
    expect(toProjectMetrics(EMPTY_METRICS_INPUT)).toMatchObject({
      progress: 0,
      remainingTasks: 0,
      health: "not_started",
    });
  });

  it("sums raw counts so a big subproject outweighs a small one", () => {
    const early = new Date("2026-10-01T00:00:00Z");
    const late = new Date("2026-11-01T00:00:00Z");
    const sum = sumMetricsInputs([
      {
        totalTasks: 200,
        doneTasks: 20,
        overdueTasks: 1,
        dueSoonTasks: 0,
        trackedSeconds: 60,
        nextDueDate: late,
      },
      {
        totalTasks: 2,
        doneTasks: 2,
        overdueTasks: 0,
        dueSoonTasks: 1,
        trackedSeconds: 40,
        nextDueDate: early,
      },
      EMPTY_METRICS_INPUT,
    ]);
    expect(sum).toEqual({
      totalTasks: 202,
      doneTasks: 22,
      overdueTasks: 1,
      dueSoonTasks: 1,
      trackedSeconds: 100,
      nextDueDate: early,
    });
    expect(toProjectMetrics(sum).progress).toBe(11);
  });
});
