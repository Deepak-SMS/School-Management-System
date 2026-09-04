"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2, Upload, X, FileText as FileIcon } from "lucide-react";
import { newsInputSchema, type NewsInput } from "@/lib/validation/news";

type NewsFormValues = z.input<typeof newsInputSchema>;
import { NEWS_PRIORITIES, NEWS_PRIORITY_LABELS, NEWS_AUDIENCE_TYPES, NEWS_AUDIENCE_TYPE_LABELS } from "@/lib/constants/news";
import { newsCategoryService } from "@/services/newsCategoryService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import { staffService } from "@/services/staffService";
import type { NewsCategoryRecord } from "@/types/newsCategory";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";
import type { StaffRecord } from "@/types/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const AUDIENCE_TARGETABLE = new Set(["students", "parents", "teachers"]);

interface UploadedRef {
  id: string;
  url: string;
  originalName?: string | null;
}

interface AudienceTargetDraft {
  classId: string;
  className: string;
  sectionId?: string;
  sectionName?: string;
}

interface NewsFormProps {
  defaultValues?: Partial<NewsInput>;
  initialFeaturedImage?: UploadedRef | null;
  initialImages?: UploadedRef[];
  initialAttachments?: UploadedRef[];
  initialAudienceTargets?: AudienceTargetDraft[];
  onSubmit: (input: NewsInput) => Promise<void>;
  submitLabel?: string;
  mode?: "create" | "edit";
}

async function uploadNewsFile(file: File, kind: "news_image" | "news_attachment"): Promise<UploadedRef> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);
  const response = await fetch("/api/news/uploads", { method: "POST", body: formData });
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as UploadedRef;
}

