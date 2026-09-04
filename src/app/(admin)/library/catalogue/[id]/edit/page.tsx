"use client";

import { use, useEffect, useState } from "react";
import { BookForm } from "@/features/library/book-form";
import { libraryBookService } from "@/services/libraryService";
import type { LibraryBookDetailRecord } from "@/types/library";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

export default function EditLibraryBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [book, setBook] = useState<LibraryBookDetailRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    libraryBookService
      .get(id)
      .then((b) => {
        setBook(b);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(load, [id]);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!book) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Library", href: "/library" },
            { label: "Catalogue", href: "/library/catalogue" },
            { label: book.title, href: `/library/catalogue/${book.id}` },
            { label: "Edit" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {book.title}</h1>
      </div>
      <BookForm book={book} />
    </div>
  );
}
