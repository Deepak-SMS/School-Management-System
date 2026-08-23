"use client";

import { ThemeProvider } from "@/providers/theme-provider";
import { UserProvider } from "@/providers/user-provider";
import { TenantProvider } from "@/providers/tenant-provider";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { Toaster } from "@/components/ui/toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <UserProvider>
        <TenantProvider>
          <SidebarProvider>
            {children}
            <Toaster />
          </SidebarProvider>
        </TenantProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
