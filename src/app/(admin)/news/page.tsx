"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Newspaper, Send, Archive, FileEdit, CalendarClock, Pin, Tags, MessageSquare } from "lucide-react";
import { newsService } from "@/services/newsService";
import type { NewsDashboardStats, NewsRecord } from "@/types/news";
import { NEWS_STATUS_LABELS } from "@/lib/constants/news";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

const statusVariant: Record<string, "success" | "neutral" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  scheduled: "info",
  published: "success",
  expired: "warning",
  archived: "neutral",
  cancelled: "danger",
};

export default function NewsDashboardPage() {
  const [stats, setStats] = useState<NewsDashboardStats | null>(null);
  const [pinned, setPinned] = useState<NewsRecord[] | null>(null);
  const [recent, setRecent] = useState<NewsRecord[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    newsService.stats().then(setStats).catch(() => setError(true));
    newsService.list({ priority: "pinned", pageSize: 5 }).then((r) => setPinned(r.data));
    newsService.list({ pageSize: 8 }).then((r) => setRecent(r.data));
  }

  useEffect(load, []);

  if (error) return <ErrorState className="mx-auto max-w-6xl px-6 py-16" onRetry={load} />;
  if (!stats) return <LoadingState className="mx-auto max-w-6xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "News Management", href: "/news" }, { label: "Dashboard" }]} />
          <h1 className="mt-2 text-xl font-semibold text-foreground">News Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">The school's digital bulletin board — announcements, notices, and circulars.</p>
        </div>
        <Button asChild>
          <Link href="/news/new">
            <Plus className="size-4" /> Create News
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total news" value={stats.total} icon={Newspaper} />
        <StatCard label="Published" value={stats.published} icon={Send} tone="success" />
        <StatCard label="Scheduled" value={stats.scheduled} icon={CalendarClock} tone="warning" />
        <StatCard label="Drafts" value={stats.drafts} icon={FileEdit} />
        <StatCard label="Archived" value={stats.archived} icon={Archive} />
        <StatCard label="Pinned" value={stats.pinned} icon={Pin} tone="danger" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href="/news/all">
            <Newspaper className="size-4" /> All News
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/news/all?status=draft">
            <FileEdit className="size-4" /> Drafts
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/news/all?status=scheduled">
            <CalendarClock className="size-4" /> Scheduled
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/news/categories">
            <Tags className="size-4" /> Categories
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/news/comments">
            <MessageSquare className="size-4" /> Comments &amp; Moderation
          </Link>
        </Button>
      </div>

      {pinned && pinned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Pin className="size-4" /> Pinned &amp; Urgent
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pinned.map((n) => (
              <Link key={n.id} href={`/news/${n.id}`} className="flex items-center justify-between rounded-md border border-danger-200 bg-danger-50/50 px-3 py-2 text-sm hover:bg-danger-50 dark:border-danger-900/40 dark:bg-danger-500/[.06]">
                <span className="font-medium text-foreground">{n.title}</span>
                <Badge variant={statusVariant[n.status] ?? "neutral"}>{NEWS_STATUS_LABELS[n.status as keyof typeof NEWS_STATUS_LABELS] ?? n.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        {!recent ? (
          <LoadingState className="py-8" />
        ) : recent.length === 0 ? (
          <EmptyState icon={Newspaper} title="No news yet" description="Create your first announcement to get started." className="py-12" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <Link href={`/news/${n.id}`} className="font-medium text-foreground hover:underline">
                      {n.title}
                    </Link>
                  </TableCell>
                  <TableCell>{n.category?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[n.status] ?? "neutral"}>{NEWS_STATUS_LABELS[n.status as keyof typeof NEWS_STATUS_LABELS] ?? n.status}</Badge>
                  </TableCell>
                  <TableCell>{n.viewCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
