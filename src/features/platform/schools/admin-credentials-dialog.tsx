"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { CreatedSchoolAdmin } from "@/types/platform";

/** Shows a freshly-issued login once — the same "copy it now" pattern used right after creating a school. */
export function AdminCredentialsDialog({ admin, onClose }: { admin: CreatedSchoolAdmin; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyCredentials() {
    const text = `Login ID: ${admin.email}\nTemporary password: ${admin.temporaryPassword}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title="New password generated"
        description={`Share this with ${admin.name} — it's shown once and can't be retrieved again.`}
      >
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Login ID</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{admin.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Temporary password</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{admin.temporaryPassword}</dd>
            </div>
          </dl>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={copyCredentials}>
              <Copy className="size-4" /> {copied ? "Copied" : "Copy credentials"}
            </Button>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
