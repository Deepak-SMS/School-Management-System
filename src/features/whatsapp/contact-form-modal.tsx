"use client";

import { useEffect, useState } from "react";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { whatsappContactService, type WhatsAppContactRecord } from "@/services/whatsappContactService";

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: WhatsAppContactRecord | null;
  onSaved: () => void;
}

export function ContactFormModal({ open, onOpenChange, contact, onSaved }: ContactFormModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setName(contact?.name ?? "");
    setPhone(contact?.phoneE164 ?? "");
    setTags(contact ? (JSON.parse(contact.tagsJson ?? "[]") as string[]).join(", ") : "");
    setNotes(contact?.notes ?? "");
    setErrors({});
  }, [open, contact]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const input = { name, phone, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), notes: notes || undefined };
    try {
      if (contact) await whatsappContactService.update(contact.id, input);
      else await whatsappContactService.create(input);
      toast({ title: contact ? "Contact updated" : "Contact added", variant: "success" });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      const apiErr = err as { error?: string; fieldErrors?: Record<string, string[]> };
      if (apiErr.fieldErrors) setErrors(Object.fromEntries(Object.entries(apiErr.fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])));
      toast({ title: "Couldn't save contact", description: apiErr.error, variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title={contact ? "Edit Contact" : "Add Contact"} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Name" required error={errors.name}>
            {(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} required />}
          </FormField>
          <FormField label="WhatsApp number" required error={errors.phone} description="e.g. 9876543210 or +919876543210">
            {(f) => <Input {...f} value={phone} onChange={(e) => setPhone(e.target.value)} required />}
          </FormField>
          <FormField label="Tags" description="Comma-separated, e.g. alumni, donor">
            {(f) => <Input {...f} value={tags} onChange={(e) => setTags(e.target.value)} />}
          </FormField>
          <FormField label="Notes">
            {(f) => <Textarea {...f} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />}
          </FormField>
          <ModalFooter className="-mx-5 -mb-4 mt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {contact ? "Save changes" : "Add contact"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
