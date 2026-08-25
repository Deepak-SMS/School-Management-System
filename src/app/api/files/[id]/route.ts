import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { readStoredFile } from "@/lib/storage";
import { apiError } from "@/lib/api-error";

/**
 * Streams a stored file by its UploadedFile id.
 *
 * Files live outside `public/`, so this is the only way to read one — which
 * makes the tenant check here the whole of their protection. A file belonging
 * to another school answers 404 rather than 403: whether an id exists is
 * itself something a stranger shouldn't learn.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;

    const record = await prisma.uploadedFile.findFirst({
      where: { id, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!record) return NextResponse.json({ error: "File not found." }, { status: 404 });

    const file = await readStoredFile(id);
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });

    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.originalName ?? id}"`,
        // Per-user authorized content must never land in a shared cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
