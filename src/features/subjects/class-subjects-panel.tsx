"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Trash2, BookOpen, Layers, Pencil } from "lucide-react";
import { classService } from "@/services/classService";
import { academicYearService } from "@/services/academicYearService";
import { staffService } from "@/services/staffService";
import { subjectService } from "@/services/subjectService";
import type { ClassRecord } from "@/types/class";
import type { AcademicYearRecord } from "@/types/academicYear";
import type { StaffRecord } from "@/types/staff";
import type { SubjectRecord } from "@/types/subject";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

interface ClassAssignment {
  id: string;
  subject: { id: string; name: string; code: string; subjectType: string; natureType: string; status: string };
  section?: { id: string; name: string } | null;
  teacher?: { id: string; fullName: string } | null;
  academicYear: { id: string; label: string };
}

/**
 * Subjects seen from the class side: every class the school has created, with
 * the subjects it takes underneath, and add/edit/remove in place.
 *
 * Reads and writes the same SubjectAssignment rows as the subject-centric
 * screens — this is a different view of the data, not a parallel store.
 */
export function ClassSubjectsPanel() {
  const can = useCan();
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [years, setYears] = useState<AcademicYearRecord[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      classService.list({ pageSize: 200, status: "active" }),
      academicYearService.list({ pageSize: 50 }),
    ])
      .then(([classResult, yearResult]) => {
        if (cancelled) return;
        setClasses(classResult.data);
        setYears(yearResult.data);
        const current = yearResult.data.find((y) => y.status === "active") ?? yearResult.data[0];
        if (current) setAcademicYearId(current.id);
        // Open the first class so the panel isn't a wall of collapsed rows.
        if (classResult.data[0]) setExpanded(new Set([classResult.data[0].id]));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(classId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  const visible = useMemo(
    () => (classes ?? []).filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())),
    [classes, search],
  );

  if (error) return <ErrorState description="Couldn't load classes." onRetry={() => window.location.reload()} />;
  if (!classes) return <LoadingState />;

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No classes yet"
        description="Subjects are assigned to classes, so create a class first."
        action={
          <Button asChild size="sm">
            <Link href="/school/classes/new">
              <Plus className="size-4" /> Add class
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input placeholder="Find a class…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={academicYearId} onValueChange={setAcademicYearId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Academic year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {visible.length} class{visible.length === 1 ? "" : "es"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {visible.map((cls) => (
          <ClassRow
            key={cls.id}
            cls={cls}
            academicYearId={academicYearId}
            expanded={expanded.has(cls.id)}
            onToggle={() => toggle(cls.id)}
            canEdit={can("subjects", "edit")}
            canCreate={can("subjects", "create")}
            canDelete={can("subjects", "delete")}
          />
        ))}
      </div>
    </div>
  );
}

