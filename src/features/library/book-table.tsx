"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, BookOpen, Pencil, Trash2 } from "lucide-react";
import { libraryBookService, libraryCategoryService } from "@/services/libraryService";
import type { LibraryBookRecord, LibraryCategoryRecord } from "@/types/library";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const PAGE_SIZE = 20;

export function BookTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "libraryCatalogue", "create");
  const canEdit = hasPermission(user.role, "libraryCatalogue", "edit");
  const canDelete = hasPermission(user.role, "libraryCatalogue", "delete");

  const [categories, setCategories] = useState<LibraryCategoryRecord[]>([]);
  const [result, setResult] = useState<{ data: LibraryBookRecord[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<LibraryBookRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    libraryCategoryService.list().then((r) => setCategories(r.data)).catch(() => undefined);
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    libraryBookService
      .list({ q: search || undefined, categoryId: categoryId || undefined, availableOnly, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load the catalogue."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, availableOnly, page]);

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const result = await libraryBookService.remove(deleting.id);
      toast({
        title: result.deactivated ? "Book deactivated" : "Book deleted",
        description: result.deactivated ? `${result.copies} cop${result.copies === 1 ? "y" : "ies"} still exist, so it was kept for history.` : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the book.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search title, author, ISBN, publisher..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select
          value={categoryId || "all"}
          onValueChange={(v) => {
            setPage(1);
            setCategoryId(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-44">
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
        <Button
          variant={availableOnly ? "primary" : "secondary"}
          onClick={() => {
            setPage(1);
            setAvailableOnly((v) => !v);
          }}
        >
          Available now
        </Button>
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/library/catalogue/new">
              <Plus className="size-4" /> Add Book
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={6} />}
      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No books found"
          description="Try a different search or filter, or add your first title to the catalogue."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/library/catalogue/new">
                  <Plus className="size-4" /> Add Book
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Copies</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((book) => (
                <TableRow key={book.id}>
                  <TableCell className="font-medium">{book.title}</TableCell>
                  <TableCell className="text-muted-foreground">{book.author}</TableCell>
                  <TableCell>{book.category?.name ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {book.counts?.available ?? 0} / {book.counts?.copies ?? 0} available
                  </TableCell>
                  <TableCell>
                    <Badge variant={book.isActive ? "success" : "neutral"}>{book.isActive ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/library/catalogue/${book.id}`}>View</Link>
                      </Button>
                      {canEdit && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/library/catalogue/${book.id}/edit`}>
                            <Pencil className="size-4" /> Edit
                          </Link>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                          onClick={() => setDeleting(book)}
                        >
                          <Trash2 className="size-4" /> Remove
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} title{result.total === 1 ? "" : "s"}
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

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove ${deleting?.title ?? "book"}?`}
        description="Titles with physical copies on file are deactivated instead of deleted, so accession history is never lost."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
