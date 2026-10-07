import { cleanup, render, screen, within } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ProjectDashboard } from "./project-dashboard";

const state = vi.hoisted(() => ({
  dashboard: undefined as unknown,
  canUpdate: false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: PropsWithChildren<{ params: { projectId: string } }>) => (
    <a href={`/p/${params.projectId}`}>{children}</a>
  ),
}));
vi.mock("@/hooks/queries/project/use-get-project-dashboard", () => ({
  default: () => ({ data: state.dashboard, isPending: false, isError: false }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateProjects: () => state.canUpdate }),
}));
vi.mock("@/hooks/mutations/project/use-set-project-status", () => ({
  default: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/home/activity-feed", () => ({
  ActivityFeed: ({ projectId }: { projectId?: string }) => (
    <div data-testid="feed">{projectId}</div>
  ),
}));

const metrics = (over: Record<string, unknown> = {}) => ({
  totalTasks: 4,
  doneTasks: 1,
  remainingTasks: 3,
  progress: 25,
  overdueTasks: 2,
  dueSoonTasks: 0,
  nextDueDate: null,
  trackedSeconds: 5400,
  health: "late",
  ...over,
});

function seed(subprojects: unknown[] = []) {
  state.dashboard = {
    project: {
      id: "parent",
      name: "Website",
      icon: "Layout",
      status: "in_attesa_cliente",
    },
    parent: null,
    own: metrics({ trackedSeconds: 600 }),
    summary: metrics(),
    subprojects,
  };
}

afterEach(() => {
  cleanup();
  state.canUpdate = false;
});

describe("ProjectDashboard", () => {
  it("shows the aggregate numbers, status and health", () => {
    seed();
    render(<ProjectDashboard projectId="parent" workspaceId="ws" />);

    expect(screen.getByRole("heading", { name: "Website" })).toBeVisible();
    expect(screen.getByText("1h 30m")).toBeVisible();
    expect(screen.getByText("25%")).toBeVisible();
    expect(
      screen.getByText("workspace:projectDashboard.health.late"),
    ).toBeVisible();
    // Read-only viewers see the status as a label, not a select.
    expect(
      screen.getByText("workspace:projectStatus.in_attesa_cliente"),
    ).toBeVisible();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByTestId("feed")).toHaveTextContent("parent");
  });

  it("lets members with edit rights change the status", () => {
    seed();
    state.canUpdate = true;
    render(<ProjectDashboard projectId="parent" workspaceId="ws" />);
    expect(
      screen.getByRole("combobox", { name: "workspace:projectStatus.label" }),
    ).toBeVisible();
  });

  it("breaks a parent down per subproject, each linking to its dashboard", () => {
    seed([
      {
        id: "kid-a",
        name: "Design",
        slug: "dsg",
        icon: "Layout",
        status: "in_corso",
        metrics: metrics({ trackedSeconds: 3600, progress: 50 }),
      },
      {
        id: "kid-b",
        name: "Build",
        slug: "bld",
        icon: null,
        status: "in_pausa",
        metrics: metrics({ trackedSeconds: 1200, health: "on_track" }),
      },
    ]);
    render(<ProjectDashboard projectId="parent" workspaceId="ws" />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/p/parent",
      "/p/kid-a",
      "/p/kid-b",
    ]);
    const design = links[1] as HTMLElement;
    expect(within(design).getByText("Design")).toBeVisible();
    expect(within(design).getByText("1h")).toBeVisible();
    expect(within(links[2] as HTMLElement).getByText("20m")).toBeVisible();
    expect(
      within(links[0] as HTMLElement).getByText(
        "workspace:projectDashboard.subprojects.thisProject",
      ),
    ).toBeVisible();
  });
});
