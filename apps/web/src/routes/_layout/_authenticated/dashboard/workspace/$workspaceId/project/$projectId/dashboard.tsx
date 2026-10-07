import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { ProjectDashboard } from "@/components/project-dashboard/project-dashboard";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/dashboard",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("tasks:dashboard.title")} />
      <ProjectLayout
        projectId={projectId}
        workspaceId={workspaceId}
        activeView="dashboard"
      >
        <ProjectDashboard projectId={projectId} workspaceId={workspaceId} />
      </ProjectLayout>
    </>
  );
}
