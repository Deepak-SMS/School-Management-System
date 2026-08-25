"use client";

import { useState } from "react";
import { ASSIGNABLE_ROLES, ASSIGNABLE_ROLE_LABELS, ASSIGNABLE_ROLE_HINTS } from "@/config/roles-assignable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { OrgPerson } from "@/features/organization/organization-chart";
import type { ApiError } from "@/services/studentService";

/**
 * Grants, changes or revokes an employee's login.
 *
 * A login is a deliberate act, not a side effect of employing someone — most
 * staff never sign in, and an unwatched account is a liability. The role's reach
 * is spelled out beside the choice so it isn't picked blind.
 */
export function AccessDialog({
  person,
  onClose,
  onSaved,
}: {
  person: OrgPerson;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<string>(person.access?.role ?? "teacher");
  const [email, setEmail] = useState(person.access?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/organization/staff/${person.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, email, temporaryPassword: password || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw body;

      toast({
        title: person.access ? "Access updated" : "Access granted",
        description: `${person.name} · ${ASSIGNABLE_ROLE_LABELS[role as keyof typeof ASSIGNABLE_ROLE_LABELS]}`,
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
      const response = await fetch(`/api/organization/staff/${person.id}/access`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({ title: `Access revoked for ${person.name}`, variant: "success" });
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
          title={person.access ? `Access for ${person.name}` : `Grant access to ${person.name}`}
          description={`${person.employeeId}${person.designation ? ` · ${person.designation}` : ""}`}
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
                  placeholder="name@school.example"
                />
              )}
            </FormField>

            <FormField label="Role" required description={ASSIGNABLE_ROLE_HINTS[role as keyof typeof ASSIGNABLE_ROLE_HINTS]}>
              {(f) => (
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id={f.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ASSIGNABLE_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField
              label={person.access ? "Reset password" : "Temporary password"}
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

            {role === "school_admin" && (
              <Alert variant="warning" title="School Admin sees everything">
                Including salary, bank details and the ability to change other people&apos;s roles.
              </Alert>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {person.access && (
                <Button variant="secondary" onClick={() => setRevoking(true)} disabled={busy}>
                  Revoke access
                </Button>
              )}
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={save} isLoading={busy} disabled={!email.trim()}>
                {person.access ? "Save changes" : "Grant access"}
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={revoking}
        onOpenChange={setRevoking}
        title={`Revoke access for ${person.name}?`}
        description="They stay on staff and keep their record; only the login and any active sessions are removed."
        confirmLabel="Revoke access"
        variant="destructive"
        isLoading={busy}
        onConfirm={revoke}
      />
    </>
  );
}
