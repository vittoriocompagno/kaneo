import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import type { ProjectDashboard } from "@/fetchers/project/get-project-dashboard";
import useSetProjectStatus from "@/hooks/mutations/project/use-set-project-status";
import { toast } from "@/lib/toast";

// The type comes from the API contract; the list fixes the order shown in the
// menu, and an entry the API does not know fails typecheck.
export type ProjectStatus = ProjectDashboard["project"]["status"];

export const PROJECT_STATUSES = [
  "in_corso",
  "in_attesa_cliente",
  "in_pausa",
  "chiuso",
] as const satisfies readonly ProjectStatus[];

type ProjectStatusSelectProps = {
  projectId: string;
  workspaceId: string;
  status: ProjectStatus;
  canEdit: boolean;
  className?: string;
};

export function ProjectStatusSelect({
  projectId,
  workspaceId,
  status,
  canEdit,
  className,
}: ProjectStatusSelectProps) {
  const { t } = useTranslation();
  const { mutate, isPending } = useSetProjectStatus(workspaceId);
  const label = (value: ProjectStatus) => t(`workspace:projectStatus.${value}`);

  if (!canEdit) {
    return (
      <Badge variant="outline" size="lg">
        {label(status)}
      </Badge>
    );
  }

  return (
    <Select
      value={status}
      disabled={isPending}
      onValueChange={(value) => {
        if (!value || value === status) return;
        mutate(
          { id: projectId, status: value as ProjectStatus },
          {
            onError: () =>
              toast.error(t("workspace:projectStatus.updateError")),
          },
        );
      }}
    >
      <SelectTrigger
        size="sm"
        className={cn("w-auto min-w-40", className)}
        aria-label={t("workspace:projectStatus.label")}
      >
        <SelectValue>{label(status)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STATUSES.map((value) => (
          <SelectItem key={value} value={value}>
            {label(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
