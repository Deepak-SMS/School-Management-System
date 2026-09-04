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
import { emailCampaignService, type EmailCampaignRecord } from "@/services/emailCampaignService";

const STATUS_VARIANT: Record<string, "neutral" | "warning" | "success" | "danger" | "info"> = {
  draft: "neutral",
  scheduled: "info",
  queued: "warning",
  processing: "warning",
  completed: "success",
  partially_completed: "warning",
  failed: "danger",
  cancelled: "danger",
};

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const can = useCan();

  useEffect(() => {
    emailCampaignService.list().then((r) => setCampaigns(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <Breadcrumb items={[{ label: "Communication", href: "/communication/email" }, { label: "Email", href: "/communication/email" }, { label: "Campaigns" }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every email campaign, draft through completed.</p>
        </div>
        {can("emailCampaigns", "create") && (
          <Link href="/communication/email/campaigns/new">
            <Button><Plus className="size-4" /> New Campaign</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Create your first email campaign." />
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
                  <Link href={`/communication/email/campaigns/${c.id}`} className="hover:underline">{c.name}</Link>
                </TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[c.status] ?? "neutral"} className="capitalize">{c.status.replace("_", " ")}</Badge></TableCell>
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
