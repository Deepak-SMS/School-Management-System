"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Download } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/loading-state";
import { toCsv, downloadCsv } from "@/lib/csv";
import { whatsappMessageService, type WhatsAppMessageRecord } from "@/services/whatsappMessageService";

const STATUS_VARIANT: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  SENT: "success",
  FAILED: "danger",
  PENDING: "neutral",
  PROCESSING: "warning",
  RETRYING: "warning",
  CANCELLED: "neutral",
  SKIPPED: "neutral",
  INVALID_NUMBER: "danger",
  OPTED_OUT: "neutral",
};

const STATUS_OPTIONS = ["SENT", "FAILED", "PENDING", "PROCESSING", "RETRYING", "CANCELLED", "SKIPPED", "INVALID_NUMBER", "OPTED_OUT"];

export default function WhatsAppHistoryPage() {
  const [messages, setMessages] = useState<WhatsAppMessageRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await whatsappMessageService.search({ q: q || undefined, status: status || undefined, pageSize: 100 });
      setMessages(result.data);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  function exportCsv() {
    const csv = toCsv(messages, [
      { header: "Recipient", value: (m) => m.recipientName },
      { header: "Phone", value: (m) => m.phoneE164 },
      { header: "Campaign", value: (m) => m.campaign?.name ?? "" },
      { header: "Status", value: (m) => m.status },
      { header: "Sent At", value: (m) => m.sentAt ?? "" },
      { header: "Error", value: (m) => m.lastError ?? "" },
    ]);
    downloadCsv("whatsapp-message-history.csv", csv);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <Breadcrumb items={[{ label: "Communication", href: "/communication/whatsapp" }, { label: "WhatsApp", href: "/communication/whatsapp" }, { label: "History" }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Message History</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} messages across every campaign.</p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={messages.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input leadingIcon={<Search />} placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : messages.length === 0 ? (
        <EmptyState title="No messages found" description="Adjust your filters, or send your first campaign." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.recipientName}</TableCell>
                <TableCell>{m.phoneE164}</TableCell>
                <TableCell>
                  <Link href={`/communication/whatsapp/campaigns/${m.campaignId}`} className="text-primary-600 hover:underline">
                    {m.campaign?.name ?? "—"}
                  </Link>
                </TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[m.status] ?? "neutral"}>{m.status.replace("_", " ")}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{m.sentAt ? new Date(m.sentAt).toLocaleString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
