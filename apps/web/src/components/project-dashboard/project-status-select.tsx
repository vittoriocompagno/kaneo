import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useSetProjectStatus from "@/hooks/mutations/project/use-set-project-status";
import { toast } from "@/lib/toast";

export const PROJECT_STATUSES = [
  "in_corso",
  "in_attesa_cliente",
  "in_pausa",
  "chiuso",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

type ProjectStatusSelectProps = {
  projectId: string;
  workspaceId: string;
  status: ProjectStatus;
  canEdit: boolean;
};

export function ProjectStatusSelect({
  projectId,
  workspaceId,
  status,
  canEdit,
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
        className="w-auto min-w-40"
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
