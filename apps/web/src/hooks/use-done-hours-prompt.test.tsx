import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useDoneHoursPromptStore } from "@/store/done-hours-prompt";
import { useDoneHoursPrompt } from "./use-done-hours-prompt";

const getColumns = vi.hoisted(() => vi.fn());
vi.mock("@/fetchers/column/get-columns", () => ({ default: getColumns }));

const flow = [
  { id: "c1", slug: "to-do", isFinal: false },
  { id: "c2", slug: "done", isFinal: true },
];
const other = [
  { id: "d1", slug: "queued", isFinal: false },
  { id: "d2", slug: "closed", isFinal: true },
];
const task = {
  id: "t1",
  title: "Fix header",
  projectId: "p1",
  estimatedMinutes: 120,
};

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  useDoneHoursPromptStore.getState().clear();
  getColumns.mockImplementation(async (projectId: string) =>
    projectId === "p2" ? other : flow,
  );
});

afterEach(() => vi.clearAllMocks());

function run(moves: Parameters<ReturnType<typeof useDoneHoursPrompt>>[0]) {
  const { result } = renderHook(() => useDoneHoursPrompt(), { wrapper });
  return result.current(moves);
}

describe("useDoneHoursPrompt", () => {
  it("queues a task that lands in a final column, loading the workflow itself", async () => {
    await run([{ task, fromStatus: "to-do", toStatus: "done" }]);
    expect(useDoneHoursPromptStore.getState().queue).toEqual([task]);
    expect(getColumns).toHaveBeenCalledWith("p1");
  });

  it("reuses a workflow the caller already holds", async () => {
    await run([
      { task, fromStatus: "to-do", toStatus: "done", toColumns: flow },
    ]);
    expect(getColumns).not.toHaveBeenCalled();
    expect(useDoneHoursPromptStore.getState().queue).toHaveLength(1);
  });

  it("stays quiet for moves that do not end in Done", async () => {
    await run([
      { task, fromStatus: "done", toStatus: "to-do" },
      { task, fromStatus: "done", toStatus: "done" },
      { task, fromStatus: "to-do", toStatus: "archived" },
    ]);
    expect(useDoneHoursPromptStore.getState().queue).toEqual([]);
  });

  it("queues one entry per task and never twice for the same task", async () => {
    const second = { ...task, id: "t2", title: "Other" };
    await run([
      { task, fromStatus: "to-do", toStatus: "done" },
      { task: second, fromStatus: "to-do", toStatus: "done" },
    ]);
    await run([{ task, fromStatus: "to-do", toStatus: "done" }]);
    expect(useDoneHoursPromptStore.getState().queue.map((t) => t.id)).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("judges a cross-project move by each project's own workflow", async () => {
    const moved = { ...task, projectId: "p1" };
    await run([
      {
        task: moved,
        fromStatus: "queued",
        toStatus: "done",
        fromProjectId: "p2",
        toProjectId: "p1",
      },
    ]);
    expect(useDoneHoursPromptStore.getState().queue).toEqual([moved]);

    useDoneHoursPromptStore.getState().clear();
    await run([
      {
        task: moved,
        fromStatus: "closed",
        toStatus: "done",
        fromProjectId: "p2",
        toProjectId: "p1",
      },
    ]);
    expect(useDoneHoursPromptStore.getState().queue).toEqual([]);
  });

  it("never throws when the workflow cannot be loaded", async () => {
    getColumns.mockRejectedValue(new Error("offline"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await expect(
      run([{ task, fromStatus: "to-do", toStatus: "done" }]),
    ).resolves.toBeUndefined();
    expect(useDoneHoursPromptStore.getState().queue).toEqual([]);
    consoleError.mockRestore();
  });
});
