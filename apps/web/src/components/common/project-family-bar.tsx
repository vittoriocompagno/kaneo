import { Link } from "@tanstack/react-router";
import { CornerLeftUp, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import icons from "@/constants/project-icons";
import { cn } from "@/lib/cn";

type FamilyMember = { id: string; name: string; icon: string | null };

type ProjectFamilyBarProps = {
  workspaceId: string;
  parent: FamilyMember | null;
  subprojects: FamilyMember[];
  view: "board" | "dashboard";
};

const CHIP =
  "inline-flex h-6 max-w-48 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

function MemberLink({
  workspaceId,
  member,
  view,
  className,
  children,
}: {
  workspaceId: string;
  member: FamilyMember;
  view: "board" | "dashboard";
  className?: string;
  children: React.ReactNode;
}) {
  const params = { workspaceId, projectId: member.id };
  return view === "dashboard" ? (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/dashboard"
      params={params}
      className={className}
    >
      {children}
    </Link>
  ) : (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/board"
      params={params}
      className={className}
    >
      {children}
    </Link>
  );
}

// Shown under the project header when the project has a visible parent or
// subprojects, so the hierarchy is reachable from every view.
export function ProjectFamilyBar({
  workspaceId,
  parent,
  subprojects,
  view,
}: ProjectFamilyBarProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("navigation:projectFamily.label")}
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-border border-b bg-card/60 px-3 py-1.5"
    >
      {parent && (
        <MemberLink
          workspaceId={workspaceId}
          member={parent}
          view={view}
          className={cn(CHIP, "border-transparent px-0 hover:bg-transparent")}
        >
          <CornerLeftUp aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">
            {t("navigation:projectFamily.parent", { name: parent.name })}
          </span>
        </MemberLink>
      )}
      {subprojects.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Layers aria-hidden="true" className="size-3.5" />
            {t("navigation:projectFamily.subprojects")}
          </span>
          {subprojects.map((subproject) => {
            const Icon =
              icons[subproject.icon as keyof typeof icons] || icons.Layout;
            return (
              <MemberLink
                key={subproject.id}
                workspaceId={workspaceId}
                member={subproject}
                view={view}
                className={CHIP}
              >
                <Icon aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">{subproject.name}</span>
              </MemberLink>
            );
          })}
        </div>
      )}
    </nav>
  );
}
