import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useDoneHoursPromptStore } from "@/store/done-hours-prompt";
import DoneHoursDialog from "./done-hours-dialog";

const m = vi.hoisted(() => ({
  createTimeEntry: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}|${JSON.stringify(options)}` : key,
  }),
}));
vi.mock("@/hooks/mutations/time-entry/use-create-time-entry", () => ({
  default: () => ({ mutateAsync: m.createTimeEntry, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: m.toastError, success: vi.fn() },
}));

const first = {
  id: "t1",
  title: "Fix header",
  projectId: "p",
  estimatedMinutes: 90,
};
const second = { id: "t2", title: "Footer", projectId: "p" };

const queue = () => useDoneHoursPromptStore.getState().queue;
const hoursInput = () => screen.getByLabelText("tasks:doneHours.hoursLabel");

beforeEach(() => {
  m.createTimeEntry.mockResolvedValue({});
  useDoneHoursPromptStore.getState().clear();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function open(...tasks: (typeof first)[] | (typeof second)[]) {
  render(<DoneHoursDialog />);
  act(() => useDoneHoursPromptStore.getState().enqueue(tasks));
}

describe("DoneHoursDialog", () => {
  it("renders nothing until a task moves to Done", () => {
    render(<DoneHoursDialog />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens empty, with the task title and the estimate as a hint", async () => {
    open(first);
    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(hoursInput()).toHaveValue("");
    expect(screen.getByLabelText("tasks:doneHours.noteLabel")).toHaveValue("");
    expect(screen.getByText(/tasks:doneHours.description/)).toHaveTextContent(
      "Fix header",
    );
    expect(screen.getByText(/tasks:doneHours.estimatedHint/)).toHaveTextContent(
      '"value":"1h 30m"',
    );
  });

  it("shows no hint when the task has no estimate", async () => {
    open(second);
    await screen.findByRole("dialog");
    expect(screen.queryByText(/tasks:doneHours.estimatedHint/)).toBeNull();
  });

  it("saves a time entry ending now, accepting a decimal comma, and closes", async () => {
    const before = Date.now();
    open(first);
    await screen.findByRole("dialog");
    fireEvent.change(hoursInput(), { target: { value: "1,5" } });
    fireEvent.change(screen.getByLabelText("tasks:doneHours.noteLabel"), {
      target: { value: " sopralluogo " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:doneHours.save" }),
    );

    await waitFor(() => expect(m.createTimeEntry).toHaveBeenCalledTimes(1));
    const call = m.createTimeEntry.mock.calls[0]?.[0];
    expect(call.taskId).toBe("t1");
    expect(call.description).toBe("sopralluogo");
    expect(new Date(call.endTime).getTime()).toBeGreaterThanOrEqual(before);
    expect(
      new Date(call.endTime).getTime() - new Date(call.startTime).getTime(),
    ).toBe(90 * 60 * 1000);
    await waitFor(() => expect(queue()).toEqual([]));
  });

  it("treats Salva with empty hours like Salta", async () => {
    open(first);
    await screen.findByRole("dialog");
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:doneHours.save" }),
    );
    await waitFor(() => expect(queue()).toEqual([]));
    expect(m.createTimeEntry).not.toHaveBeenCalled();
  });

  it("closes on Salta without creating an entry", async () => {
    open(first);
    await screen.findByRole("dialog");
    fireEvent.change(hoursInput(), { target: { value: "2" } });
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:doneHours.skip" }),
    );
    await waitFor(() => expect(queue()).toEqual([]));
    expect(m.createTimeEntry).not.toHaveBeenCalled();
  });

  it("closes on Escape without creating an entry", async () => {
    open(first);
    await screen.findByRole("dialog");
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() => expect(queue()).toEqual([]));
    expect(m.createTimeEntry).not.toHaveBeenCalled();
  });

  it("refuses invalid hours and keeps the dialog open", async () => {
    open(first);
    await screen.findByRole("dialog");
    fireEvent.change(hoursInput(), { target: { value: "abc" } });
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:doneHours.save" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "tasks:doneHours.invalid",
    );
    expect(m.createTimeEntry).not.toHaveBeenCalled();
    expect(queue()).toHaveLength(1);
  });

  it("keeps the dialog open for a retry when saving fails", async () => {
    m.createTimeEntry.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    open(first);
    await screen.findByRole("dialog");
    fireEvent.change(hoursInput(), { target: { value: "2" } });
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:doneHours.save" }),
    );
    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith("tasks:doneHours.saveError"),
    );
    expect(queue()).toHaveLength(1);
    expect(hoursInput()).toHaveValue("2");
    consoleError.mockRestore();
  });

  it("walks through several tasks with empty fields and can skip them all", async () => {
    open(first, second);
    await screen.findByRole("dialog");
    expect(screen.getByText(/tasks:doneHours.moreWaiting/)).toHaveTextContent(
      '"waiting":1',
    );
    fireEvent.change(hoursInput(), { target: { value: "3" } });
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:doneHours.save" }),
    );

    await waitFor(() => expect(queue().map((t) => t.id)).toEqual(["t2"]));
    await waitFor(() => expect(hoursInput()).toHaveValue(""));
    expect(screen.getByText(/tasks:doneHours.description/)).toHaveTextContent(
      "Footer",
    );
    expect(screen.queryByText(/tasks:doneHours.skipAll/)).toBeNull();
  });

  it("skips every waiting task at once", async () => {
    open(first, second);
    await screen.findByRole("dialog");
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:doneHours.skipAll" }),
    );
    await waitFor(() => expect(queue()).toEqual([]));
    expect(m.createTimeEntry).not.toHaveBeenCalled();
  });
});
