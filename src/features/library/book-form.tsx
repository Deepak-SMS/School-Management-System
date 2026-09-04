"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { libraryBookService, libraryCategoryService } from "@/services/libraryService";
import { subjectService } from "@/services/subjectService";
import { uploadService } from "@/services/hrService";
import type { LibraryBookRecord, LibraryCategoryRecord } from "@/types/library";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

interface SubjectOption {
  id: string;
  name: string;
}

export function BookForm({ book }: { book?: LibraryBookRecord }) {
  const router = useRouter();
  const [categories, setCategories] = useState<LibraryCategoryRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);

  const [title, setTitle] = useState(book?.title ?? "");
  const [subtitle, setSubtitle] = useState(book?.subtitle ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [isbn10, setIsbn10] = useState(book?.isbn10 ?? "");
  const [isbn13, setIsbn13] = useState(book?.isbn13 ?? "");
  const [publisher, setPublisher] = useState(book?.publisher ?? "");
  const [publicationYear, setPublicationYear] = useState(book?.publicationYear ? String(book.publicationYear) : "");
  const [edition, setEdition] = useState(book?.edition ?? "");
  const [language, setLanguage] = useState(book?.language ?? "");
  const [pageCount, setPageCount] = useState(book?.pageCount ? String(book.pageCount) : "");
  const [categoryId, setCategoryId] = useState(book?.categoryId ?? "");
  const [subjectId, setSubjectId] = useState(book?.subjectId ?? "");
  const [deweyDecimal, setDeweyDecimal] = useState(book?.deweyDecimal ?? "");
  const [shelf, setShelf] = useState(book?.shelf ?? "");
  const [rack, setRack] = useState(book?.rack ?? "");
  const [rowLabel, setRowLabel] = useState(book?.rowLabel ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(book?.coverImageUrl ?? "");
  const [isActive, setIsActive] = useState(book?.isActive ?? true);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    libraryCategoryService.list().then((r) => setCategories(r.data)).catch(() => undefined);
    subjectService.list({ pageSize: 200 }).then((r) => setSubjects(r.data)).catch(() => undefined);
  }, []);

  async function handleCoverFile(file: File) {
    setUploading(true);
    try {
      const uploaded = await uploadService.upload(file, "library_book_cover");
      setCoverImageUrl(uploaded.url);
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't upload the cover image", variant: "danger" });
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = {
        title,
        subtitle: subtitle || undefined,
        author,
        isbn10: isbn10 || undefined,
        isbn13: isbn13 || undefined,
        publisher: publisher || undefined,
        publicationYear: publicationYear ? Number(publicationYear) : undefined,
        edition: edition || undefined,
        language: language || undefined,
        pageCount: pageCount ? Number(pageCount) : undefined,
        categoryId: categoryId || undefined,
        subjectId: subjectId || undefined,
        deweyDecimal: deweyDecimal || undefined,
        shelf: shelf || undefined,
        rack: rack || undefined,
        rowLabel: rowLabel || undefined,
        description: description || undefined,
        coverImageUrl: coverImageUrl || undefined,
        isActive,
      };

      const saved = book ? await libraryBookService.update(book.id, payload) : await libraryBookService.create(payload);
      toast({ title: book ? "Book updated" : "Book added to the catalogue", variant: "success" });
      router.push(`/library/catalogue/${saved.id}`);
      router.refresh();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the book.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic information</CardTitle>
          <CardDescription>What prints on the catalogue card and search results.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Title" required error={fieldErrors.title?.[0]} className="sm:col-span-2">
            {(f) => <Input {...f} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mathematics Class 8" />}
          </FormField>
          <FormField label="Subtitle" className="sm:col-span-2">
            {(f) => <Input {...f} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />}
          </FormField>
          <FormField label="Author" required error={fieldErrors.author?.[0]}>
            {(f) => <Input {...f} value={author} onChange={(e) => setAuthor(e.target.value)} />}
          </FormField>
          <FormField label="Publisher">
            {(f) => <Input {...f} value={publisher} onChange={(e) => setPublisher(e.target.value)} />}
          </FormField>
          <FormField label="ISBN-10" error={fieldErrors.isbn10?.[0]}>
            {(f) => <Input {...f} value={isbn10} onChange={(e) => setIsbn10(e.target.value)} />}
          </FormField>
          <FormField label="ISBN-13" error={fieldErrors.isbn13?.[0]}>
            {(f) => <Input {...f} value={isbn13} onChange={(e) => setIsbn13(e.target.value)} />}
          </FormField>
          <FormField label="Edition">
            {(f) => <Input {...f} value={edition} onChange={(e) => setEdition(e.target.value)} />}
          </FormField>
          <FormField label="Publication year">
            {(f) => <Input {...f} type="number" value={publicationYear} onChange={(e) => setPublicationYear(e.target.value)} />}
          </FormField>
          <FormField label="Language">
            {(f) => <Input {...f} value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="English" />}
          </FormField>
          <FormField label="Pages">
            {(f) => <Input {...f} type="number" value={pageCount} onChange={(e) => setPageCount(e.target.value)} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classification &amp; location</CardTitle>
          <CardDescription>Where the librarian finds this book on the shelf.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Category">
            {(f) => (
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Subject" description="Optional — links this title to a curriculum subject.">
            {(f) => (
              <Select value={subjectId || "none"} onValueChange={(v) => setSubjectId(v === "none" ? "" : v)}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Dewey decimal">
            {(f) => <Input {...f} value={deweyDecimal} onChange={(e) => setDeweyDecimal(e.target.value)} placeholder="510" />}
          </FormField>
          <FormField label="Shelf" description="Default location for copies of this title.">
            {(f) => <Input {...f} value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="A" />}
          </FormField>
          <FormField label="Rack">
            {(f) => <Input {...f} value={rack} onChange={(e) => setRack(e.target.value)} placeholder="04" />}
          </FormField>
          <FormField label="Row">
            {(f) => <Input {...f} value={rowLabel} onChange={(e) => setRowLabel(e.target.value)} placeholder="23" />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description &amp; cover</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <FormField label="Description" className="sm:col-span-2">
            {(f) => <Textarea {...f} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </FormField>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Cover image</p>
            {coverImageUrl ? (
              <div className="relative w-28">
                <img src={coverImageUrl} alt="" className="aspect-[3/4] w-28 rounded-md border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImageUrl("")}
                  className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
                  aria-label="Remove cover image"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="secondary" size="sm" isLoading={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Upload cover
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCoverFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>

      {book && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div>
              <p className="text-sm font-medium text-foreground">Active in catalogue</p>
              <p className="text-xs text-muted-foreground">Inactive titles are hidden from search but keep their copy history.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Active in catalogue" />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} isLoading={busy} disabled={!title || !author}>
          {book ? "Save changes" : "Add book"}
        </Button>
      </div>
    </div>
  );
}
