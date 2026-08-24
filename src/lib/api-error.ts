import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/authorize";
import { InvalidTransitionError } from "@/lib/recruitment-pipeline";

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

  // Authorization failure — 403, and never leaks which record was being accessed.
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message, permission: error.permission }, { status: 403 });
  }

  // An illegal recruitment pipeline move is the caller's mistake, not a server
  // fault — 409, with the message naming what would have been allowed.
  if (error instanceof InvalidTransitionError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "field";
      return NextResponse.json({ error: `A record with this ${target} already exists.` }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }
  }

  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
