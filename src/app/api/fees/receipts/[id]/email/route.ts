import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { parseComponents } from "@/lib/fees/record-payment";
import { readBytesFromStoredUrl } from "@/lib/id-cards/card-assets";
import { renderReceiptPdf } from "@/lib/pdf/render-receipt-pdf";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants/payments";
import { sendMail, isMailConfigured, MailNotConfiguredError } from "@/lib/mail";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const bodySchema = z.object({
  /** Defaults to the student's parent email when omitted. */
  to: z.string().trim().email("That isn't a valid email address").optional(),
  message: z.string().trim().max(1000).optional(),
});

/** Emails the receipt PDF to a parent. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("receipts", "export");
    const { id } = await params;

    if (!isMailConfigured()) throw new MailNotConfiguredError();

    const receipt = await prisma.receipt.findFirst({ where: { id, schoolId: user.schoolId } });
    if (!receipt) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

    const body = bodySchema.parse(await request.json().catch(() => ({})));

    // Fall back to the address already on the student record, then to whichever
    // guardian is flagged as the main contact.
    let to = body.to;
    if (!to) {
      const student = await prisma.student.findUnique({
        where: { id: receipt.studentId },
        select: {
          parentEmail: true,
          guardians: {
            where: { isPrimary: true },
            select: { guardian: { select: { email: true } } },
            take: 1,
          },
        },
      });
      to = student?.parentEmail ?? student?.guardians[0]?.guardian.email ?? undefined;
    }

    if (!to) {
      return NextResponse.json(
        { error: "No parent email is on file for this student. Add one, or type an address to send to." },
        { status: 422 },
      );
    }

    if (receipt.status === "void") {
      return NextResponse.json(
        { error: "This receipt has been voided and can't be sent to a parent." },
        { status: 409 },
      );
    }

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
      logoBytes,
    });

    const amount = receipt.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 });
    const lines = [
      `Dear Parent / Guardian,`,
      ``,
      `Thank you. We have received Rs. ${amount} towards fees for ${receipt.studentName} (${receipt.admissionNumber}).`,
      `Receipt number ${receipt.receiptNumber}, dated ${receipt.paidOn.toLocaleDateString("en-IN")}.`,
      `Balance outstanding: Rs. ${receipt.balanceAfter.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`,
      ``,
      ...(body.message ? [body.message, ``] : []),
      `The official receipt is attached.`,
      ``,
      receipt.schoolName,
    ];

    await sendMail({
      to,
      fromName: receipt.schoolName,
      subject: `Fee receipt ${receipt.receiptNumber} — ${receipt.studentName}`,
      text: lines.join("\n"),
      attachments: [
        {
          filename: `${receipt.receiptNumber.replace(/[^A-Za-z0-9._-]/g, "-")}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });

    const updated = await prisma.$transaction(async (tx) => {
      // emailedAt/emailedTo are the only fields on a receipt that ever change
      // after issue, and they record delivery rather than alter the document.
      const row = await tx.receipt.update({
        where: { id: receipt.id },
        data: { emailedAt: new Date(), emailedTo: to },
      });
      await recordAudit(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: "fees.receipt.email",
        entityType: "Receipt",
        entityId: receipt.id,
        after: { receiptNumber: receipt.receiptNumber, to },
      });
      return row;
    });

    return NextResponse.json({ sentTo: to, emailedAt: updated.emailedAt });
  } catch (error) {
    if (error instanceof MailNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return apiError(error);
  }
}
