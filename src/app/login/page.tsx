import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { LoginForm } from "@/features/auth/login-form";
import { APP_LOGO_MARK, APP_NAME } from "@/config/app";
import { isPortalRole } from "@/types/user";
import type { Role } from "@/types/user";

export const metadata = { title: "Sign in — Classlane" };

const HIGHLIGHTS = [
  "One login, every role — admin, teacher, parent, student",
  "Multi-campus and multi-year, built in from the start",
  "Attendance, fees, exams and HR under one roof",
];

export default async function LoginPage() {
  const userId = await getSessionUserId();
  if (userId) {
    const membership = await prisma.schoolMembership.findFirst({ where: { userId }, select: { role: true } });
    redirect(membership && isPortalRole(membership.role as Role) ? "/portal" : "/admin");
  }

  return (
    <div className="grid min-h-screen bg-background md:grid-cols-2">
      {/* Branding panel — hidden on small screens, where the mobile header below carries the identity instead. */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-10 md:flex md:flex-col md:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl [animation:drift_16s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-primary-400/20 blur-3xl [animation:drift_20s_ease-in-out_infinite_reverse]"
        />

        <div className="relative flex items-center gap-2.5 opacity-0 [animation:panel-in_500ms_ease-out_forwards]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-base font-bold text-white backdrop-blur-sm">
            {APP_LOGO_MARK}
          </span>
          <span className="text-lg font-semibold text-white">{APP_NAME}</span>
        </div>

        <div className="relative flex flex-col gap-6 opacity-0 [animation:panel-in_600ms_ease-out_150ms_forwards]">
          <h1 className="text-3xl font-semibold text-white">Manage your school with confidence</h1>
          <p className="max-w-sm text-sm text-primary-100">A complete platform for administrators, teachers, students, and parents.</p>
          <ul className="flex flex-col gap-3">
            {HIGHLIGHTS.map((item, i) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm text-primary-50 opacity-0 [animation:panel-in_500ms_ease-out_forwards]"
                style={{ animationDelay: `${300 + i * 100}ms` }}
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-200 opacity-0 [animation:panel-in_500ms_ease-out_700ms_forwards]">
          © {new Date().getFullYear()} {APP_NAME}. Built for the whole school year.
        </p>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-col items-center justify-center px-4 py-10">
        <div className="flex items-center gap-2 md:hidden">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">
            {APP_LOGO_MARK}
          </span>
          <span className="text-base font-semibold text-foreground">{APP_NAME}</span>
        </div>

        <div className="w-full max-w-sm opacity-0 [animation:panel-in_500ms_ease-out_100ms_forwards]">
          <div className="mt-6 mb-6 text-center md:mt-0">
            <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select your role and sign in</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
