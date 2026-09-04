"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Send, FileText, History, Settings, ArrowRight } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { gmailAccountService } from "@/services/gmailAccountService";
import { emailCampaignService } from "@/services/emailCampaignService";

export default function EmailDashboardPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [messagesToday, setMessagesToday] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState<number | null>(null);
  const [totalCampaigns, setTotalCampaigns] = useState<number | null>(null);

  useEffect(() => {
    gmailAccountService.get().then((s) => {
      setConnected(s.connected);
      setMessagesToday(s.dailyMessageCount);
    }).catch(() => undefined);
    emailCampaignService.list({ status: "processing" }).then((r) => setActiveCampaigns(r.total)).catch(() => undefined);
    emailCampaignService.list().then((r) => setTotalCampaigns(r.total)).catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <Breadcrumb items={[{ label: "Communication", href: "/communication/email" }, { label: "Email" }]} />

      <div>
        <h1 className="text-xl font-semibold text-foreground">Email Campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect Gmail and send personalized bulk email campaigns to parents, students, and staff.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gmail connection" value={connected === null ? "—" : connected ? "Connected" : "Not connected"} icon={Mail} tone={connected ? "success" : "neutral"} />
        <StatCard label="Emails sent today" value={messagesToday} icon={Send} tone="primary" />
        <StatCard label="Active campaigns" value={activeCampaigns ?? "—"} icon={FileText} tone="warning" />
        <StatCard label="Total campaigns" value={totalCampaigns ?? "—"} icon={History} tone="primary" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/communication/email/campaigns/new" title="Create Campaign" description="Build a personalized bulk send in a few steps." icon={Send} />
        <QuickLink href="/communication/email/campaigns" title="Campaigns" description="Every email campaign, draft through completed." icon={History} />
        <QuickLink href="/communication/email/templates" title="Email Templates" description="Reusable messages with {{variables}}." icon={FileText} />
        <QuickLink href="/communication/email/settings" title="Gmail Settings" description="Connect or manage your school's Gmail account." icon={Settings} />
      </div>
    </div>
  );
}

function QuickLink({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: typeof Send }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href}>
          <Button variant="secondary" size="sm">
            Open <ArrowRight className="size-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
