import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import CommandPalette from "@/components/command-palette";
import DoneHoursDialog from "@/components/shared/modals/done-hours-dialog";
import SearchCommandMenu from "@/components/search-command-menu";

// layout for the main app
export const Route = createFileRoute("/_layout")({
  component: RouteComponent,
});

function RouteComponent() {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <>
      <Outlet />
      <CommandPalette />
      <DoneHoursDialog />
      <SearchCommandMenu open={searchOpen} setOpen={setSearchOpen} />
    </>
  );
}
