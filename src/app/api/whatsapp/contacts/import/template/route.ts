import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { buildContactImportTemplate } from "@/lib/whatsapp/contact-import";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(_request: NextRequest) {
  try {
    await requirePermission("whatsappContacts", "import");
    const buffer = await buildContactImportTemplate();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="whatsapp-contacts-template.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
