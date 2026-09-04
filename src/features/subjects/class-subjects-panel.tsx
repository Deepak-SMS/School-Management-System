"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Layers, Search } from "lucide-react";
import { classService } from "@/services/classService";
import { academicYearService } from "@/services/academicYearService";
import { sectionService } from "@/services/sectionService";
import { subjectService } from "@/services/subjectService";
import type { ClassRecord } from "@/types/class";
import type { AcademicYearRecord } from "@/types/academicYear";
import type { SectionRecord } from "@/types/section";
import type { SubjectRecord } from "@/types/subject";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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
 * "Section A" for display, whether the stored name is the bare letter ("A",
 * the single-add form's convention) or already prefixed ("Section A", the
 * quick multi-add's convention — see src/features/sections/section-form.tsx)
 * — never doubles up into "Section Section A".
 */
function sectionDisplayName(name: string): string {
  return `Section ${name.replace(/^section\s+/i, "")}`;
}

/** Stable key for a (subject, column) cell — column is a sectionId, or "all" for the whole-class column. */
function cellKey(subjectId: string, sectionId: string | null): string {
  return `${subjectId}:${sectionId ?? "all"}`;
}

/**
 * Subjects seen from the class side: every class the school has created, each
 * with a Subjects × Sections checkbox matrix — check a cell to assign that
 * subject to "whole class" or one section, uncheck to remove it. No modal;
 * every cell is its own instant toggle against the same SubjectAssignment
 * rows the subject-centric screens read and write.
 */
export function ClassSubjectsPanel() {
  const can = useCan();
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [years, setYears] = useState<AcademicYearRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectRecord[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      classService.list({ pageSize: 200, status: "active" }),
      academicYearService.list({ pageSize: 50 }),
      // Loaded up front (not per-row-expand, like ClassRow's own fetch) just
      // so the search box below can match a section code without having to
      // open every class first.
      sectionService.list({ pageSize: 500 }),
      subjectService.list({ pageSize: 200, status: "active" }),
    ])
      .then(([classResult, yearResult, sectionResult, subjectResult]) => {
        if (cancelled) return;
        setClasses(classResult.data);
        setYears(yearResult.data);
        setSections(sectionResult.data);
        setAllSubjects(subjectResult.data);
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

  function addNewSubject(subject: SubjectRecord) {
    setAllSubjects((prev) => (prev.some((s) => s.id === subject.id) ? prev : [...prev, subject].sort((a, b) => a.name.localeCompare(b.name))));
  }

  // Section codes belonging to each class, so searching "C6-A" finds Class 6
  // without first having to expand it.
  const sectionCodesByClass = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const section of sections) {
      const codes = map.get(section.class.id) ?? [];
      codes.push(section.code.toLowerCase());
      map.set(section.class.id, codes);
    }
    return map;
  }, [sections]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return classes ?? [];
    return (classes ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query) ||
        (sectionCodesByClass.get(c.id) ?? []).some((code) => code.includes(query)),
    );
  }, [classes, search, sectionCodesByClass]);

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
          <Input
            placeholder="Find a class, class code, or section code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
            allSubjects={allSubjects}
            onNewSubject={addNewSubject}
            expanded={expanded.has(cls.id)}
            onToggle={() => toggle(cls.id)}
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
  allSubjects,
  onNewSubject,
  expanded,
  onToggle,
  canCreate,
  canDelete,
}: {
  cls: ClassRecord;
  academicYearId: string;
  allSubjects: SubjectRecord[];
  onNewSubject: (subject: SubjectRecord) => void;
  expanded: boolean;
  onToggle: () => void;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const [assignments, setAssignments] = useState<ClassAssignment[] | null>(null);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());
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

  async function toggleCell(subject: SubjectRecord, sectionId: string | null) {
    const key = cellKey(subject.id, sectionId);
    if (pending.has(key)) return;
    const existingAssignment = (assignments ?? []).find(
      (a) => a.subject.id === subject.id && (sectionId ? a.section?.id === sectionId : !a.section),
    );

    setPending((prev) => new Set(prev).add(key));
    try {
      if (existingAssignment) {
        const response = await fetch(`/api/classes/${cls.id}/subjects/${existingAssignment.id}`, { method: "DELETE" });
        const body = await response.json();
        if (!response.ok) throw body;
      } else {
        const response = await fetch(`/api/classes/${cls.id}/subjects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ academicYearId, subjectId: subject.id, sectionIds: sectionId ? [sectionId] : undefined }),
        });
        const body = await response.json();
        if (!response.ok) throw body;
      }
      reload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update that assignment.", variant: "danger" });
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const filteredSubjects = useMemo(
    () =>
      allSubjects.filter(
        (s) => !subjectFilter || s.name.toLowerCase().includes(subjectFilter.toLowerCase()) || s.code.toLowerCase().includes(subjectFilter.toLowerCase()),
      ),
    [allSubjects, subjectFilter],
  );

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
              {allSubjects.length > 6 && (
                <div className="w-full max-w-xs">
                  <Input
                    leadingIcon={<Search />}
                    placeholder="Find a subject…"
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                  />
                </div>
              )}

              {filteredSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subjects match &ldquo;{subjectFilter}&rdquo;.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-background">Subject</TableHead>
                      <TableHead className="text-center">Whole class</TableHead>
                      {sections.map((s) => (
                        <TableHead key={s.id} className="text-center">
                          {sectionDisplayName(s.name)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubjects.map((subject) => (
                      <TableRow key={subject.id}>
                        <TableCell className="sticky left-0 z-10 whitespace-normal bg-surface">
                          <Link href={`/school/subjects/${subject.id}`} className="font-medium text-foreground hover:underline">
                            {subject.name}
                          </Link>
                          <span className="ml-2 text-xs text-muted-foreground">{subject.code}</span>
                        </TableCell>
                        {[null, ...sections.map((s) => s.id)].map((sectionId) => {
                          const checked = assignments.some(
                            (a) => a.subject.id === subject.id && (sectionId ? a.section?.id === sectionId : !a.section),
                          );
                          return (
                            <TableCell key={sectionId ?? "all"} className="text-center">
                              <Checkbox
                                checked={checked}
                                disabled={(checked ? !canDelete : !canCreate) || pending.has(cellKey(subject.id, sectionId))}
                                onCheckedChange={() => toggleCell(subject, sectionId)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {sections.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  This class has no sections yet — checked subjects apply to the whole class.{" "}
                  <Link href={`/school/classes/${cls.id}`} className="text-primary-600 hover:underline">
                    Add sections
                  </Link>
                  .
                </p>
              )}

              {canCreate && <NewSubjectRow classId={cls.id} academicYearId={academicYearId} className={cls.name} onCreated={onNewSubject} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact inline "+ New subject" affordance — creates a catalog subject and assigns it whole-class by default; individual section cells can be toggled right after. */
function NewSubjectRow({
  classId,
  academicYearId,
  className,
  onCreated,
}: {
  classId: string;
  academicYearId: string;
  className: string;
  onCreated: (subject: SubjectRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [subjectType, setSubjectType] = useState("core");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/classes/${classId}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYearId, name, code: code || undefined, subjectType }),
      });
      const body = await response.json();
      if (!response.ok) throw body;

      onCreated(await subjectService.get(body.subjectId));
      toast({ title: `${name} added to ${className}`, variant: "success" });
      setOpen(false);
      setName("");
      setCode("");
      setSubjectType("core");
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't create the subject.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New subject
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
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
        <FormField label="Code" description="Reused if it already exists">
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
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} isLoading={busy} disabled={!name.trim()}>
          Add to {className}
        </Button>
      </div>
    </div>
  );
}
