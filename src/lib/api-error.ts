import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/authorize";
import { InvalidTransitionError } from "@/lib/recruitment-pipeline";
import { UnauthenticatedError } from "@/lib/session";
import { NoSchoolMembershipError } from "@/lib/tenant";
import { NotAMemberError } from "@/lib/current-user";
import { NotSuperAdminError } from "@/lib/platform-auth";
import { SchoolHasDataError } from "@/lib/platform-schools";
import { NotATeacherError } from "@/lib/teacher-scope";
import {
  NotAGuardianError,
  NotAPortalStudentError,
  PortalStudentAccessError,
  NotAPortalRoleError,
} from "@/lib/portal-scope";
import { StudentPlacementError } from "@/lib/students/create-student";
import { DuplicateAdmissionNumberError } from "@/lib/students/admission-number";
import { AiConversationNotFoundError, AiNothingToRegenerateError } from "@/lib/ai/conversation-service";
import { AiQuotaExceededError } from "@/lib/ai/usage";
import { AiProviderUnavailableError } from "@/lib/ai/providers/types";
import { TimetableNotFoundError } from "@/lib/timetable/generate-timetable";

/**
 * Normalizes any thrown error into a clean JSON response — never a raw stack
 * trace or Prisma internals (see CLAUDE.md "never expose technical errors to
 * normal users").
 */
export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  // No/expired session — 401, distinct from a permission failure below.
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Signed in, but not attached to a school (or not to this one) — 403.
  if (error instanceof NoSchoolMembershipError || error instanceof NotAMemberError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // A teacher-only view, but this account has no linked Staff record — 403.
  if (error instanceof NotATeacherError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // Portal-only views, but this account has no linked Guardian/Student record,
  // isn't a portal role at all, or asked about a child that isn't theirs — 403.
  if (
    error instanceof NotAGuardianError ||
    error instanceof NotAPortalStudentError ||
    error instanceof PortalStudentAccessError ||
    error instanceof NotAPortalRoleError
  ) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // Signed in, but not a platform Super Admin — 403.
  if (error instanceof NotSuperAdminError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // Deleting a school that still has real tenant data on it — 409, caller should use status instead.
  if (error instanceof SchoolHasDataError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  // Authorization failure — 403, and never leaks which record was being accessed.
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message, permission: error.permission }, { status: 403 });
  }

  // An illegal recruitment pipeline move is the caller's mistake, not a server
  // fault — 409, with the message naming what would have been allowed.
  if (error instanceof InvalidTransitionError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  // The academic year/class/section a student is being placed into doesn't
  // check out for this school — see createStudentWithGuardians.
  if (error instanceof StudentPlacementError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  // Two students in the same school can't share an admission number — 409,
  // with a message the form can attach directly to that field.
  if (error instanceof DuplicateAdmissionNumberError) {
    return NextResponse.json({ error: error.message, field: "admissionNumber" }, { status: 409 });
  }

  if (error instanceof TimetableNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof AiConversationNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof AiNothingToRegenerateError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  // Monthly AI request limit hit — the caller's account state, not a server fault.
  if (error instanceof AiQuotaExceededError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }

  // Ollama unreachable/misconfigured — 503, with a message safe to show as-is (spec §21).
  if (error instanceof AiProviderUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "field";
      return NextResponse.json({ error: `A record with this ${target} already exists.` }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }
    // Foreign key constraint failed — deleting/updating a record something
    // else still points to. Each delete route should ideally check this
    // itself first (for a specific, actionable message), but this is the
    // honest fallback rather than a generic 500 when one doesn't yet.
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "This record is still in use elsewhere and can't be deleted." },
        { status: 409 },
      );
    }
  }

  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
