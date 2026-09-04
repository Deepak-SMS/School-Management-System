"use client";

import { ThemeProvider } from "@/providers/theme-provider";
import { UserProvider } from "@/providers/user-provider";
import { TenantProvider } from "@/providers/tenant-provider";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { ActiveChildProvider } from "@/providers/active-child-provider";
import { Toaster } from "@/components/ui/toast";
import { useIdleLogout } from "@/hooks/use-idle-logout";
import { isPortalRole, type CurrentUser } from "@/types/user";

export function AppProviders({
  initialUser,
  children,
}: {
  initialUser: CurrentUser | null;
  children: React.ReactNode;
}) {
  // Auto sign-out after 5 minutes of no mouse/keyboard/touch activity — only
  // while actually signed in, never on public pages like /login.
  useIdleLogout("/login", Boolean(initialUser));

  // TenantProvider/SidebarProvider assume an admin-shaped signed-in user
  // (school/campus/year switching, an icon-collapsible sidebar) — skip them
  // on public pages like /login, where there's no session yet, and for
  // parent/student logins, which get ActiveChildProvider instead (see
  // src/layouts/portal-shell.tsx).
  return (
    <ThemeProvider>
      <UserProvider initialUser={initialUser}>
        {initialUser && isPortalRole(initialUser.role) ? (
          <ActiveChildProvider>
            {children}
            <Toaster />
          </ActiveChildProvider>
        ) : initialUser ? (
          <TenantProvider>
            <SidebarProvider>
              {children}
              <Toaster />
            </SidebarProvider>
          </TenantProvider>
        ) : (
          <>
            {children}
            <Toaster />
          </>
        )}
      </UserProvider>
    </ThemeProvider>
  );
}
