"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Newspaper, Send } from "lucide-react";
import { newsService } from "@/services/newsService";
import { newsCategoryService } from "@/services/newsCategoryService";
import type { NewsListResponse } from "@/types/news";
import type { NewsCategoryRecord } from "@/types/newsCategory";
import { NEWS_STATUSES, NEWS_STATUS_LABELS, NEWS_PRIORITIES, NEWS_PRIORITY_LABELS } from "@/lib/constants/news";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const PAGE_SIZE = 20;

const statusVariant: Record<string, "success" | "neutral" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  scheduled: "info",
  published: "success",
  expired: "warning",
  archived: "neutral",
  cancelled: "danger",
};

export function NewsTable({ initialStatus }: { initialStatus?: string }) {
  const [result, setResult] = useState<NewsListResponse | null>(null);
  const [categories, setCategories] = useState<NewsCategoryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    newsCategoryService.list({ pageSize: 100 }).then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    newsService
      .list({ q: search || undefined, status: status || undefined, categoryId: categoryId || undefined, priority: priority || undefined, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load news articles."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, categoryId, priority, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  async function handlePublish(id: string) {
    setPublishingId(id);
    try {
      await newsService.publish(id);
      toast({ title: "Article published", variant: "success" });
      load();
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't publish", variant: "danger" });
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search news..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select value={status || "all"} onValueChange={(v) => { setPage(1); setStatus(v === "all" ? "" : v); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {NEWS_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {NEWS_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId || "all"} onValueChange={(v) => { setPage(1); setCategoryId(v === "all" ? "" : v); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority || "all"} onValueChange={(v) => { setPage(1); setPriority(v === "all" ? "" : v); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {NEWS_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {NEWS_PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button asChild className="ml-auto">
          <Link href="/news/new">
            <Plus className="size-4" /> Create News
          </Link>
        </Button>
      </div>

      {loading && <TableSkeleton rows={6} columns={6} />}
      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Newspaper}
          title="No news articles found"
          description="Try a different search or filter, or create your first announcement."
          action={
            <Button asChild size="sm">
              <Link href="/news/new">
                <Plus className="size-4" /> Create News
              </Link>
            </Button>
          }
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Views</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((news) => (
                <TableRow key={news.id}>
                  <TableCell className="max-w-xs truncate font-medium">{news.title}</TableCell>
                  <TableCell>{news.category?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={news.priority === "urgent" || news.priority === "pinned" ? "danger" : "neutral"}>
                      {news.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{news.audienceType}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[news.status] ?? "neutral"}>{NEWS_STATUS_LABELS[news.status as keyof typeof NEWS_STATUS_LABELS] ?? news.status}</Badge>
                  </TableCell>
                  <TableCell>{news.viewCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(news.status === "draft" || news.status === "scheduled") && (
                        <Button variant="ghost" size="sm" isLoading={publishingId === news.id} onClick={() => handlePublish(news.id)}>
                          <Send className="size-4" /> Publish
                        </Button>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/news/${news.id}`}>View</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} article{result.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
