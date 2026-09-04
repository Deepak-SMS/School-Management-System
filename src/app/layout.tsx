import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/config/roles";
import type { CurrentUser, Role } from "@/types/user";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Classlane — School Management System",
  description: "A modern, multi-tenant school management SaaS.",
};

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]!.toUpperCase()).join("") || "?";
}

/** Builds the client-facing user from the real session, or null when signed out. */
async function resolveCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.schoolMembership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { role: true, schoolId: true },
    }),
  ]);
  // A session with no membership rows has nothing to act as inside the app
  // shell yet — treated as signed out until it's linked to a school.
  if (!user || memberships.length === 0) return null;

  const role = memberships[0].role as Role;
  return {
    id: userId,
    name: user.name,
    email: user.email,
    avatarInitials: initialsOf(user.name),
    role,
    roleLabel: ROLE_LABELS[role],
    schoolIds: memberships.map((m) => m.schoolId),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const currentUser = await resolveCurrentUser();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">
        <AppProviders initialUser={currentUser}>{children}</AppProviders>
      </body>
    </html>
  );
}
