"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollText, CalendarCheck, ShieldCheck, Ban, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Stats {
  total: number;
  generatedThisYear: number;
  issued: number;
  revoked: number;
}

const TILES: { key: keyof Stats; label: string; icon: typeof ScrollText; tone: "primary" | "success" | "warning" | "danger" }[] = [
  { key: "total", label: "Total certificates", icon: ScrollText, tone: "primary" },
  { key: "generatedThisYear", label: "Generated this year", icon: CalendarCheck, tone: "primary" },
  { key: "issued", label: "Issued", icon: ShieldCheck, tone: "success" },
  { key: "revoked", label: "Revoked", icon: Ban, tone: "danger" },
];

const TONE_CLASSES: Record<string, string> = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-accent-50 text-accent-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
};

export default function CertificatesDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/certificates/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Certificate Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Types, templates, generation, and the certificate register — all in one place.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <Card key={tile.key}>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className={cn("flex size-10 items-center justify-center rounded-lg", TONE_CLASSES[tile.tone])}>
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{stats ? stats[tile.key] : "—"}</p>
                  <p className="text-xs text-muted-foreground">{tile.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink href="/certificates/types" title="Certificate Types" description="Define the certificates this school issues and their numbering prefixes." />
        <QuickLink href="/certificates/designer" title="Designer" description="Design the layout each certificate type prints with." />
        <QuickLink href="/certificates/generate" title="Generate Certificate" description="Issue a certificate for a student or staff member." />
        <QuickLink href="/certificates/generated" title="Generated Certificates" description="Search, download, and revoke issued certificates." />
      </div>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
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
