"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, Eye, MessageSquare, EyeOff, Trash2, Send, Paperclip } from "lucide-react";
import { newsService } from "@/services/newsService";
import type { NewsRecord } from "@/types/news";
import type { NewsInput } from "@/lib/validation/news";
import { NEWS_STATUS_LABELS } from "@/lib/constants/news";
import { useCurrentUser } from "@/providers/user-provider";
import { NewsForm } from "@/features/news/news-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const statusVariant: Record<string, "success" | "neutral" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  scheduled: "info",
  published: "success",
  expired: "warning",
  archived: "neutral",
  cancelled: "danger",
};

export default function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const [news, setNews] = useState<NewsRecord | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const viewRecorded = useRef(false);

  function load() {
    newsService.get(id).then(setNews).catch(() => setError(true));
  }

  useEffect(() => {
    load();
    if (!viewRecorded.current) {
      viewRecorded.current = true;
      newsService.recordView(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!news) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  async function handlePublish() {
    try {
      await newsService.publish(id);
      toast({ title: "Article published", variant: "success" });
      load();
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't publish", variant: "danger" });
    }
  }

  async function handlePostComment() {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      await newsService.addComment(id, { authorName: user.name, authorRole: user.roleLabel, content: commentText.trim() });
      setCommentText("");
      load();
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't post comment", variant: "danger" });
    } finally {
      setPostingComment(false);
    }
  }

  async function handleToggleComment(commentId: string, currentStatus: string) {
    try {
      await newsService.setCommentStatus(id, commentId, currentStatus === "hidden" ? "visible" : "hidden");
      load();
    } catch {
      toast({ title: "Couldn't update comment", variant: "danger" });
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await newsService.removeComment(id, commentId);
      load();
    } catch {
      toast({ title: "Couldn't delete comment", variant: "danger" });
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await newsService.remove(id);
      toast({ title: "Article deleted", variant: "success" });
      window.location.href = "/news/all";
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't delete article", variant: "danger" });
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (editing) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <div>
          <Breadcrumb items={[{ label: "News Management", href: "/news" }, { label: "All News", href: "/news/all" }, { label: news.title }]} />
          <h1 className="mt-2 text-xl font-semibold text-foreground">Edit News</h1>
        </div>
        <NewsForm
          mode="edit"
          submitLabel="Save changes"
          defaultValues={{
            title: news.title,
            shortDescription: news.shortDescription ?? undefined,
            contentHtml: news.contentHtml,
            categoryId: news.category?.id,
            authorStaffId: news.author?.id,
            priority: news.priority as NewsInput["priority"],
            status: news.status as NewsInput["status"],
            audienceType: news.audienceType as NewsInput["audienceType"],
            commentsEnabled: news.commentsEnabled,
            notifyInApp: news.notifyInApp,
            publishAt: news.publishAt?.slice(0, 16),
            expiresAt: news.expiresAt?.slice(0, 16),
            autoArchiveAfterExpiry: news.autoArchiveAfterExpiry,
          }}
          initialFeaturedImage={news.featuredImage}
          initialImages={news.images?.map((i) => i.file) ?? []}
          initialAttachments={news.attachments?.map((a) => a.file) ?? []}
          initialAudienceTargets={(news.audienceTargets ?? []).map((t) => ({
            classId: t.class.id,
            className: t.class.name,
            sectionId: t.section?.id,
            sectionName: t.section?.name,
          }))}
          onSubmit={async (input) => {
            await newsService.update(id, input);
            toast({ title: "News updated", variant: "success" });
            setEditing(false);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "News Management", href: "/news" }, { label: "All News", href: "/news/all" }, { label: news.title }]} />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{news.title}</h1>
          <Badge variant={statusVariant[news.status] ?? "neutral"}>{NEWS_STATUS_LABELS[news.status as keyof typeof NEWS_STATUS_LABELS] ?? news.status}</Badge>
          {(news.priority === "urgent" || news.priority === "pinned") && <Badge variant="danger">{news.priority}</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {news.category?.name ?? "Uncategorized"} · {news.author?.fullName ?? "Unknown author"} ·{" "}
          {news.publishAt ? new Date(news.publishAt).toLocaleString() : "Not yet published"}
        </p>
        <div className="mt-3 flex gap-2">
          {(news.status === "draft" || news.status === "scheduled") && (
            <Button variant="secondary" onClick={handlePublish}>
              <Send className="size-4" /> Publish now
            </Button>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Views" value={news.viewCount} icon={Eye} />
        <StatCard label="Comments" value={news.counts?.comments ?? news.comments?.length ?? 0} icon={MessageSquare} />
        <StatCard label="Attachments" value={news.attachments?.length ?? 0} icon={Paperclip} />
      </div>

      {news.featuredImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={news.featuredImage.url} alt={news.title} className="max-h-80 w-full rounded-lg border border-border object-cover" />
      )}

      <Card>
        <CardContent
          className="max-w-none py-4 text-sm leading-relaxed text-foreground [&_a]:text-primary-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: news.contentHtml }}
        />
      </Card>

      {news.images && news.images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gallery</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {news.images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.id} src={img.file.url} alt={img.caption ?? ""} className="size-24 rounded-md border border-border object-cover" />
            ))}
          </CardContent>
        </Card>
      )}

      {news.attachments && news.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {news.attachments.map((att) => (
              <Link key={att.id} href={att.file.url} target="_blank" className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
                <Paperclip className="size-4" /> {att.file.originalName ?? att.label ?? "Attachment"}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Comments {news.commentsEnabled ? "" : "(disabled)"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {news.commentsEnabled && (
            <div className="flex flex-col gap-2">
              <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={2} placeholder="Add a comment..." />
              <Button size="sm" className="w-fit" isLoading={postingComment} onClick={handlePostComment}>
                Post comment
              </Button>
            </div>
          )}
          {!news.comments || news.comments.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No comments yet" />
          ) : (
            <ul className="flex flex-col gap-3">
              {news.comments.map((comment) => (
                <li key={comment.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {comment.authorName} <span className="font-normal text-muted-foreground">· {comment.authorRole}</span>
                      {comment.status === "hidden" && (
                        <Badge variant="neutral" className="ml-2">
                          Hidden
                        </Badge>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{comment.content}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleToggleComment(comment.id, comment.status)}>
                      <EyeOff className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteComment(comment.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this article?"
        description="This can't be undone. Published articles must be archived instead."
        variant="destructive"
        confirmLabel="Delete"
        isLoading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
