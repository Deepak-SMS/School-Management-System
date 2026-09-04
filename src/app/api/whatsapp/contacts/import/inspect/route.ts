import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { inspectWorkbook } from "@/lib/whatsapp/contact-import";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Step 1: read headers + a few sample rows so the UI can render the column-mapping step. Writes nothing. */
export async function POST(request: NextRequest) {
  try {
    await requirePermission("whatsappContacts", "import");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File is too large. Maximum size is 5 MB." }, { status: 422 });

    let inspected;
    try {
      inspected = await inspectWorkbook(Buffer.from(await file.arrayBuffer()));
    } catch {
      return NextResponse.json({ error: "That file couldn't be read as an Excel workbook. Save it as .xlsx and try again." }, { status: 422 });
    }
    if (inspected.headers.length === 0) {
      return NextResponse.json({ error: "The workbook has no recognizable header row." }, { status: 422 });
    }

    return NextResponse.json(inspected);
  } catch (error) {
    return apiError(error);
  }
}
