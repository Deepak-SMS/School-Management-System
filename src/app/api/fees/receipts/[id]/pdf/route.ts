import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { parseComponents } from "@/lib/fees/record-payment";
import { readBytesFromStoredUrl } from "@/lib/id-cards/card-assets";
import { renderReceiptPdf } from "@/lib/pdf/render-receipt-pdf";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants/payments";
import { apiError } from "@/lib/api-error";

/**
 * The printable receipt.
 *
 * `?download=1` forces a save; without it the PDF opens inline, which is what
 * the browser's own print dialog needs — so Print and Download are the same
 * document, not two renderings that could drift.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("receipts", "export");
    const { id } = await params;

    const receipt = await prisma.receipt.findFirst({
      where: { id, schoolId },
      include: { payment: { select: { bankName: true } } },
    });
    if (!receipt) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

    const issuer = receipt.issuedById
      ? await prisma.user.findUnique({ where: { id: receipt.issuedById }, select: { name: true } })
      : null;

    // The logo the receipt was issued under, not whatever the school uses today.
    const logoBytes = await readBytesFromStoredUrl(receipt.schoolLogoUrl);

    const pdf = await renderReceiptPdf({
      receiptNumber: receipt.receiptNumber,
      issuedOn: receipt.issuedOn,
      status: receipt.status,
      voidReason: receipt.voidReason,

      schoolName: receipt.schoolName,
      schoolAddress: receipt.schoolAddress,
      schoolPhone: receipt.schoolPhone,
      schoolEmail: receipt.schoolEmail,

      studentName: receipt.studentName,
      admissionNumber: receipt.admissionNumber,
      className: receipt.className,
      sectionName: receipt.sectionName,
      academicYear: receipt.academicYear,

      amountPaid: receipt.amountPaid,
      methodLabel: PAYMENT_METHOD_LABELS[receipt.method as PaymentMethod] ?? receipt.method,
      referenceNo: receipt.referenceNo,
      invoiceRef: receipt.invoiceRef,
      paidOn: receipt.paidOn,
      balanceAfter: receipt.balanceAfter,
      components: parseComponents(receipt.componentsJson),

      receivedBy: issuer?.name ?? null,
      logoBytes,
    });

    const download = request.nextUrl.searchParams.get("download") === "1";
    const fileName = `${receipt.receiptNumber.replace(/[^A-Za-z0-9._-]/g, "-")}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