export function NewsForm({
  defaultValues,
  initialFeaturedImage = null,
  initialImages = [],
  initialAttachments = [],
  initialAudienceTargets = [],
  onSubmit,
  submitLabel = "Save",
  mode = "create",
}: NewsFormProps) {
  const [categories, setCategories] = useState<NewsCategoryRecord[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [pickerClassId, setPickerClassId] = useState("");
  const [pickerSectionId, setPickerSectionId] = useState("");
  const [audienceTargets, setAudienceTargets] = useState<AudienceTargetDraft[]>(initialAudienceTargets);
  const [featuredImage, setFeaturedImage] = useState<UploadedRef | null>(initialFeaturedImage);
  const [images, setImages] = useState<UploadedRef[]>(initialImages);
  const [attachments, setAttachments] = useState<UploadedRef[]>(initialAttachments);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewsFormValues, unknown, NewsInput>({
    resolver: zodResolver(newsInputSchema),
    defaultValues: {
      priority: "normal",
      status: "draft",
      audienceType: "all",
      commentsEnabled: true,
      notifyInApp: true,
      autoArchiveAfterExpiry: true,
      ...defaultValues,
    },
  });

  useEffect(() => {
    newsCategoryService.list({ pageSize: 100 }).then((r) => setCategories(r.data)).catch(() => {});
    classService.list({ pageSize: 100, status: "active" }).then((r) => setClasses(r.data)).catch(() => {});
    staffService.list({ pageSize: 200 }).then((r) => setStaff(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pickerClassId) {
      setSections([]);
      return;
    }
    sectionService.list({ classId: pickerClassId, pageSize: 100, status: "active" }).then((r) => setSections(r.data));
  }, [pickerClassId]);

  const audienceType = watch("audienceType");
  const status = watch("status");

  function addAudienceTarget() {
    if (!pickerClassId) return;
    const cls = classes.find((c) => c.id === pickerClassId);
    if (!cls) return;
    const section = sections.find((s) => s.id === pickerSectionId);
    setAudienceTargets((prev) => [
      ...prev,
      { classId: cls.id, className: cls.name, sectionId: section?.id, sectionName: section?.name },
    ]);
    setPickerClassId("");
    setPickerSectionId("");
  }

  function removeAudienceTarget(index: number) {
    setAudienceTargets((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFeaturedImageFile(file: File) {
    setUploadingFeatured(true);
    try {
      const uploaded = await uploadNewsFile(file, "news_image");
      setFeaturedImage(uploaded);
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't upload image", variant: "danger" });
    } finally {
      setUploadingFeatured(false);
    }
  }

  async function handleGalleryFiles(fileList: FileList) {
    setUploadingImages(true);
    try {
      const uploaded = await Promise.all(Array.from(fileList).map((f) => uploadNewsFile(f, "news_image")));
      setImages((prev) => [...prev, ...uploaded]);
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't upload one or more images", variant: "danger" });
    } finally {
      setUploadingImages(false);
    }
  }

  async function handleAttachmentFiles(fileList: FileList) {
    setUploadingAttachments(true);
    try {
      const uploaded = await Promise.all(Array.from(fileList).map((f) => uploadNewsFile(f, "news_attachment")));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't upload one or more files", variant: "danger" });
    } finally {
      setUploadingAttachments(false);
    }
  }

  async function handleFormSubmit(values: NewsInput) {
    setServerError(null);
    try {
      await onSubmit({
        ...values,
        featuredImageFileId: featuredImage?.id,
        imageFileIds: images.map((i) => i.id),
        attachmentFileIds: attachments.map((a) => a.id),
        audienceTargets: audienceTargets.map((t) => ({ classId: t.classId, sectionId: t.sectionId })),
      });
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save news article">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Article</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField label="News title" required error={errors.title?.message}>
            {(field) => <Input {...field} {...register("title")} placeholder="Annual Sports Day 2026" />}
          </FormField>
          <FormField label="Short description" error={errors.shortDescription?.message}>
            {(field) => <Textarea {...field} {...register("shortDescription")} rows={2} placeholder="One or two lines shown in lists and notifications." />}
          </FormField>
          <FormField label="Full content" required error={errors.contentHtml?.message}>
            {() => (
              <Controller
                name="contentHtml"
                control={control}
                render={({ field }) => (
                  <RichTextEditor value={field.value ?? ""} onChange={field.onChange} placeholder="Write the announcement..." />
                )}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Category" error={errors.categoryId?.message}>
            {(field) => (
              <Controller
                name="categoryId"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Priority" error={errors.priority?.message}>
            {(field) => (
              <Controller
                name="priority"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NEWS_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {NEWS_PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Author" error={errors.authorStaffId?.message}>
            {(field) => (
              <Controller
                name="authorStaffId"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select author" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audience</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Who should see this" error={errors.audienceType?.message}>
            {(field) => (
              <Controller
                name="audienceType"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id} className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NEWS_AUDIENCE_TYPES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {NEWS_AUDIENCE_TYPE_LABELS[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>

          {AUDIENCE_TARGETABLE.has(audienceType ?? "") && (
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Leave empty to target every class and section. Add specific classes/sections to narrow it down.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Class</span>
                  <Select value={pickerClassId || "none"} onValueChange={(v) => setPickerClassId(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select class</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Section (optional)</span>
                  <Select value={pickerSectionId || "all"} onValueChange={(v) => setPickerSectionId(v === "all" ? "" : v)} disabled={!pickerClassId}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sections</SelectItem>
                      {sections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addAudienceTarget} disabled={!pickerClassId}>
                  <Plus className="size-4" /> Add
                </Button>
              </div>
              {audienceTargets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {audienceTargets.map((t, i) => (
                    <Badge key={`${t.classId}-${t.sectionId ?? "all"}`} variant="primary" className="gap-1.5">
                      {t.className}
                      {t.sectionName ? `-${t.sectionName}` : " (all sections)"}
                      <button type="button" onClick={() => removeAudienceTarget(i)} aria-label="Remove">
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Featured image</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {featuredImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featuredImage.url} alt="Featured" className="size-20 rounded-md border border-border object-cover" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                <Upload className="size-5" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                id="featured-image-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFeaturedImageFile(file);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="secondary" size="sm" isLoading={uploadingFeatured} onClick={() => document.getElementById("featured-image-input")?.click()}>
                <Upload className="size-4" /> {featuredImage ? "Replace" : "Upload"}
              </Button>
              {featuredImage && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFeaturedImage(null)}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional images</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            {images.map((img, i) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="size-16 rounded-md border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 flex size-4.5 items-center justify-center rounded-full bg-danger-600 text-white"
                  aria-label="Remove image"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            id="gallery-input"
            onChange={(e) => {
              if (e.target.files?.length) handleGalleryFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="secondary" size="sm" className="w-fit" isLoading={uploadingImages} onClick={() => document.getElementById("gallery-input")?.click()}>
            <Upload className="size-4" /> Add images
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {attachments.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {attachments.map((file, i) => (
                <li key={file.id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <FileIcon className="size-4 text-muted-foreground" /> {file.originalName ?? "Attachment"}
                  </span>
                  <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove attachment">
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="file"
            multiple
            className="hidden"
            id="attachments-input"
            onChange={(e) => {
              if (e.target.files?.length) handleAttachmentFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="secondary" size="sm" className="w-fit" isLoading={uploadingAttachments} onClick={() => document.getElementById("attachments-input")?.click()}>
            <Upload className="size-4" /> Add attachment
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Status" error={errors.status?.message}>
            {(field) => (
              <Controller
                name="status"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Save as draft</SelectItem>
                      <SelectItem value="scheduled">Schedule</SelectItem>
                      <SelectItem value="published">Publish now</SelectItem>
                      {mode === "edit" && <SelectItem value="cancelled">Cancelled</SelectItem>}
                      {mode === "edit" && <SelectItem value="archived">Archived</SelectItem>}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          {status === "scheduled" && (
            <FormField label="Publish date & time" required error={errors.publishAt?.message}>
              {(field) => <Input {...field} {...register("publishAt")} type="datetime-local" />}
            </FormField>
          )}
          <FormField label="Expiry date & time" error={errors.expiresAt?.message}>
            {(field) => <Input {...field} {...register("expiresAt")} type="datetime-local" />}
          </FormField>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Controller
              name="autoArchiveAfterExpiry"
              control={control}
              render={({ field: sf }) => <Switch checked={sf.value} onCheckedChange={sf.onChange} />}
            />
            Auto-archive after expiry
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Controller
              name="commentsEnabled"
              control={control}
              render={({ field: sf }) => <Switch checked={sf.value} onCheckedChange={sf.onChange} />}
            />
            Allow comments
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Controller
              name="notifyInApp"
              control={control}
              render={({ field: sf }) => <Switch checked={sf.value} onCheckedChange={sf.onChange} />}
            />
            Send in-app notification when published
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
