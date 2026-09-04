"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Upload, Search, MoreVertical, Ban } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/loading-state";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useCan } from "@/hooks/use-can";
import { whatsappContactService, type WhatsAppContactRecord } from "@/services/whatsappContactService";
import { ContactFormModal } from "@/features/whatsapp/contact-form-modal";
import { ContactImportWizard } from "@/features/whatsapp/contact-import-wizard";

export default function WhatsAppContactsPage() {
  const [contacts, setContacts] = useState<WhatsAppContactRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppContactRecord | null>(null);
  const can = useCan();
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await whatsappContactService.list({ q: q || undefined, pageSize: 50 });
      setContacts(result.data);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  async function handleOptOut(contact: WhatsAppContactRecord) {
    try {
      await whatsappContactService.optOut(contact.id);
      toast({ title: "Contact opted out", description: "They'll be skipped by every future campaign.", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Couldn't update contact", description: (err as { error?: string }).error, variant: "danger" });
    }
  }

  async function handleDelete(contact: WhatsAppContactRecord) {
    try {
      const result = await whatsappContactService.remove(contact.id);
      toast({ title: result.deactivated ? "Contact deactivated" : "Contact deleted", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Couldn't remove contact", description: (err as { error?: string }).error, variant: "danger" });
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <Breadcrumb items={[{ label: "Communication", href: "/communication/whatsapp" }, { label: "WhatsApp", href: "/communication/whatsapp" }, { label: "Contacts" }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">WhatsApp Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} contacts in the address book.</p>
        </div>
        <div className="flex gap-2">
          {can("whatsappContacts", "import") && (
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Import
            </Button>
          )}
          {can("whatsappContacts", "create") && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="size-4" /> Add Contact
            </Button>
          )}
        </div>
      </div>

      <Input leadingIcon={<Search />} placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      {loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : contacts.length === 0 ? (
        <EmptyState title="No contacts yet" description="Add a contact manually or import a list from Excel." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phoneE164}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{c.source.replace("_", " ")}</TableCell>
                <TableCell>{c.optedOut ? <Badge variant="danger">Opted out</Badge> : <Badge variant="success">Active</Badge>}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="size-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setEditing(c); setFormOpen(true); }}>Edit</DropdownMenuItem>
                      {!c.optedOut && (
                        <DropdownMenuItem onSelect={() => handleOptOut(c)}>
                          <Ban className="size-4" /> Mark opted out
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => handleDelete(c)} className="text-danger-600">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ContactFormModal open={formOpen} onOpenChange={setFormOpen} contact={editing} onSaved={load} />
      <ContactImportWizard open={importOpen} onOpenChange={setImportOpen} onImported={load} />
    </div>
  );
}
