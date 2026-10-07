import { useTranslation } from "react-i18next";
import { ProjectStatusSelect } from "@/components/project-dashboard/project-status-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useSetProjectParent from "@/hooks/mutations/project/use-set-project-parent";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";

type ProjectHierarchySettingsProps = {
  projectId: string;
  workspaceId: string;
  canEdit: boolean;
};

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    return parsed.message || fallback;
  } catch {
    return error.message || fallback;
  }
}

// Manual status and the parent project. Both save on change, outside the
// auto-saving name/key form, because they hit their own endpoints.
export function ProjectHierarchySettings({
  projectId,
  workspaceId,
  canEdit,
}: ProjectHierarchySettingsProps) {
  const { t } = useTranslation();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: projects } = useGetProjects({ workspaceId });
  const { mutate: setParent, isPending } = useSetProjectParent(workspaceId);

  if (!project) return null;

  const children = (projects ?? []).filter(
    (item) => item.parentProjectId === projectId,
  );
  const parentOptions = (projects ?? []).filter(
    (item) => item.id !== projectId && !item.parentProjectId,
  );
  const parentId = parentOptions.some(
    (item) => item.id === project.parentProjectId,
  )
    ? (project.parentProjectId ?? "")
    : "";
  // A project with subprojects is a parent already; it cannot also be a child.
  const hasChildren = children.length > 0;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t("workspace:projectStatus.label")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("workspace:projectStatus.hint")}
          </p>
        </div>
        <ProjectStatusSelect
          projectId={projectId}
          workspaceId={workspaceId}
          status={project.status}
          canEdit={canEdit}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t("settings:projectGeneral.parentLabel")}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasChildren
              ? t("settings:projectGeneral.parentBlockedHint", {
                  count: children.length,
                })
              : t("settings:projectGeneral.parentHint")}
          </p>
        </div>
        <Select
          value={parentId}
          disabled={!canEdit || hasChildren || isPending}
          onValueChange={(value) => {
            const next = String(value ?? "");
            if (next === parentId) return;
            setParent(
              { id: projectId, parentProjectId: next || null },
              {
                onError: (error) =>
                  toast.error(
                    errorMessage(
                      error,
                      t("settings:projectGeneral.parentError"),
                    ),
                  ),
              },
            );
          }}
        >
          <SelectTrigger
            className="w-full sm:w-64"
            aria-label={t("settings:projectGeneral.parentLabel")}
          >
            <SelectValue placeholder={t("settings:projectGeneral.noParent")}>
              {parentOptions.find((item) => item.id === parentId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">
              {t("settings:projectGeneral.noParent")}
            </SelectItem>
            {parentOptions.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
