import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import TaskEstimatePopover from "./task-estimate-popover";

const m = vi.hoisted(() => ({
  update: vi.fn(),
  canUpdate: vi.fn(() => true),
  toastError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}|${options.value}` : key,
  }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-estimate", () => ({
  useUpdateTaskEstimate: () => ({ mutateAsync: m.update, isPending: false }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: m.canUpdate }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: m.toastError } }));

const task = {
  id: "t1",
  title: "T",
  projectId: "p",
  status: "to-do",
} as Task;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  m.canUpdate.mockReturnValue(true);
});

describe("TaskEstimatePopover", () => {
  it("shows the empty state and the current estimate", () => {
    const { rerender } = render(<TaskEstimatePopover task={task} />);
    expect(screen.getByText("tasks:properties.estimate")).toBeVisible();
    rerender(<TaskEstimatePopover task={{ ...task, estimatedMinutes: 150 }} />);
    expect(
      screen.getByText("tasks:properties.estimateValue|2h 30m"),
    ).toBeVisible();
  });

  it("saves the typed hours as minutes", async () => {
    m.update.mockResolvedValue({});
    render(<TaskEstimatePopover task={task} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(
      await screen.findByLabelText("tasks:popover.estimate.label"),
      {
        target: { value: "1,5" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:popover.estimate.save" }),
    );
    await waitFor(() =>
      expect(m.update).toHaveBeenCalledWith({
        taskId: "t1",
        estimatedMinutes: 90,
      }),
    );
  });

  it("prefills the current value and can clear it", async () => {
    m.update.mockResolvedValue({});
    render(<TaskEstimatePopover task={{ ...task, estimatedMinutes: 90 }} />);
    fireEvent.click(screen.getByRole("button"));
    expect(
      await screen.findByLabelText("tasks:popover.estimate.label"),
    ).toHaveValue("1,5");
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:popover.estimate.clear" }),
    );
    await waitFor(() =>
      expect(m.update).toHaveBeenCalledWith({
        taskId: "t1",
        estimatedMinutes: null,
      }),
    );
  });

  it("does not save an invalid value", async () => {
    render(<TaskEstimatePopover task={task} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(
      await screen.findByLabelText("tasks:popover.estimate.label"),
      {
        target: { value: "abc" },
      },
    );
    expect(
      screen.getByRole("button", { name: "tasks:popover.estimate.save" }),
    ).toBeDisabled();
    expect(m.update).not.toHaveBeenCalled();
  });

  it("is read-only without update permission", () => {
    m.canUpdate.mockReturnValue(false);
    const { container, rerender } = render(<TaskEstimatePopover task={task} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TaskEstimatePopover task={{ ...task, estimatedMinutes: 60 }} />);
    expect(screen.getByText("tasks:properties.estimateValue|1h")).toBeVisible();
  });
});
