import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToFirstScrollableAncestor,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useReorderProjects from "@/hooks/mutations/project/use-reorder-projects";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { buildProjectTree, flattenProjectTree } from "@/lib/project-tree";
import { toast } from "@/lib/toast";
import {
  type CreateProjectAction,
  type ListedProject,
  NavProjectRow,
} from "./nav-project-row";
import CreateProjectModal from "./shared/modals/create-project-modal";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";

function SortableProjectItem({
  id,
  canReorder,
  children,
}: {
  id: string;
  canReorder: boolean;
  children: ReactNode;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      disabled: !canReorder,
      // The reorder already moves the row; animating the index change too
      // replays the same move from a stale offset.
      animateLayoutChanges: () => false,
      // dnd-kit defaults to `ease`; this is the app's curve.
      transition: { duration: 200, easing: "var(--ease-out)" },
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    // `listeners` without `attributes`: the latter puts role="button" and a tab
    // stop on the row, wrapping the link and the dropdown inside it.
    // A plain <li>, not SidebarMenuItem: the row inside owns the hover scope.
    <li
      ref={setNodeRef}
      style={style}
      data-sidebar="menu-item"
      data-kaneo-sortable=""
      className={cn("relative", isDragging && "opacity-0")}
      {...(canReorder ? listeners : {})}
    >
      {children}
    </li>
  );
}

