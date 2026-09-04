"use client";

import { useEffect, useState } from "react";
import { Plus, Tags, Pencil, Trash2 } from "lucide-react";
import { newsCategoryService } from "@/services/newsCategoryService";
import { newsCategoryInputSchema, type NewsCategoryInput } from "@/lib/validation/newsCategory";
import type { NewsCategoryRecord } from "@/types/newsCategory";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

type FormValues = z.input<typeof newsCategoryInputSchema>;

export default function NewsCategoriesPage() {
  const [categories, setCategories] = useState<NewsCategoryRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<NewsCategoryRecord | "new" | null>(null);
  const [deleting, setDeleting] = useState<NewsCategoryRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function load() {
    setError(false);
    newsCategoryService.list({ pageSize: 100 }).then((r) => setCategories(r.data)).catch(() => setError(true));
  }

  useEffect(load, []);

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await newsCategoryService.remove(deleting.id);
      toast({ title: `${deleting.name} deleted`, variant: "success" });
      setDeleting(null);
      load();
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't delete category", variant: "danger" });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "News Management", href: "/news" }, { label: "Categories" }]} />
          <h1 className="mt-2 text-xl font-semibold text-foreground">News Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organize announcements — Academic, Examination, Holiday, Circular, and more.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Add Category
        </Button>
      </div>

      {error && <ErrorState onRetry={load} />}
      {!error && !categories && <LoadingState className="py-8" />}
      {!error && categories && categories.length === 0 && (
        <EmptyState icon={Tags} title="No categories yet" description="Add your first category to start organizing news." />
      )}
      {!error && categories && categories.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>News</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="flex items-center gap-2 font-medium">
                  {cat.colorHex && <span className="size-2.5 rounded-full" style={{ backgroundColor: cat.colorHex }} />}
                  {cat.name}
                </TableCell>
                <TableCell className="text-muted-foreground">{cat.code}</TableCell>
                <TableCell>{cat.counts?.news ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={cat.status === "active" ? "success" : "neutral"}>{cat.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(cat)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(cat)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing && (
        <CategoryFormModal
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="This can't be undone."
        variant="destructive"
        confirmLabel="Delete"
        isLoading={deleteBusy}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CategoryFormModal({ category, onClose, onSaved }: { category: NewsCategoryRecord | null; onClose: () => void; onSaved: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, NewsCategoryInput>({
    resolver: zodResolver(newsCategoryInputSchema),
    defaultValues: category
      ? { name: category.name, code: category.code, colorHex: category.colorHex ?? undefined, status: category.status as NewsCategoryInput["status"] }
      : { status: "active" },
  });

  async function handleFormSubmit(values: NewsCategoryInput) {
    try {
      if (category) {
        await newsCategoryService.update(category.id, values);
      } else {
        await newsCategoryService.create(values);
      }
      toast({ title: category ? "Category updated" : "Category created", variant: "success" });
      onSaved();
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't save category", variant: "danger" });
    }
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <ModalContent title={category ? "Edit category" : "Add category"} size="sm">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <FormField label="Name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register("name")} placeholder="Examination" />}
          </FormField>
          <FormField label="Code" required error={errors.code?.message}>
            {(field) => <Input {...field} {...register("code")} placeholder="EXAM" />}
          </FormField>
          <FormField label="Color" error={errors.colorHex?.message}>
            {(field) => <Input {...field} {...register("colorHex")} type="color" className="h-9 w-20 p-1" />}
          </FormField>
          <ModalFooter className="-mx-5 -mb-4 mt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
