"use client";

import { Sidebar, MobileNavContent } from "@/layouts/sidebar";
import { TopNav } from "@/layouts/topnav";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useSidebar } from "@/providers/sidebar-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <Sidebar />

      <Drawer open={isMobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent side="left" widthClassName="w-72">
          <MobileNavContent onNavigate={() => setMobileOpen(false)} />
        </DrawerContent>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
