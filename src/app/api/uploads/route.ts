import { NextRequest, NextResponse } from "next/server";
import { saveFile, UPLOAD_KINDS, ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, type UploadKind } from "@/lib/storage";
import { requirePermission } from "@/lib/authorize";
import type { PermissionModule, PermissionAction } from "@/types/permissions";
import { apiError } from "@/lib/api-error";

/**
 * Single upload endpoint for HR files (employee photos and documents, candidate
 * resumes). Files land outside `public/` and are only readable through
 * `/api/files/[id]`, so nothing is served without an authorization check.
 *
 * Each kind maps to the permission that may create it — uploading an employee
 * document requires document rights, not merely "being logged in".
 */
const PERMISSION_BY_KIND: Partial<Record<UploadKind, [PermissionModule, PermissionAction]>> = {
  staff_photo: ["employees", "edit"],
  staff_document: ["employeeDocuments", "create"],
  school_document: ["schoolProfile", "edit"],
  candidate_photo: ["candidates", "edit"],
  candidate_resume: ["candidates", "create"],
  candidate_document: ["candidates", "create"],
  import_excel: ["employees", "import"],
};

function isUploadKind(value: string): value is UploadKind {
  return (UPLOAD_KINDS as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const rawKind = String(form.get("kind") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    }
    if (!isUploadKind(rawKind)) {
      return NextResponse.json({ error: "Unsupported upload type." }, { status: 400 });
    }

    const permission = PERMISSION_BY_KIND[rawKind];
    if (!permission) {
      return NextResponse.json({ error: "Unsupported upload type." }, { status: 400 });
    }
    const user = await requirePermission(permission[0], permission[1]);

    const allowed = ALLOWED_MIME_TYPES[rawKind];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: `This file type isn't accepted here. Allowed: ${allowed.join(", ")}.` },
        { status: 422 },
      );
    }

    const maxBytes = MAX_UPLOAD_BYTES[rawKind];
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.` },
        { status: 422 },
      );
    }

    const saved = await saveFile({
      schoolId: user.schoolId,
      kind: rawKind,
      fileName: file.name,
      data: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