function ClassRow({
  cls,
  academicYearId,
  expanded,
  onToggle,
  canEdit,
  canCreate,
  canDelete,
}: {
  cls: ClassRecord;
  academicYearId: string;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const [assignments, setAssignments] = useState<ClassAssignment[] | null>(null);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ClassAssignment | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Only fetch when the row is actually opened — a school may have many classes.
  useEffect(() => {
    if (!expanded || !academicYearId) return;
    let cancelled = false;

    fetch(`/api/classes/${cls.id}/subjects?academicYearId=${academicYearId}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setAssignments(body.data);
        setSections(body.class.sections);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [expanded, academicYearId, cls.id, reloadKey]);

  async function remove() {
    if (!removing) return;
    try {
      const response = await fetch(`/api/classes/${cls.id}/subjects/${removing.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({ title: `${removing.subject.name} removed from ${cls.name}`, variant: "success" });
      setRemoving(null);
      reload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the subject", variant: "danger" });
      setRemoving(null);
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      >
        <span className="flex items-center gap-2">
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden="true" />
          <span className="font-medium text-foreground">{cls.name}</span>
          <span className="text-xs text-muted-foreground">{cls.code}</span>
        </span>
        <span className="flex items-center gap-2">
          {assignments && (
            <Badge variant={assignments.length > 0 ? "info" : "neutral"}>
              {assignments.length} subject{assignments.length === 1 ? "" : "s"}
            </Badge>
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {loadError && <ErrorState description="Couldn't load subjects for this class." onRetry={reload} />}

          {!loadError && !assignments && <LoadingState />}

          {!loadError && assignments && (
            <div className="flex flex-col gap-3">
              {assignments.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={`No subjects in ${cls.name} yet`}
                  description="Add the subjects this class studies."
                  action={
                    canCreate ? (
                      <Button size="sm" onClick={() => setAdding(true)}>
                        <Plus className="size-4" /> Add subject
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <ul className="flex flex-col divide-y divide-border">
                    {assignments.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {a.subject.name}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{a.subject.code}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {a.section?.name ? `Section ${a.section.name}` : "All sections"}
                            {" · "}
                            {a.teacher?.fullName ?? "No teacher assigned"}
                            {" · "}
                            {a.subject.subjectType.replace("_", " ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/school/subjects/${a.subject.id}`}>
                                <Pencil className="size-4" /> Edit
                              </Link>
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="sm" onClick={() => setRemoving(a)}>
                              <Trash2 className="size-4" /> Remove
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {canCreate && (
                    <div>
                      <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                        <Plus className="size-4" /> Add subject to {cls.name}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {adding && (
        <AddSubjectModal
          cls={cls}
          sections={sections}
          academicYearId={academicYearId}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={`Remove ${removing?.subject.name ?? "subject"} from ${cls.name}?`}
        description="The subject itself is kept — only its link to this class is removed, so other classes still taking it are unaffected."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={remove}
      />
    </div>
  );
}

function AddSubjectModal({
  cls,
  sections,
  academicYearId,
  onClose,
  onAdded,
}: {
  cls: ClassRecord;
  sections: { id: string; name: string }[];
  academicYearId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [teachers, setTeachers] = useState<StaffRecord[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [subjectType, setSubjectType] = useState("core");
  const [teacherId, setTeacherId] = useState("");
  const [scope, setScope] = useState<"all" | "sections">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    subjectService.list({ pageSize: 200, status: "active" }).then((r) => setSubjects(r.data)).catch(() => undefined);
    staffService.list({ pageSize: 200, category: "teacher" }).then((r) => setTeachers(r.data)).catch(() => undefined);
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/classes/${cls.id}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId,
          ...(mode === "existing" ? { subjectId } : { name, code: code || undefined, subjectType }),
          sectionIds: scope === "sections" ? Array.from(selected) : undefined,
          teacherId: teacherId || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw body;

      if (body.created > 0) {
        toast({
          title: `Added to ${cls.name}`,
          description: body.skipped > 0 ? `${body.skipped} already had this subject and were skipped.` : undefined,
          variant: "success",
        });
        onAdded();
      } else {
        setError("This class already has that subject for the selected sections.");
      }
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't add the subject.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = mode === "existing" ? Boolean(subjectId) : name.trim() !== "";

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={`Add subject to ${cls.name}`} description="Pick a subject the school already has, or create a new one here.">
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <div className="flex gap-2">
            <ModeButton active={mode === "existing"} onClick={() => setMode("existing")}>
              Existing subject
            </ModeButton>
            <ModeButton active={mode === "new"} onClick={() => setMode("new")}>
              New subject
            </ModeButton>
          </div>

          {mode === "existing" ? (
            <FormField label="Subject" required>
              {(f) => (
                <Select value={subjectId} onValueChange={setSubjectId} disabled={subjects.length === 0}>
                  <SelectTrigger id={f.id}>
                    <SelectValue placeholder={subjects.length === 0 ? "No subjects yet — create one" : "Select subject"} />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          ) : (
            <>
              <FormField label="Subject name" required>
                {(f) => (
                  <Input
                    {...f}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20));
                    }}
                    placeholder="Mathematics"
                  />
                )}
              </FormField>
              <FormField label="Code" description="Reused if a subject with this code already exists">
                {(f) => <Input {...f} value={code} onChange={(e) => setCode(e.target.value)} />}
              </FormField>
              <FormField label="Type">
                {(f) => (
                  <Select value={subjectType} onValueChange={setSubjectType}>
                    <SelectTrigger id={f.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["core", "elective", "optional", "co_curricular", "practical", "language"].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </>
          )}

          <FormField label="Teacher" description="Optional — can be set later">
            {(f) => (
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap gap-2">
              <ModeButton active={scope === "all"} onClick={() => setScope("all")}>
                All sections
              </ModeButton>
              <ModeButton active={scope === "sections"} onClick={() => setScope("sections")}>
                Specific sections
              </ModeButton>
            </div>

            {scope === "all" ? (
              <p className="text-xs text-muted-foreground">
                Applies to every current and future section of {cls.name}.
              </p>
            ) : sections.length === 0 ? (
              <p className="text-xs text-muted-foreground">This class has no sections yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {sections.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        })
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              isLoading={busy}
              disabled={!canSubmit || (scope === "sections" && selected.size === 0)}
            >
              Add subject
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary-600 bg-primary-50 text-primary-700" : "border-border-strong text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
