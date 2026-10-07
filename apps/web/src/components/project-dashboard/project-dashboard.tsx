import { Link } from "@tanstack/react-router";
import { CornerLeftUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActivityFeed } from "@/components/home/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import icons from "@/constants/project-icons";
import useGetProjectDashboard from "@/hooks/queries/project/use-get-project-dashboard";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { DashboardStats } from "./dashboard-stats";
import { ProjectHealthBadge } from "./project-health-badge";
import { ProjectStatusSelect } from "./project-status-select";
import { SubprojectBreakdown } from "./subproject-breakdown";

type ProjectDashboardProps = {
  projectId: string;
  workspaceId: string;
};

export function ProjectDashboard({
  projectId,
  workspaceId,
}: ProjectDashboardProps) {
  const { t } = useTranslation();
  const {
    data: dashboard,
    isPending,
    isError,
  } = useGetProjectDashboard(projectId);
  const { canUpdateProjects } = useWorkspacePermission();

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 lg:px-10">
        <Skeleton
          aria-label={t("common:empty.loading")}
          className="h-10 w-1/2"
        />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError && !dashboard) {
    return (
      <p
        role="alert"
        className="mx-auto max-w-5xl px-6 py-10 text-muted-foreground text-sm"
      >
        {t("workspace:projectDashboard.loadError")}
      </p>
    );
  }

  const { project, parent, summary, subprojects } = dashboard;
  const ProjectIcon = icons[project.icon as keyof typeof icons] || icons.Layout;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-9 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-3">
          {parent && (
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/dashboard"
              params={{ workspaceId, projectId: parent.id }}
              className="inline-flex w-fit items-center gap-1.5 font-medium text-[13px] text-muted-foreground hover:text-foreground"
            >
              <CornerLeftUp aria-hidden="true" className="size-3.5" />
              {t("workspace:projectDashboard.parentOf", { name: parent.name })}
            </Link>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex min-w-0 items-center gap-2.5 font-semibold text-3xl text-foreground tracking-tight">
              <ProjectIcon
                aria-hidden="true"
                className="size-6 shrink-0 text-muted-foreground"
              />
              <span className="truncate">{project.name}</span>
            </h1>
            <div className="flex items-center gap-2">
              <ProjectStatusSelect
                projectId={project.id}
                workspaceId={workspaceId}
                status={project.status}
                canEdit={canUpdateProjects()}
              />
              <ProjectHealthBadge health={summary.health} />
            </div>
          </div>
          {subprojects.length > 0 && (
            <p className="text-muted-foreground text-[13px]">
              {t("workspace:projectDashboard.aggregateNote", {
                count: subprojects.length,
              })}
            </p>
          )}
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-9">
            <DashboardStats metrics={summary} />
            <SubprojectBreakdown
              dashboard={dashboard}
              workspaceId={workspaceId}
            />
          </div>
          <ActivityFeed workspaceId={workspaceId} projectId={project.id} />
        </div>
      </div>
    </div>
  );
}
