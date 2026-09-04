"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCan } from "@/hooks/use-can";
import { whatsappCampaignService, type WhatsAppCampaignRecord } from "@/services/whatsappCampaignService";

const STATUS_VARIANT: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  sending: "warning",
  completed: "success",
  cancelled: "danger",
};

export default function WhatsAppCampaignsPage() {
  const [campaigns, setCampaigns] = useState<WhatsAppCampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const can = useCan();

  useEffect(() => {
    whatsappCampaignService.list().then((r) => setCampaigns(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <Breadcrumb items={[{ label: "Communication", href: "/communication/whatsapp" }, { label: "WhatsApp", href: "/communication/whatsapp" }, { label: "Campaigns" }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every WhatsApp bulk send, draft through completed.</p>
        </div>
        {can("whatsappCampaigns", "create") && (
          <Link href="/communication/whatsapp/campaigns/new">
            <Button><Plus className="size-4" /> New Campaign</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Create your first WhatsApp bulk campaign." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/communication/whatsapp/campaigns/${c.id}`} className="hover:underline">{c.name}</Link>
                </TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[c.status] ?? "neutral"} className="capitalize">{c.status}</Badge></TableCell>
                <TableCell>{c.totalRecipients}</TableCell>
                <TableCell>{c.sentCount}</TableCell>
                <TableCell>{c.failedCount}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
