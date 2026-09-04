"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, EyeOff, Eye, Trash2 } from "lucide-react";
import { newsService } from "@/services/newsService";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";

interface ModerationComment {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
  status: string;
  createdAt: string;
  news: { id: string; title: string };
}

export default function NewsCommentsPage() {
  const [comments, setComments] = useState<ModerationComment[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    fetch("/api/news-comments")
      .then((r) => r.json())
      .then((body) => setComments(body.data))
      .catch(() => setError(true));
  }

  useEffect(load, []);

  async function toggle(comment: ModerationComment) {
    try {
      await newsService.setCommentStatus(comment.news.id, comment.id, comment.status === "hidden" ? "visible" : "hidden");
      load();
    } catch {
      toast({ title: "Couldn't update comment", variant: "danger" });
    }
  }

  async function remove(comment: ModerationComment) {
    try {
      await newsService.removeComment(comment.news.id, comment.id);
      load();
    } catch {
      toast({ title: "Couldn't delete comment", variant: "danger" });
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "News Management", href: "/news" }, { label: "Comments & Moderation" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Comments &amp; Moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every comment across every article, newest first.</p>
      </div>

      {error && <ErrorState onRetry={load} />}
      {!error && !comments && <LoadingState className="py-8" />}
      {!error && comments && comments.length === 0 && <EmptyState icon={MessageSquare} title="No comments yet" />}
      {!error && comments && comments.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comment</TableHead>
              <TableHead>Article</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comments.map((comment) => (
              <TableRow key={comment.id}>
                <TableCell className="max-w-xs">
                  <p className="font-medium text-foreground">
                    {comment.authorName} <span className="font-normal text-muted-foreground">· {comment.authorRole}</span>
                  </p>
                  <p className="truncate text-muted-foreground">{comment.content}</p>
                </TableCell>
                <TableCell>
                  <Link href={`/news/${comment.news.id}`} className="text-primary-600 hover:underline">
                    {comment.news.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={comment.status === "hidden" ? "neutral" : "success"}>{comment.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggle(comment)}>
                      {comment.status === "hidden" ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(comment)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
