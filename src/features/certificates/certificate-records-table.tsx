"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, FileDown, ShieldCheck, Ban, ScrollText } from "lucide-react";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

interface CertificateRow {
  id: string;
  certificateNumber: string;
  status: "generated" | "revoked" | "cancelled";
  issueDate: string;
  pdfUrl: string | null;
  certificateType: { name: string; category: string };
  template: { name: string };
  student: { firstName: string; lastName: string; admissionNumber: string; class?: { name: string } | null; section?: { name: string } | null } | null;
  staff: { fullName: string; employeeId: string; designation?: { name: string } | null } | null;
  generatedBy: { name: string } | null;
}

const STATUS_VARIANT: Record<string, "success" | "danger" | "neutral"> = {
  generated: "success",
  revoked: "danger",
  cancelled: "neutral",
};

export function CertificateRecordsTable() {
  const can = useCan();
  const [rows, setRows] = useState<CertificateRow[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [revoking, setRevoking] = useState<CertificateRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ ...(q ? { q } : {}), ...(status !== "all" ? { status } : {}) });
      fetch(`/api/certificates?${params}`)
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw body;
          return body;
        })
        .then((body) => {
          if (cancelled) return;
          setRows(body.data);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [q, status, reloadKey]);

  async function confirmRevoke() {
    if (!revoking || !reason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/certificates/${revoking.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({ title: "Certificate revoked", variant: "success" });
      setRevoking(null);
      setReason("");
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't revoke the certificate", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState description="Couldn't load certificates." onRetry={load} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input leadingIcon={<Search />} placeholder="Search name, admission/employee ID, or certificate no…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="generated">Issued</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
        {rows && <span className="text-sm text-muted-foreground">{rows.length} certificate{rows.length === 1 ? "" : "s"}</span>}
      </div>

      {!rows ? (
        <TableSkeleton rows={6} columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No certificates yet" description="Certificates you generate will show up here." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificate No.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const person = row.student ? `${row.student.firstName} ${row.student.lastName}` : row.staff?.fullName;
                const reference = row.student ? row.student.admissionNumber : row.staff?.employeeId;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.certificateNumber}</TableCell>
                    <TableCell>{row.certificateType.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{person}</span>
                        <span className="text-xs text-muted-foreground">{reference}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(row.issueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status] ?? "neutral"}>{row.status === "generated" ? "Issued" : row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {row.pdfUrl && (
                          <a href={row.pdfUrl} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm">
                              <FileDown className="size-4" /> PDF
                            </Button>
                          </a>
                        )}
                        {row.status === "generated" && can("certificates", "delete") && (
                          <Button variant="ghost" size="sm" onClick={() => setRevoking(row)}>
                            <Ban className="size-4" /> Revoke
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal open={Boolean(revoking)} onOpenChange={(v) => !v && setRevoking(null)}>
        <ModalContent title={`Revoke ${revoking?.certificateNumber ?? "certificate"}?`}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              The certificate stays on record as revoked — its verification page will show as invalid. This can&apos;t be undone from here.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Reason</label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this certificate being revoked?" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRevoking(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmRevoke} isLoading={busy} disabled={!reason.trim()}>
                <ShieldCheck className="size-4" /> Revoke certificate
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