export function NavProjects() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: projects } = useGetProjects(
    {
      workspaceId: workspace?.id || "",
    },
    true,
  );
  const queryClient = useQueryClient();
  const { mutateAsync: deleteProject } = useDeleteProject();
  const reorderProjects = useReorderProjects();
  const { canCreateProjects, canDeleteProjects, canUpdateProjects } =
    useWorkspacePermission();
  const canCreate = canCreateProjects();
  const canDeleteProject = canDeleteProjects();
  // Matches the API, which gates /project/reorder on `project: ["update"]`
  // alone — not the create+update+delete bundle.
  const canReorder = canUpdateProjects();
  const navigate = useNavigate();
  const { workspaceId: currentWorkspaceId, projectId: currentProjectId } =
    useParams({
      strict: false,
    });

  const [createProjectAction, setCreateProjectAction] =
    useState<CreateProjectAction | null>(null);
  const [isDeleteProjectModalOpen, setIsDeleteProjectModalOpen] =
    useState(false);
  const [projectToDeleteId, setProjectToDeleteID] = useState<string | null>(
    null,
  );
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(
    null,
  );

  const tree = useMemo(() => buildProjectTree(projects ?? []), [projects]);

  const requestDelete = (projectId: string) => {
    setProjectToDeleteID(projectId);
    setIsDeleteProjectModalOpen(true);
  };

  const draggingProject = projects?.find(
    (project) => project.id === draggingProjectId,
  );

  const isCurrentProject = (projectId: string) => {
    return (
      currentProjectId === projectId && currentWorkspaceId === workspace?.id
    );
  };

  const handleProjectClick = (project: ListedProject) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: {
        workspaceId: workspace?.id || "",
        projectId: project.id,
      },
    });
  };

  // Below these thresholds the row is still a link and the sidebar still
  // scrolls; above them the gesture becomes a drag.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    document.body.classList.add("kaneo-dragging");
    setDraggingProjectId(String(event.active.id));
  };

  const endDrag = () => {
    document.body.classList.remove("kaneo-dragging");
    setDraggingProjectId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    endDrag();

    if (!over || active.id === over.id || !projects || !workspace) return;

    // Only top-level projects move. Their subprojects travel with them, so the
    // flat order sent to the API stays parents-then-children.
    const oldIndex = tree.findIndex((node) => node.project.id === active.id);
    const newIndex = tree.findIndex((node) => node.project.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = flattenProjectTree(arrayMove(tree, oldIndex, newIndex));

    reorderProjects(workspace.id, reordered, {
      onError: () => {
        toast.error(t("workspace:projects.reorderError"));
      },
    });
  };

  if (!workspace) return null;

  return (
    <>
      <Collapsible defaultOpen className="group/collapsible">
        <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
          <CollapsibleTrigger
            className="data-panel-open:[&_svg]:rotate-90"
            render={
              <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-0 text-sidebar-accent-foreground" />
            }
          >
            <span>{t("navigation:sidebar.projects")}</span>
            <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60 transition-transform duration-200" />
          </CollapsibleTrigger>
          {canCreate && (
            <SidebarGroupAction
              className="top-2 right-2 text-sidebar-foreground/70"
              title={t("navigation:projectList.addProject")}
              onClick={() => setCreateProjectAction({ mode: "create" })}
            >
              <Plus />
              <span className="sr-only">
                {t("navigation:projectList.addProject")}
              </span>
            </SidebarGroupAction>
          )}
          <CollapsiblePanel>
            <SidebarGroupContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[
                  restrictToVerticalAxis,
                  restrictToFirstScrollableAncestor,
                ]}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={endDrag}
              >
                <SidebarMenu className="gap-0.5">
                  <SortableContext
                    items={tree.map((node) => node.project.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {tree.map(({ project, children }) => (
                      <SortableProjectItem
                        key={project.id}
                        id={project.id}
                        canReorder={canReorder}
                      >
                        <NavProjectRow
                          project={project}
                          workspaceId={workspace.id}
                          isActive={isCurrentProject(project.id)}
                          isChild={false}
                          canCreate={canCreate}
                          canDelete={canDeleteProject}
                          onOpen={handleProjectClick}
                          onCreateAction={setCreateProjectAction}
                          onDelete={requestDelete}
                        />
                        {children.length > 0 && (
                          // Subprojects sit inside the parent's drag source;
                          // a press on them must not start dragging the parent.
                          <SidebarMenuSub
                            className="mt-0.5 mr-0 gap-0.5 pr-0"
                            onMouseDown={(event) => event.stopPropagation()}
                            onTouchStart={(event) => event.stopPropagation()}
                          >
                            {children.map((child) => (
                              <li key={child.id} data-sidebar="menu-item">
                                <NavProjectRow
                                  project={child}
                                  workspaceId={workspace.id}
                                  isActive={isCurrentProject(child.id)}
                                  isChild
                                  canCreate={canCreate}
                                  canDelete={canDeleteProject}
                                  onOpen={handleProjectClick}
                                  onCreateAction={setCreateProjectAction}
                                  onDelete={requestDelete}
                                />
                              </li>
                            ))}
                          </SidebarMenuSub>
                        )}
                      </SortableProjectItem>
                    ))}
                  </SortableContext>
                </SidebarMenu>

                {/* Portalled: `SidebarContent` is `overflow-auto` and clips it. */}
                {createPortal(
                  <DragOverlay dropAnimation={null}>
                    {draggingProject ? (
                      <div className="flex h-8 w-(--sidebar-width) max-w-64 items-center rounded-lg border bg-sidebar not-dark:bg-clip-padding px-2 text-sm text-sidebar-accent-foreground shadow-lg/5">
                        <span className="truncate">{draggingProject.name}</span>
                      </div>
                    ) : null}
                  </DragOverlay>,
                  document.body,
                )}
              </DndContext>
            </SidebarGroupContent>
          </CollapsiblePanel>
        </SidebarGroup>
      </Collapsible>

      {createProjectAction && (
        <CreateProjectModal
          open
          onClose={() => setCreateProjectAction(null)}
          mode={createProjectAction.mode}
          sourceProject={createProjectAction.sourceProject}
          parentProjectId={createProjectAction.parentProjectId}
        />
      )}

      <AlertDialog
        open={isDeleteProjectModalOpen}
        onOpenChange={setIsDeleteProjectModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("navigation:projectList.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("navigation:projectList.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await deleteProject({
                      id: projectToDeleteId || "",
                    });
                    toast.success(t("navigation:projectList.deletedToast"));
                    queryClient.invalidateQueries({
                      queryKey: ["projects"],
                    });
                    navigate({
                      to: "/dashboard/workspace/$workspaceId",
                      params: {
                        workspaceId: workspace?.id || "",
                      },
                    });
                  }}
                />
              }
            >
              {t("navigation:projectList.deleteProject")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
