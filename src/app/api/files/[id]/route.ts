import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "@/lib/storage";

/**
 * Streams a stored file by its UploadedFile id. Not scoped by school yet
 * because there's no session to check against — once auth ships, this must
 * verify the requester belongs to the file's school before serving it.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await readStoredFile(id);
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.originalName ?? id}"`,
    },
  });
}
