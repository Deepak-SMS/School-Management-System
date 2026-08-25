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
  | "staff_document"
  | "student_document"
  | "school_document"
  | "candidate_photo"
  | "candidate_resume"
  | "candidate_document"
  | "school_logo"
  | "school_banner"
  | "signature"
  | "generated_pdf"
  | "import_excel"
  | "import_zip";

export const UPLOAD_KINDS: readonly UploadKind[] = [
  "student_photo",
  "staff_photo",
  "staff_document",
  "student_document",
  "school_document",
  "candidate_photo",
  "candidate_resume",
  "candidate_document",
  "school_logo",
  "school_banner",
  "signature",
  "generated_pdf",
  "import_excel",
  "import_zip",
];

/** Accepted MIME types per kind — an allowlist, so an upload route can never store arbitrary executables. */
export const ALLOWED_MIME_TYPES: Record<UploadKind, readonly string[]> = {
  student_photo: ["image/jpeg", "image/png", "image/webp"],
  staff_photo: ["image/jpeg", "image/png", "image/webp"],
  staff_document: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  student_document: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  school_document: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  candidate_photo: ["image/jpeg", "image/png", "image/webp"],
  candidate_resume: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  candidate_document: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  school_logo: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  school_banner: ["image/jpeg", "image/png", "image/webp"],
  signature: ["image/jpeg", "image/png", "image/webp"],
  generated_pdf: ["application/pdf"],
  import_excel: ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  import_zip: ["application/zip", "application/x-zip-compressed"],
};

/** Per-kind size ceiling in bytes. Documents get more room than avatars. */
export const MAX_UPLOAD_BYTES: Record<UploadKind, number> = {
  student_photo: 5 * 1024 * 1024,
  staff_photo: 5 * 1024 * 1024,
  staff_document: 15 * 1024 * 1024,
  student_document: 15 * 1024 * 1024,
  school_document: 20 * 1024 * 1024,
  candidate_photo: 5 * 1024 * 1024,
  candidate_resume: 15 * 1024 * 1024,
  candidate_document: 15 * 1024 * 1024,
  school_logo: 5 * 1024 * 1024,
  school_banner: 10 * 1024 * 1024,
  signature: 2 * 1024 * 1024,
  generated_pdf: 50 * 1024 * 1024,
  import_excel: 25 * 1024 * 1024,
  import_zip: 100 * 1024 * 1024,
};

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
