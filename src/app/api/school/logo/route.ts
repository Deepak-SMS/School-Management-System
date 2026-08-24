import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { saveFile } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 422 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Logo must be a JPG, PNG, or WebP image." }, { status: 422 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Logo must be smaller than 2 MB." }, { status: 422 });
    }

    const data = Buffer.from(await file.arrayBuffer());
    const { url } = await saveFile({ schoolId, kind: "school_logo", fileName: file.name, data, mimeType: file.type });

    const school = await prisma.$transaction(async (tx) => {
      const updated = await tx.school.update({ where: { id: schoolId }, data: { logoUrl: url } });
      await recordAudit(tx, { schoolId, action: "school.logo.update", entityType: "School", entityId: schoolId, after: { logoUrl: url } });
      return updated;
    });

    return NextResponse.json(school);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  try {
    const schoolId = await getCurrentSchoolId();
    const school = await prisma.$transaction(async (tx) => {
      const updated = await tx.school.update({ where: { id: schoolId }, data: { logoUrl: null } });
      await recordAudit(tx, { schoolId, action: "school.logo.remove", entityType: "School", entityId: schoolId });
      return updated;
    });
    return NextResponse.json(school);
  } catch (error) {
    return apiError(error);
  }
}
