"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Users, Send, FileText, History, Inbox, ArrowRight } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConnectPanel } from "@/features/whatsapp/connect-panel";
import { whatsappAccountService } from "@/services/whatsappAccountService";
import { whatsappContactService } from "@/services/whatsappContactService";
import { whatsappCampaignService } from "@/services/whatsappCampaignService";

export default function WhatsAppDashboardPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [messagesToday, setMessagesToday] = useState(0);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [activeCampaigns, setActiveCampaigns] = useState<number | null>(null);

  useEffect(() => {
    whatsappAccountService.get().then((s) => {
      setConnected(s.status === "connected");
      setMessagesToday(s.dailyMessageCount);
    }).catch(() => undefined);
    whatsappContactService.list({ pageSize: 1 }).then((r) => setContactCount(r.total)).catch(() => undefined);
    whatsappCampaignService.list({ status: "sending" }).then((r) => setActiveCampaigns(r.total)).catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <Breadcrumb items={[{ label: "Communication", href: "/communication/whatsapp" }, { label: "WhatsApp" }]} />

      <div>
        <h1 className="text-xl font-semibold text-foreground">WhatsApp Communication</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect a WhatsApp number, build an address book, and send personalized bulk campaigns.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Connection" value={connected === null ? "—" : connected ? "Connected" : "Not connected"} icon={MessageCircle} tone={connected ? "success" : "neutral"} />
        <StatCard label="Messages today" value={messagesToday} icon={Send} tone="primary" />
        <StatCard label="Contacts" value={contactCount ?? "—"} icon={Users} tone="primary" />
        <StatCard label="Active campaigns" value={activeCampaigns ?? "—"} icon={FileText} tone="warning" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="connect">Connect</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink href="/communication/whatsapp/campaigns/new" title="Create Campaign" description="Build a personalized bulk send in a few steps." icon={Send} />
            <QuickLink href="/communication/whatsapp/contacts" title="Contacts" description="Manage the WhatsApp address book and imports." icon={Users} />
            <QuickLink href="/communication/whatsapp/templates" title="Message Templates" description="Reusable messages with {{variables}}." icon={FileText} />
            <QuickLink href="/communication/whatsapp/inbox" title="Inbox" description="Real conversations and replies on the connected number." icon={Inbox} />
            <QuickLink href="/communication/whatsapp/history" title="Message History" description="Every message sent, with status and retry." icon={History} />
          </div>
        </TabsContent>

        <TabsContent value="connect">
          <ConnectPanel />
        </TabsContent>
      </Tabs>
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
