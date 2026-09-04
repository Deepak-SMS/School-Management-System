"use client";

import { useState } from "react";
import { PlatformSidebar, PlatformMobileNavContent } from "@/layouts/platform-sidebar";
import { PlatformTopNav } from "@/layouts/platform-topnav";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIdleLogout } from "@/hooks/use-idle-logout";
import type { PlatformUser } from "@/lib/platform-auth";

export function PlatformShell({ user, children }: { user: PlatformUser; children: React.ReactNode }) {
  const [isMobileOpen, setMobileOpen] = useState(false);

  // Auto sign-out after 5 minutes of no activity — same rule as the school-scoped app.
  useIdleLogout("/super-admin/login", true);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <PlatformSidebar />

      <Drawer open={isMobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent side="left" widthClassName="w-72">
          <PlatformMobileNavContent onNavigate={() => setMobileOpen(false)} />
        </DrawerContent>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <PlatformTopNav user={user} onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
