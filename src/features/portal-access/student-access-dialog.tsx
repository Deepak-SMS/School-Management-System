"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

export interface StudentAccountRow {
  id: string;
  firstName: string;
  lastName: string;
  class?: { name: string };
  section?: { name: string } | null;
  user: { id: string; email: string; isActive: boolean; mustChangePassword: boolean } | null;
}

/**
 * Grants, changes, or revokes a student's portal login.
 *
 * Same shape as the staff AccessDialog (src/features/organization/access-dialog.tsx),
 * trimmed down: the role is always "student", so there's no role picker.
 */
export function StudentAccessDialog({
  student,
  onClose,
  onSaved,
}: {
  student: StudentAccountRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(student.user?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const name = `${student.firstName} ${student.lastName}`;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/students/${student.id}/portal-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, temporaryPassword: password || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw body;

      toast({ title: student.user ? "Access updated" : "Access granted", description: name, variant: "success" });
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
      const response = await fetch(`/api/students/${student.id}/portal-access`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({ title: `Access revoked for ${name}`, variant: "success" });
      onSaved();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't revoke access", variant: "danger" });
    } finally {
      setBusy(false);
      setRevoking(false);
    }
  }

  return (
    <>
      <Modal open onOpenChange={(v) => !v && onClose()}>
        <ModalContent
          title={student.user ? `Access for ${name}` : `Grant portal access to ${name}`}
          description="Student — sees only their own attendance, timetable, and certificates."
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
                  placeholder="student@school.example"
                />
              )}
            </FormField>

            <FormField
              label={student.user ? "Reset password" : "Temporary password"}
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

            <div className="flex flex-wrap justify-end gap-2">
              {student.user && (
                <Button variant="secondary" onClick={() => setRevoking(true)} disabled={busy}>
                  Revoke access
                </Button>
              )}
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={save} isLoading={busy} disabled={!email.trim()}>
                {student.user ? "Save changes" : "Grant access"}
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={revoking}
        onOpenChange={setRevoking}
        title={`Revoke access for ${name}?`}
        description="Their record stays; only the login and any active sessions are removed."
        confirmLabel="Revoke access"
        variant="destructive"
        isLoading={busy}
        onConfirm={revoke}
      />
    </>
  );
}
