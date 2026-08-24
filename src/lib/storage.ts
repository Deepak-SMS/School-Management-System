import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";

/**
 * Storage abstraction. Today this writes to a local `storage/` directory
 * (gitignored, outside `public/` so files are never served without going
 * through an authorization-checked route). Swapping to S3-compatible
 * storage later means replacing the two functions below — nothing that
 * calls `saveFile`/`readStoredFile` needs to change.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export type UploadKind =
  | "student_photo"
  | "staff_photo"
  | "school_logo"
  | "school_banner"
  | "signature"
  | "generated_pdf"
  | "import_excel"
  | "import_zip";

export async function saveFile(params: {
  schoolId: string;
  kind: UploadKind;
  fileName: string;
  data: Buffer;
  mimeType: string;
}): Promise<{ id: string; url: string }> {
  const dir = path.join(STORAGE_ROOT, params.schoolId, params.kind);
  await mkdir(dir, { recursive: true });
  const safeName = `${Date.now()}-${params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(dir, safeName);
  await writeFile(filePath, params.data);

  const record = await prisma.uploadedFile.create({
    data: {
      schoolId: params.schoolId,
      kind: params.kind,
      storageProvider: "local",
      path: filePath,
      originalName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.data.byteLength,
    },
  });

  return { id: record.id, url: `/api/files/${record.id}` };
}

export async function readStoredFile(id: string): Promise<{ data: Buffer; mimeType: string; originalName: string | null } | null> {
  const record = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!record) return null;
  const data = await readFile(record.path);
  return { data, mimeType: record.mimeType ?? "application/octet-stream", originalName: record.originalName };
}
