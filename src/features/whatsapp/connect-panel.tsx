"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, Smartphone, Unlink, LogOut, RefreshCw, FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/loading-state";
import { useToast } from "@/hooks/use-toast";
import { whatsappAccountService, type WhatsAppAccountStatus } from "@/services/whatsappAccountService";

const POLL_MS = 3000;

const STATUS_BADGE: Record<WhatsAppAccountStatus["status"], { label: string; variant: "success" | "warning" | "neutral" | "danger" | "info" }> = {
  connected: { label: "Connected", variant: "success" },
  connecting: { label: "Waiting for scan…", variant: "warning" },
  disconnected: { label: "Disconnected", variant: "neutral" },
  logged_out: { label: "Logged out", variant: "neutral" },
  expired: { label: "Session expired", variant: "danger" },
};

export function ConnectPanel() {
  const [status, setStatus] = useState<WhatsAppAccountStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await whatsappAccountService.get();
      if (mounted.current) setStatus(data);
    } catch {
      // transient — the next poll tries again
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    try {
      await fn();
      await refresh();
    } catch (err) {
      toast({ title: "Something went wrong", description: err instanceof Error ? err.message : "Please try again.", variant: "danger" });
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

  const badge = STATUS_BADGE[status.status];

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row">
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {status.isSimulated && (
              <Badge variant="info">
                <FlaskConical className="size-3" /> Simulation Mode — no real WhatsApp messages are sent
              </Badge>
            )}
          </div>

          {status.status === "connected" ? (
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Smartphone className="size-4 text-muted-foreground" /> {status.phoneNumber}
              </p>
              <p className="text-muted-foreground">{status.displayName}</p>
              <p className="text-muted-foreground">{status.dailyMessageCount} messages sent today</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {status.status === "connecting"
                ? status.isSimulated
                  ? "This QR code is simulated for testing — scanning it with a real phone will not work. Click \"Simulate Scan Now\" below to simulate a successful connection."
                  : "Scan the QR code with WhatsApp to link this school's number."
                : "Connect a WhatsApp number to start sending campaigns."}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {status.status !== "connected" && status.status !== "connecting" && (
              <Button size="sm" onClick={() => run("connect", () => whatsappAccountService.connect())} isLoading={busy === "connect"}>
                <QrCode className="size-4" /> Connect WhatsApp
              </Button>
            )}
            {status.status === "connecting" && status.isSimulated && (
              <Button size="sm" variant="secondary" onClick={() => run("scan", () => whatsappAccountService.simulateScan())} isLoading={busy === "scan"}>
                <FlaskConical className="size-4" /> Simulate Scan Now
              </Button>
            )}
            {status.status === "connected" && (
              <>
                <Button size="sm" variant="secondary" onClick={() => run("disconnect", () => whatsappAccountService.disconnect())} isLoading={busy === "disconnect"}>
                  <Unlink className="size-4" /> Disconnect
                </Button>
                <Button size="sm" variant="outline" onClick={() => run("logout", () => whatsappAccountService.logout())} isLoading={busy === "logout"}>
                  <LogOut className="size-4" /> Logout
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => run("refresh", refresh)} isLoading={busy === "refresh"}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        </div>

        {status.status === "connecting" && status.qrCode && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, not an optimizable remote/local asset */}
            <img src={status.qrCode.dataUrl} alt={status.isSimulated ? "Simulated QR code — not a real WhatsApp login code" : "WhatsApp connection QR code"} className="size-40" />
            {status.isSimulated ? (
              <p className="max-w-40 text-center text-xs text-warning-600">Not a real WhatsApp code — your phone's WhatsApp app cannot use it.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Open WhatsApp → Linked Devices → Link a Device</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
