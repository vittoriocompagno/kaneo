import { useNavigate } from "@tanstack/react-router";
import {
  BookmarkPlus,
  Copy,
  Folder,
  FolderPlus,
  Forward,
  MoreHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { ProjectProgress } from "@/components/project-progress";
import icons from "@/constants/project-icons";
import type getProjects from "@/fetchers/project/get-projects";
import { toast } from "@/lib/toast";

export type ListedProject = NonNullable<
  Awaited<ReturnType<typeof getProjects>>
>[number];

export type CreateProjectAction = {
  mode: "create" | "duplicate" | "template";
  sourceProject?: {
    id: string;
    name: string;
    icon: string | null;
    parentProjectId?: string | null;
  };
  // Preselects the parent in the create modal.
  parentProjectId?: string;
};

type NavProjectRowProps = {
  project: ListedProject;
  workspaceId: string;
  isActive: boolean;
  isChild: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onOpen: (project: ListedProject) => void;
  onCreateAction: (action: CreateProjectAction) => void;
  onDelete: (projectId: string) => void;
};

// One sidebar row: the link plus its hover menu. The wrapper owns the
// `group/menu-item` hover scope, so a parent's menu does not light up while
// the pointer is over one of its subprojects.
export function NavProjectRow({
  project,
  workspaceId,
  isActive,
  isChild,
  canCreate,
  canDelete,
  onOpen,
  onCreateAction,
  onDelete,
}: NavProjectRowProps) {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const ProjectIcon = icons[project.icon as keyof typeof icons] || icons.Layout;

  return (
    <div className="group/menu-item relative">
      <SidebarMenuButton
        isActive={isActive}
        size="default"
        className={isChild ? "h-7 text-[13px]" : "h-8 text-sm"}
        onClick={() => onOpen(project)}
      >
        <ProjectIcon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        {/* Gives way to the row menu, which sits here on hover. */}
        <ProjectProgress
          percentage={project.statistics.completionPercentage}
          className="text-muted-foreground max-md:hidden group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0 group-has-data-[state=open]/menu-item:opacity-0"
        />
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              // The row is the drag source; this press
              // must not reach it.
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-lg p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground after:-inset-2 after:absolute md:after:hidden peer-data-[size=sm]/menu-button:top-1 peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 group-data-[collapsible=icon]:hidden group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0"
            />
          }
        >
          <MoreHorizontal />
          <span className="sr-only">{t("navigation:sidebar.more")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-44 rounded-lg"
          side={isMobile ? "bottom" : "right"}
          align={isMobile ? "end" : "start"}
        >
          <DropdownMenuItem
            className="h-7 items-start cursor-pointer text-sm"
            onClick={() => onOpen(project)}
          >
            <Folder className="text-muted-foreground" />
            <span>{t("navigation:projectList.viewProject")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-7 items-start cursor-pointer text-sm"
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/dashboard/workspace/${workspaceId}/project/${project.id}`,
              );
              toast.success(t("navigation:projectList.linkCopied"));
            }}
          >
            <Forward className="text-muted-foreground" />
            <span>{t("navigation:projectList.shareProject")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-7 items-start cursor-pointer text-sm"
            onClick={() => {
              navigate({
                to: "/dashboard/settings/projects/$projectId/general",
                params: { projectId: project.id },
              });
            }}
          >
            <Settings className="text-muted-foreground" />
            <span>{t("navigation:projectList.projectSettings")}</span>
          </DropdownMenuItem>
          {canCreate && !isChild && (
            <DropdownMenuItem
              className="h-7 items-start cursor-pointer text-sm"
              onClick={() =>
                onCreateAction({ mode: "create", parentProjectId: project.id })
              }
            >
              <FolderPlus className="text-muted-foreground" />
              <span>{t("navigation:projectList.addSubproject")}</span>
            </DropdownMenuItem>
          )}
          {canCreate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="h-7 items-start cursor-pointer text-sm"
                onClick={() =>
                  onCreateAction({ mode: "duplicate", sourceProject: project })
                }
              >
                <Copy className="text-muted-foreground" />
                <span>{t("navigation:projectList.duplicateProject")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-7 items-start cursor-pointer text-sm"
                onClick={() =>
                  onCreateAction({ mode: "template", sourceProject: project })
                }
              >
                <BookmarkPlus className="text-muted-foreground" />
                <span>{t("navigation:projectList.saveAsTemplate")}</span>
              </DropdownMenuItem>
            </>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="h-7 items-start text-destructive cursor-pointer text-sm"
                onClick={() => {
                  onDelete(project.id);
                }}
              >
                <Trash2 className="text-destructive" />
                <span>{t("navigation:projectList.deleteProject")}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
