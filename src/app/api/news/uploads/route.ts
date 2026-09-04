import { NextRequest, NextResponse } from "next/server";
import { getCurrentSchoolId } from "@/lib/tenant";
import { saveFile, ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, type UploadKind } from "@/lib/storage";
import { apiError } from "@/lib/api-error";

const NEWS_UPLOAD_KINDS = ["news_image", "news_attachment"] as const;

function isNewsUploadKind(value: string): value is UploadKind {
  return (NEWS_UPLOAD_KINDS as readonly string[]).includes(value);
}

/** Dedicated upload endpoint for News images/attachments — kept separate from the HR-permission-gated /api/uploads since there's no "news" permission module (or any real session) to gate against yet. */
export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const form = await request.formData();
    const file = form.get("file");
    const rawKind = String(form.get("kind") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    }
    if (!isNewsUploadKind(rawKind)) {
      return NextResponse.json({ error: "Unsupported upload type." }, { status: 400 });
    }

    const allowed = ALLOWED_MIME_TYPES[rawKind];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: `This file type isn't accepted here. Allowed: ${allowed.join(", ")}.` }, { status: 422 });
    }

    const maxBytes = MAX_UPLOAD_BYTES[rawKind];
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `File is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.` }, { status: 422 });
    }

    const saved = await saveFile({
      schoolId,
      kind: rawKind,
      fileName: file.name,
      data: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });

    return NextResponse.json({ ...saved, originalName: file.name }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
