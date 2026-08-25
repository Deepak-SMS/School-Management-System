"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, IdCard, ArrowLeft, Eye, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { CardPreviewModal } from "@/features/id-cards/card-preview-modal";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

interface Person {
  id: string;
  personType: "student" | "teacher" | "staff";
  name: string;
  reference: string;
  detail: string;
  photoUrl?: string | null;
  card: { id: string; status: string; cardNumber?: string | null } | null;
}

interface PersonKey {
  id: string;
  personType: "student" | "teacher" | "staff";
}

interface ClassOption {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

const TYPE_LABELS: Record<string, string> = {
  all: "Everyone",
  student: "Students",
  teacher: "Teachers",
  staff: "Other staff",
};

const PAGE_SIZE = 25;

/** Selection is keyed by type+id, since a student and a staff member could share an id. */
const keyOf = (p: PersonKey) => `${p.personType}:${p.id}`;

export function CardPeopleList({
  initialType = "all",
  initialCardStatus = "all",
  onBack,
}: {
  initialType?: string;
  initialCardStatus?: string;
  onBack: () => void;
}) {
  const [type, setType] = useState(initialType);
  const [cardStatus, setCardStatus] = useState(initialCardStatus);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<{ data: Person[]; total: number; allIds: PersonKey[] } | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Person | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Students filter by class/section, staff by department — so only the options
  // that apply to the current selection are fetched.
  const showStudentFilters = type === "student";
  const showStaffFilters = type === "teacher" || type === "staff";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/school-structure")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setClasses(body.classes ?? []);
      })
      .catch(() => undefined);
    fetch("/api/departments?pageSize=200")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setDepartments(body.data ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      const query = new URLSearchParams({
        type,
        cardStatus,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(search ? { q: search } : {}),
        ...(showStudentFilters && classId ? { classId } : {}),
        ...(showStudentFilters && sectionId ? { sectionId } : {}),
        ...(showStaffFilters && departmentId ? { departmentId } : {}),
      });

      fetch(`/api/id-cards/people?${query}`)
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw body;
          return body;
        })
        .then((body) => {
          if (cancelled) return;
          setResult({ data: body.data, total: body.total, allIds: body.allIds ?? [] });
          setError(null);
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          setError((e as ApiError)?.error ?? "Couldn't load people.");
          setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [type, cardStatus, search, page, classId, sectionId, departmentId, showStudentFilters, showStaffFilters, reloadKey]);

  const sections = useMemo(
    () => classes.find((c) => c.id === classId)?.sections ?? [],
    [classes, classId],
  );

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const allMatching = result?.allIds ?? [];
  const allSelected = allMatching.length > 0 && allMatching.every((p) => selected.has(keyOf(p)));

  function toggleOne(person: PersonKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = keyOf(person);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Covers every match across all pages, not just the visible rows. */
  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) return new Set<string>();
      const next = new Set(prev);
      allMatching.forEach((p) => next.add(keyOf(p)));
      return next;
    });
  }

  function changeType(next: string) {
    setPage(1);
    setType(next);
    // Filters from the previous kind of person no longer apply.
    setClassId("");
    setSectionId("");
    setDepartmentId("");
  }

  async function generatePdf() {
    const people = allMatching.filter((p) => selected.has(keyOf(p)));
    if (people.length === 0) return;

    setGenerating(true);
    try {
      const response = await fetch("/api/id-cards/people/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't generate the PDF.");
      }

      const rendered = Number(response.headers.get("X-Cards-Rendered") ?? people.length);
      const skipped = Number(response.headers.get("X-Cards-Skipped") ?? 0);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `id-cards-${rendered}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: `${rendered} card${rendered === 1 ? "" : "s"} generated`,
        // A partial batch is stated outright rather than passing silently.
        description: skipped > 0 ? `${skipped} couldn't be rendered and were left out.` : undefined,
        variant: skipped > 0 ? "default" : "success",
      });
    } catch (e) {
      toast({ title: (e as Error).message, variant: "danger" });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to overview
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search name, admission or employee ID…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <Select value={type} onValueChange={changeType}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showStudentFilters && (
          <>
            <Select
              value={classId || "all"}
              onValueChange={(v) => {
                setPage(1);
                setClassId(v === "all" ? "" : v);
                setSectionId("");
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sections only make sense once a class is chosen. */}
            <Select
              value={sectionId || "all"}
              onValueChange={(v) => {
                setPage(1);
                setSectionId(v === "all" ? "" : v);
              }}
              disabled={!classId || sections.length === 0}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={classId ? "All sections" : "Pick a class"} />
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
          </>
        )}

        {showStaffFilters && (
          <Select
            value={departmentId || "all"}
            onValueChange={(v) => {
              setPage(1);
              setDepartmentId(v === "all" ? "" : v);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={cardStatus}
          onValueChange={(v) => {
            setPage(1);
            setCardStatus(v);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any card status</SelectItem>
            <SelectItem value="pending">Card pending</SelectItem>
            <SelectItem value="generated">Card generated</SelectItem>
          </SelectContent>
        </Select>

        {result && (
          <span className="text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "person" : "people"}
          </span>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" onClick={generatePdf} isLoading={generating}>
            <FileDown className="size-4" /> Generate PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {loading && <TableSkeleton rows={8} columns={6} />}
      {!loading && error && <ErrorState description={error} onRetry={reload} />}

      {!loading && !error && result?.data.length === 0 && (
        <EmptyState
          icon={IdCard}
          title="Nobody matches"
          description="Try a different search or filter. Students and employees appear here as soon as they're added."
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label={`Select all ${result.total} matching people`}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.map((person) => (
                  <TableRow key={keyOf(person)}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(keyOf(person))}
                        onCheckedChange={() => toggleOne(person)}
                        aria-label={`Select ${person.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={person.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          size="sm"
                        />
                        <span className="font-medium">{person.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{person.reference}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{TYPE_LABELS[person.personType] ?? person.personType}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{person.detail || "—"}</TableCell>
                    <TableCell>
                      {person.card ? (
                        <Badge variant={person.card.status === "active" ? "success" : "neutral"}>
                          {person.card.status}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setViewing(person)}>
                        <Eye className="size-4" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {viewing && (
        <CardPreviewModal
          personType={viewing.personType}
          personId={viewing.id}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
