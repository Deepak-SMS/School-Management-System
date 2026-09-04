import type { ApiError } from "@/services/studentService";
import type { EmailRecipientImportMappingInput } from "@/lib/validation/email-recipient-import";
import type { InspectedRecipientWorkbook, RecipientImportValidateResult } from "@/lib/email-campaigns/recipient-import";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const emailRecipientImportService = {
  async inspect(file: File): Promise<InspectedRecipientWorkbook> {
    const form = new FormData();
    form.append("file", file);
    return parseOrThrow(await fetch("/api/email/import/inspect", { method: "POST", body: form }));
  },
  async validate(file: File, mapping: EmailRecipientImportMappingInput): Promise<RecipientImportValidateResult> {
    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    return parseOrThrow(await fetch("/api/email/import/validate", { method: "POST", body: form }));
  },
  async downloadTemplate(): Promise<void> {
    const response = await fetch("/api/email/import/template");
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "The download failed." }));
      throw body as ApiError;
    }
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "email-recipients-template.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  },
};
