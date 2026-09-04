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
import { emailCampaignService, type EmailCampaignRecord, type EmailJobRecord } from "@/services/emailCampaignService";

const STATUS_VARIANT: Record<string, "neutral" | "warning" | "success" | "danger" | "info"> = {
  draft: "neutral",
  scheduled: "info",
  queued: "warning",
  processing: "warning",
  completed: "success",
  partially_completed: "warning",
  failed: "danger",
  cancelled: "danger",
  PENDING: "neutral",
  PROCESSING: "info",
  SENT: "success",
  FAILED: "danger",
  RETRYING: "warning",
  CANCELLED: "neutral",
  SKIPPED: "neutral",
  INVALID_RECIPIENT: "danger",
};

const QUEUE_STATUSES = ["PENDING", "PROCESSING", "RETRYING"];
const HISTORY_STATUSES = ["SENT", "FAILED", "CANCELLED", "SKIPPED", "INVALID_RECIPIENT"];

export function CampaignDetail({ id }: { id: string }) {
  const [campaign, setCampaign] = useState<EmailCampaignRecord | null>(null);
  const [queueJobs, setQueueJobs] = useState<EmailJobRecord[]>([]);
  const [historyJobs, setHistoryJobs] = useState<EmailJobRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const can = useCan();
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [c, jobs] = await Promise.all([emailCampaignService.get(id), emailCampaignService.jobs(id, { pageSize: 200 })]);
    setCampaign(c);
    setQueueJobs(jobs.data.filter((j) => QUEUE_STATUSES.includes(j.status)));
    setHistoryJobs(jobs.data.filter((j) => HISTORY_STATUSES.includes(j.status)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (campaign?.status !== "processing" && campaign?.status !== "queued") return;
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
  const canCancel = campaign.status === "processing" || campaign.status === "queued" || campaign.status === "scheduled";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{campaign.name}</h1>
          <Badge variant={STATUS_VARIANT[campaign.status]} className="mt-1 capitalize">{campaign.status.replace("_", " ")}</Badge>
        </div>
        <div className="flex gap-2">
          {canCancel && can("emailCampaigns", "edit") && (
            <Button variant="secondary" onClick={() => run("cancel", () => emailCampaignService.cancel(id))} isLoading={busy === "cancel"}>
              <Ban className="size-4" /> Cancel
            </Button>
          )}
          {campaign.failedCount > 0 && can("emailCampaigns", "edit") && (
            <Button variant="secondary" onClick={() => run("retry", () => emailCampaignService.retryFailed(id))} isLoading={busy === "retry"}>
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
          <Progress value={progressPct} tone={campaign.status === "cancelled" || campaign.status === "failed" ? "danger" : "primary"} label="Campaign progress" />
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Total: <strong className="text-foreground">{campaign.totalRecipients}</strong></span>
            <span className="text-accent-700">Sent: <strong>{campaign.sentCount}</strong></span>
            <span className="text-danger-600">Failed: <strong>{campaign.failedCount}</strong></span>
            <span className="text-muted-foreground">Invalid: <strong>{campaign.invalidCount}</strong></span>
            <span className="text-muted-foreground">Skipped: <strong>{campaign.skippedCount}</strong></span>
            <span className="text-muted-foreground">Cancelled: <strong>{campaign.cancelledCount}</strong></span>
          </div>
          {campaign.scheduledAt && campaign.status === "scheduled" && (
            <p className="text-sm text-muted-foreground">Scheduled to start {new Date(campaign.scheduledAt).toLocaleString()}.</p>
          )}
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
            emptyLabel="No emails have reached a final status yet."
            onRetry={can("emailCampaigns", "edit") ? (jobId) => run(`retry-${jobId}`, () => emailCampaignService.retryJob(id, jobId)) : undefined}
            busyId={busy}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobTable({ jobs, emptyLabel, onRetry, busyId }: { jobs: EmailJobRecord[]; emptyLabel: string; onRetry?: (jobId: string) => void; busyId?: string | null }) {
  if (jobs.length === 0) return <EmptyState title={emptyLabel} />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recipient</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Error</TableHead>
          {onRetry && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((j) => (
          <TableRow key={j.id}>
            <TableCell className="font-medium">{j.recipientName}</TableCell>
            <TableCell>{j.recipientEmail}</TableCell>
            <TableCell><Badge variant={STATUS_VARIANT[j.status] ?? "neutral"}>{j.status.replace("_", " ")}</Badge></TableCell>
            <TableCell className="max-w-xs truncate text-muted-foreground">{j.lastError}</TableCell>
            {onRetry && (
              <TableCell>
                {["FAILED", "INVALID_RECIPIENT"].includes(j.status) && (
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
