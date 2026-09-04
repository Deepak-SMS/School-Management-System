"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, RotateCcw, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/hooks/use-toast";
import { useCan } from "@/hooks/use-can";
import { whatsappCampaignService, type WhatsAppCampaignRecord, type WhatsAppMessageJobRecord } from "@/services/whatsappCampaignService";

const STATUS_VARIANT: Record<string, "neutral" | "warning" | "success" | "danger" | "info"> = {
  draft: "neutral",
  sending: "warning",
  completed: "success",
  cancelled: "danger",
  PENDING: "neutral",
  PROCESSING: "info",
  SENT: "success",
  FAILED: "danger",
  RETRYING: "warning",
  CANCELLED: "neutral",
  SKIPPED: "neutral",
  INVALID_NUMBER: "danger",
  OPTED_OUT: "neutral",
};

const QUEUE_STATUSES = ["PENDING", "PROCESSING", "RETRYING"];
const HISTORY_STATUSES = ["SENT", "FAILED", "CANCELLED", "SKIPPED", "INVALID_NUMBER", "OPTED_OUT"];

export function CampaignDetail({ id }: { id: string }) {
  const [campaign, setCampaign] = useState<WhatsAppCampaignRecord | null>(null);
  const [queueJobs, setQueueJobs] = useState<WhatsAppMessageJobRecord[]>([]);
  const [historyJobs, setHistoryJobs] = useState<WhatsAppMessageJobRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const can = useCan();
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [c, jobs] = await Promise.all([whatsappCampaignService.get(id), whatsappCampaignService.jobs(id, { pageSize: 200 })]);
    setCampaign(c);
    setQueueJobs(jobs.data.filter((j) => QUEUE_STATUSES.includes(j.status)));
    setHistoryJobs(jobs.data.filter((j) => HISTORY_STATUSES.includes(j.status)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (campaign?.status !== "sending") return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [campaign?.status, load]);

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    try {
      await fn();
      await load();
    } catch (err) {
      toast({ title: "Something went wrong", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  if (!campaign) return <LoadingState />;

  const progressPct = campaign.totalRecipients > 0 ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalRecipients) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{campaign.name}</h1>
          <Badge variant={STATUS_VARIANT[campaign.status]} className="mt-1 capitalize">{campaign.status}</Badge>
        </div>
        <div className="flex gap-2">
          {campaign.status === "sending" && can("whatsappCampaigns", "edit") && (
            <Button variant="secondary" onClick={() => run("cancel", () => whatsappCampaignService.cancel(id))} isLoading={busy === "cancel"}>
              <Ban className="size-4" /> Cancel
            </Button>
          )}
          {campaign.failedCount > 0 && can("whatsappCampaigns", "edit") && (
            <Button variant="secondary" onClick={() => run("retry", () => whatsappCampaignService.retryFailed(id))} isLoading={busy === "retry"}>
              <RotateCcw className="size-4" /> Retry Failed
            </Button>
          )}
          <Button variant="ghost" onClick={() => run("refresh", load)} isLoading={busy === "refresh"}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <Progress value={progressPct} tone={campaign.status === "cancelled" ? "danger" : "primary"} label="Campaign progress" />
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Total: <strong className="text-foreground">{campaign.totalRecipients}</strong></span>
            <span className="text-accent-700">Sent: <strong>{campaign.sentCount}</strong></span>
            <span className="text-danger-600">Failed: <strong>{campaign.failedCount}</strong></span>
            <span className="text-muted-foreground">Invalid: <strong>{campaign.invalidNumberCount}</strong></span>
            <span className="text-muted-foreground">Opted out: <strong>{campaign.optedOutCount}</strong></span>
            <span className="text-muted-foreground">Skipped: <strong>{campaign.skippedCount}</strong></span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Message Queue ({queueJobs.length})</TabsTrigger>
          <TabsTrigger value="history">History ({historyJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <JobTable jobs={queueJobs} emptyLabel="Nothing in the queue right now." />
        </TabsContent>

        <TabsContent value="history">
          <JobTable
            jobs={historyJobs}
            emptyLabel="No messages have reached a final status yet."
            onRetry={can("whatsappCampaigns", "edit") ? (jobId) => run(`retry-${jobId}`, () => whatsappCampaignService.retryJob(id, jobId)) : undefined}
            busyId={busy}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobTable({ jobs, emptyLabel, onRetry, busyId }: { jobs: WhatsAppMessageJobRecord[]; emptyLabel: string; onRetry?: (jobId: string) => void; busyId?: string | null }) {
  if (jobs.length === 0) return <EmptyState title={emptyLabel} />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recipient</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Error</TableHead>
          {onRetry && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((j) => (
          <TableRow key={j.id}>
            <TableCell className="font-medium">{j.recipientName}</TableCell>
            <TableCell>{j.phoneE164}</TableCell>
            <TableCell><Badge variant={STATUS_VARIANT[j.status] ?? "neutral"}>{j.status.replace("_", " ")}</Badge></TableCell>
            <TableCell className="max-w-xs truncate text-muted-foreground">{j.lastError}</TableCell>
            {onRetry && (
              <TableCell>
                {["FAILED", "INVALID_NUMBER"].includes(j.status) && (
                  <Button size="sm" variant="ghost" onClick={() => onRetry(j.id)} isLoading={busyId === `retry-${j.id}`}>Retry</Button>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
