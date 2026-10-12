import { describe, expect, it } from "vite-plus/test";
import {
  doneMovesForStatus,
  doneMovesFromReorder,
  isFinalStatus,
  isMoveToDone,
} from "./done-hours";

const columns = [
  { id: "to-do", slug: "to-do", isFinal: false },
  { id: "in-progress", slug: "in-progress", isFinal: false },
  { id: "done", slug: "done", isFinal: true },
  { id: "shipped", slug: "shipped", isFinal: true },
];

describe("isFinalStatus", () => {
  it("matches by slug or id and ignores unknown statuses", () => {
    expect(isFinalStatus(columns, "done")).toBe(true);
    expect(isFinalStatus(columns, "to-do")).toBe(false);
    expect(isFinalStatus(columns, "archived")).toBe(false);
    expect(isFinalStatus(columns, "planned")).toBe(false);
    expect(isFinalStatus(undefined, "done")).toBe(false);
    expect(isFinalStatus(columns, undefined)).toBe(false);
  });
});

describe("isMoveToDone", () => {
  it("is true only when a non-final status becomes final", () => {
    expect(
      isMoveToDone({
        fromColumns: columns,
        fromStatus: "to-do",
        toStatus: "done",
      }),
    ).toBe(true);
    expect(
      isMoveToDone({
        fromColumns: columns,
        fromStatus: "planned",
        toStatus: "done",
      }),
    ).toBe(true);
  });

  it("ignores final -> final, same column and moves away from done", () => {
    expect(
      isMoveToDone({
        fromColumns: columns,
        fromStatus: "done",
        toStatus: "shipped",
      }),
    ).toBe(false);
    expect(
      isMoveToDone({
        fromColumns: columns,
        fromStatus: "done",
        toStatus: "done",
      }),
    ).toBe(false);
    expect(
      isMoveToDone({
        fromColumns: columns,
        fromStatus: "done",
        toStatus: "to-do",
      }),
    ).toBe(false);
    expect(
      isMoveToDone({
        fromColumns: columns,
        fromStatus: "to-do",
        toStatus: "in-progress",
      }),
    ).toBe(false);
  });

  it("does not treat archiving as done", () => {
    expect(
      isMoveToDone({
        fromColumns: columns,
        fromStatus: "done",
        toStatus: "archived",
      }),
    ).toBe(false);
  });

  it("reads each side from its own workflow for a cross-project move", () => {
    const other = [
      { id: "queued", slug: "queued", isFinal: false },
      { id: "closed", slug: "closed", isFinal: true },
    ];
    expect(
      isMoveToDone({
        fromColumns: other,
        fromStatus: "queued",
        toColumns: columns,
        toStatus: "done",
      }),
    ).toBe(true);
    expect(
      isMoveToDone({
        fromColumns: other,
        fromStatus: "closed",
        toColumns: columns,
        toStatus: "done",
      }),
    ).toBe(false);
  });
});

const board = {
  columns: [
    {
      id: "to-do",
      slug: "to-do",
      isFinal: false,
      tasks: [
        {
          id: "a",
          title: "A",
          projectId: "p",
          estimatedMinutes: 90,
          status: "to-do",
        },
        { id: "b", title: "B", projectId: "p", status: "to-do" },
      ],
    },
    { id: "done", slug: "done", isFinal: true, tasks: [] },
  ],
  plannedTasks: [{ id: "c", title: "C", projectId: "p", status: "planned" }],
  archivedTasks: [],
};

describe("doneMovesFromReorder", () => {
  it("returns only tasks whose status changed, from the pre-drop board", () => {
    const moves = doneMovesFromReorder(board, [
      { id: "a", status: "done" },
      { id: "b" },
    ]);
    expect(moves).toEqual([
      {
        task: { id: "a", title: "A", projectId: "p", estimatedMinutes: 90 },
        fromStatus: "to-do",
        toStatus: "done",
        fromColumns: board.columns,
        toColumns: board.columns,
      },
    ]);
  });

  it("skips tasks it cannot find", () => {
    expect(
      doneMovesFromReorder(board, [{ id: "zzz", status: "done" }]),
    ).toEqual([]);
    expect(
      doneMovesFromReorder(undefined, [{ id: "a", status: "done" }]),
    ).toEqual([]);
  });
});

describe("doneMovesForStatus", () => {
  it("covers board and backlog tasks, using each task's own status", () => {
    const moves = doneMovesForStatus(board, ["a", "c", "missing"], "done");
    expect(
      moves.map((move) => [move.task.id, move.fromStatus, move.toStatus]),
    ).toEqual([
      ["a", "to-do", "done"],
      ["c", "planned", "done"],
    ]);
    expect(
      moves.every((move) =>
        isMoveToDone({
          fromColumns: move.fromColumns,
          fromStatus: move.fromStatus,
          toStatus: move.toStatus,
        }),
      ),
    ).toBe(true);
  });
});
