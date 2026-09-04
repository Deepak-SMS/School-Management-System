"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, BookOpen, CheckCircle2, MapPin } from "lucide-react";
import { libraryBookService } from "@/services/libraryService";
import type { LibraryBookDetailRecord } from "@/types/library";
import { useCan } from "@/hooks/use-can";
import { BookCopiesPanel } from "@/features/library/book-copies-panel";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

export default function LibraryBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const [book, setBook] = useState<LibraryBookDetailRecord | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    libraryBookService
      .get(id)
      .then((b) => {
        setBook(b);
        setError(false);
      })
      .catch(() => setError(true));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!book) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  const available = book.copies.filter((c) => c.status === "available").length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Library", href: "/library" }, { label: "Catalogue", href: "/library/catalogue" }, { label: book.title }]} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{book.title}</h1>
            <Badge variant={book.isActive ? "success" : "neutral"}>{book.isActive ? "Active" : "Inactive"}</Badge>
          </div>
          {can("libraryCatalogue", "edit") && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/library/catalogue/${book.id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {book.author}
          {book.category?.name ? ` · ${book.category.name}` : ""}
          {book.publisher ? ` · ${book.publisher}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Copies" value={book.copies.length} icon={BookOpen} />
        <StatCard label="Available" value={available} icon={CheckCircle2} />
        <StatCard label="Default location" value={[book.shelf, book.rack, book.rowLabel].filter(Boolean).join(" · ") || "—"} icon={MapPin} />
      </div>

      <Tabs defaultValue="copies">
        <TabsList>
          <TabsTrigger value="copies">Copies</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="copies">
          <BookCopiesPanel book={book} copies={book.copies} onChanged={load} />
        </TabsContent>

        <TabsContent value="details" className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Subtitle" value={book.subtitle} />
          <Field label="Subject" value={book.subject?.name} />
          <Field label="ISBN-10" value={book.isbn10} />
          <Field label="ISBN-13" value={book.isbn13} />
          <Field label="Edition" value={book.edition} />
          <Field label="Publication year" value={book.publicationYear ? String(book.publicationYear) : undefined} />
          <Field label="Language" value={book.language} />
          <Field label="Pages" value={book.pageCount ? String(book.pageCount) : undefined} />
          <Field label="Dewey decimal" value={book.deweyDecimal} />
          <Field label="Description" value={book.description} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
