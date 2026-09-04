"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

export interface GuardianAccountRow {
  id: string;
  fullName: string;
  user: { id: string; email: string; isActive: boolean; mustChangePassword: boolean } | null;
  students: {
    id: string;
    relationship: string;
    isPrimary: boolean;
    canAccessPortal: boolean;
    student: { id: string; firstName: string; lastName: string; class: { name: string }; section: { name: string } | null };
  }[];
}

/**
 * Grants, changes, or revokes a guardian's portal login, and controls which of
 * their linked children they may see once signed in — a login and "can see
 * this specific child" are separate grants (StudentGuardian.canAccessPortal),
 * so both live in one dialog rather than two places an admin has to remember.
 */
export function GuardianAccessDialog({
  guardian,
  onClose,
  onSaved,
}: {
  guardian: GuardianAccountRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(guardian.user?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [links, setLinks] = useState(guardian.students);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/guardians/${guardian.id}/portal-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, temporaryPassword: password || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw body;

      toast({
        title: guardian.user ? "Access updated" : "Access granted",
        description: guardian.fullName,
        variant: "success",
      });
      onSaved();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't update access.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      const response = await fetch(`/api/guardians/${guardian.id}/portal-access`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({ title: `Access revoked for ${guardian.fullName}`, variant: "success" });
      onSaved();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't revoke access", variant: "danger" });
    } finally {
      setBusy(false);
      setRevoking(false);
    }
  }

  async function toggleChild(linkId: string, next: boolean) {
    setLinkBusyId(linkId);
    try {
      const response = await fetch(`/api/student-guardians/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canAccessPortal: next }),
      });
      const body = await response.json();
      if (!response.ok) throw body;
      setLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, canAccessPortal: next } : l)));
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update portal access", variant: "danger" });
    } finally {
      setLinkBusyId(null);
    }
  }

  return (
    <>
      <Modal open onOpenChange={(v) => !v && onClose()}>
        <ModalContent
          title={guardian.user ? `Access for ${guardian.fullName}` : `Grant portal access to ${guardian.fullName}`}
          description="Parent — sees only the children below that are switched on."
        >
          <div className="flex flex-col gap-4">
            {error && <Alert variant="danger">{error}</Alert>}

            <FormField label="Sign-in email" required>
              {(f) => (
                <Input
                  {...f}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="parent@example.com"
                />
              )}
            </FormField>

            <FormField
              label={guardian.user ? "Reset password" : "Temporary password"}
              description="They'll be asked to change it on first sign-in. Leave blank to set one later."
            >
              {(f) => (
                <Input
                  {...f}
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              )}
            </FormField>

            {links.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border-strong p-3">
                <span className="text-xs font-medium text-muted-foreground">Can view in the portal</span>
                {links.map((link) => (
                  <div key={link.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {link.student.firstName} {link.student.lastName}
                      <span className="ml-1.5 text-muted-foreground">
                        · {link.student.class.name}
                        {link.student.section ? ` ${link.student.section.name}` : ""}
                      </span>
                    </span>
                    <Switch
                      checked={link.canAccessPortal}
                      disabled={linkBusyId === link.id}
                      onCheckedChange={(v) => toggleChild(link.id, v)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {guardian.user && (
                <Button variant="secondary" onClick={() => setRevoking(true)} disabled={busy}>
                  Revoke access
                </Button>
              )}
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={save} isLoading={busy} disabled={!email.trim()}>
                {guardian.user ? "Save changes" : "Grant access"}
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={revoking}
        onOpenChange={setRevoking}
        title={`Revoke access for ${guardian.fullName}?`}
        description="Their record stays; only the login and any active sessions are removed."
        confirmLabel="Revoke access"
        variant="destructive"
        isLoading={busy}
        onConfirm={revoke}
      />
    </>
  );
}
