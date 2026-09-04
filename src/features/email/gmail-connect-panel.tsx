"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Unlink, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/loading-state";
import { useToast } from "@/hooks/use-toast";
import { gmailAccountService, type GmailStatus } from "@/services/gmailAccountService";

const STATUS_BADGE: Record<GmailStatus["status"], { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
  connected: { label: "Connected", variant: "success" },
  disconnected: { label: "Not connected", variant: "neutral" },
  reauth_required: { label: "Reauthorization required", variant: "danger" },
  error: { label: "Connection error", variant: "danger" },
};

export function GmailConnectPanel() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const refresh = useCallback(async () => {
    try {
      setStatus(await gmailAccountService.get());
    } catch {
      // transient
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Handles the redirect back from /api/email/gmail/callback (Google OAuth flow).
  useEffect(() => {
    if (searchParams.get("gmail_connected")) {
      toast({ title: "Gmail connected", variant: "success" });
      router.replace("/communication/email/settings");
      refresh();
    } else if (searchParams.get("gmail_error")) {
      toast({ title: "Couldn't connect Gmail", description: searchParams.get("gmail_error") ?? undefined, variant: "danger" });
      router.replace("/communication/email/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the query params changing, not to router/toast identity
  }, [searchParams]);

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    try {
      await fn();
      await refresh();
    } catch (err) {
      toast({ title: "Something went wrong", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Spinner /> Loading connection status…
        </CardContent>
      </Card>
    );
  }

  if (!status.configured) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 pt-6 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-500" />
          <div>
            <p className="font-medium text-foreground">Gmail isn't set up for this deployment yet</p>
            <p className="mt-1 text-muted-foreground">
              Add <code className="rounded bg-background px-1">GOOGLE_CLIENT_ID</code>, <code className="rounded bg-background px-1">GOOGLE_CLIENT_SECRET</code>, and{" "}
              <code className="rounded bg-background px-1">GOOGLE_REDIRECT_URI</code> to the environment first — see <code className="rounded bg-background px-1">docs/gmail-integration.md</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const badge = STATUS_BADGE[status.status];

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-muted-foreground" />
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        {status.connected ? (
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="size-4 text-accent-600" /> {status.email}
            </p>
            <p className="text-muted-foreground">{status.dailyMessageCount} emails sent today</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {status.status === "reauth_required"
              ? "Google authorization was revoked or expired — reconnect to keep sending campaigns."
              : "Connect a Gmail account to send email campaigns. You'll approve access on Google's own consent screen — no password is ever entered here."}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!status.connected && (
            <Button size="sm" onClick={() => gmailAccountService.connect()}>
              <Mail className="size-4" /> Connect Gmail
            </Button>
          )}
          {status.connected && (
            <>
              <Button size="sm" variant="secondary" onClick={() => run("test", () => gmailAccountService.test())} isLoading={busy === "test"}>
                Test Connection
              </Button>
              <Button size="sm" variant="outline" onClick={() => run("disconnect", () => gmailAccountService.disconnect())} isLoading={busy === "disconnect"}>
                <Unlink className="size-4" /> Disconnect Gmail
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => run("refresh", refresh)} isLoading={busy === "refresh"}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
