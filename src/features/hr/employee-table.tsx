"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, UserCog, SlidersHorizontal, Download, X, ArrowUpDown } from "lucide-react";
import { employeeService, hrLookupService } from "@/services/hrService";
import type { EmployeeRecord, EmployeeListParams, HrLookups } from "@/types/hr";
import { STAFF_CATEGORIES, STAFF_CATEGORY_LABELS } from "@/lib/constants/people";
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUS_TONES,
  type EmploymentStatus,
} from "@/lib/constants/hr";
import { GENDERS } from "@/lib/constants/people";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useCan } from "@/hooks/use-can";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

/** Filters readable from the URL, so a dashboard KPI can deep-link into a filtered list. */
const URL_FILTER_KEYS = [
  "category",
  "employmentStatus",
  "departmentId",
  "designationId",
  "employeeTypeId",
  "campusId",
  "gender",
  "reportingManagerId",
  "joinedFrom",
  "joinedTo",
  "probation",
  "employed",
] as const;

type FilterState = Partial<Record<(typeof URL_FILTER_KEYS)[number], string>>;

export function EmployeeTable({ fixedCategory }: { fixedCategory?: string }) {
  const can = useCan();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [result, setResult] = useState<{ data: EmployeeRecord[]; total: number } | null>(null);
  const [lookups, setLookups] = useState<HrLookups | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("fullName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Seed filters from the URL once, so KPI links like
  // `/employees?employmentStatus=probation` land pre-filtered.
  const [filters, setFilters] = useState<FilterState>(() => {
    const initial: FilterState = {};
    for (const key of URL_FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) initial[key] = value;
    }
    return initial;
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    const params: EmployeeListParams = {
      q: search || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      sortDir,
      ...filters,
      category: fixedCategory ?? filters.category,
      probation: filters.probation === "true" ? true : undefined,
      employed: filters.employed === "true" ? true : undefined,
    };

    employeeService
      .list(params)
      .then((r) => setResult({ data: r.data, total: r.total }))
      .catch((e) => setError(e?.error ?? "Couldn't load employees."))
      .finally(() => setLoading(false));
  }, [search, page, sortBy, sortDir, filters, fixedCategory]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    hrLookupService.all().then(setLookups).catch(() => undefined);
  }, []);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const addHref = fixedCategory === "teacher" ? "/employees/new?category=teacher" : "/employees/new";
  const noun = fixedCategory === "teacher" ? "teacher" : "employee";

  function setFilter(key: keyof FilterState, value: string) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  }

  function clearFilters() {
    setPage(1);
    setFilters({});
    router.replace(fixedCategory === "teacher" ? "/employees/teachers" : "/employees");
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  const allOnPageSelected = useMemo(
    () => Boolean(result?.data.length) && result!.data.every((e) => selected.has(e.id)),
    [result, selected],
  );

  function toggleAll() {
    if (!result) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) result.data.forEach((e) => next.delete(e.id));
      else result.data.forEach((e) => next.add(e.id));
      return next;
    });
  }

  /**
   * Exports what the current filters select, not just the visible page — an
   * export of 20 rows when the filter matches 400 would quietly mislead.
   */
  async function exportCsv() {
    try {
      const all = await employeeService.list({
        q: search || undefined,
        pageSize: 100,
        page: 1,
        sortBy,
        sortDir,
        ...filters,
        category: fixedCategory ?? filters.category,
        probation: filters.probation === "true" ? true : undefined,
        employed: filters.employed === "true" ? true : undefined,
      });
      const rows = selected.size > 0 ? all.data.filter((e) => selected.has(e.id)) : all.data;
      const csv = toCsv(rows, [
        { header: "Employee ID", value: (r) => r.employeeId },
        { header: "Name", value: (r) => r.fullName },
        { header: "Department", value: (r) => r.department?.name ?? "" },
        { header: "Designation", value: (r) => r.designation },
        { header: "Employee type", value: (r) => r.employeeType ?? "" },
        { header: "Campus", value: (r) => r.campus?.name ?? "" },
        { header: "Reporting manager", value: (r) => r.reportingManager?.fullName ?? "" },
        { header: "Joining date", value: (r) => r.joiningDate?.slice(0, 10) ?? "" },
        { header: "Status", value: (r) => EMPLOYMENT_STATUS_LABELS[r.employmentStatus as EmploymentStatus] ?? r.employmentStatus },
        { header: "Mobile", value: (r) => r.mobileNumber },
        { header: "Email", value: (r) => r.email ?? "" },
      ]);
      downloadCsv(`employees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast({ title: `Exported ${rows.length} employee${rows.length === 1 ? "" : "s"}`, variant: "success" });
    } catch {
      toast({ title: "Couldn't export employees", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search name, ID, phone, email…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="size-4" /> Filters
          {activeFilterCount > 0 && <Badge variant="info">{activeFilterCount}</Badge>}
        </Button>

        {can("employees", "export") && (
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
        )}

        {can("employees", "create") && (
          <Button asChild className="ml-auto">
            <Link href={addHref}>
              <Plus className="size-4" /> Add {noun}
            </Link>
          </Button>
        )}
      </div>

      {showFilters && (
        <Card>
          <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-3">
            {!fixedCategory && (
              <FilterSelect
                label="Category"
                value={filters.category ?? ""}
                onChange={(v) => setFilter("category", v)}
                options={STAFF_CATEGORIES.map((c) => ({ value: c, label: STAFF_CATEGORY_LABELS[c] }))}
              />
            )}
            <FilterSelect
              label="Status"
              value={filters.employmentStatus ?? ""}
              onChange={(v) => setFilter("employmentStatus", v)}
              options={EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: EMPLOYMENT_STATUS_LABELS[s] }))}
            />
            <FilterSelect
              label="Department"
              value={filters.departmentId ?? ""}
              onChange={(v) => setFilter("departmentId", v)}
              options={(lookups?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
            <FilterSelect
              label="Designation"
              value={filters.designationId ?? ""}
              onChange={(v) => setFilter("designationId", v)}
              options={(lookups?.designations ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
            <FilterSelect
              label="Employee type"
              value={filters.employeeTypeId ?? ""}
              onChange={(v) => setFilter("employeeTypeId", v)}
              options={(lookups?.employeeTypes ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
            <FilterSelect
              label="Campus"
              value={filters.campusId ?? ""}
              onChange={(v) => setFilter("campusId", v)}
              options={(lookups?.campuses ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <FilterSelect
              label="Gender"
              value={filters.gender ?? ""}
              onChange={(v) => setFilter("gender", v)}
              options={GENDERS.map((g) => ({ value: g, label: g[0].toUpperCase() + g.slice(1) }))}
            />
            <FilterSelect
              label="Reporting manager"
              value={filters.reportingManagerId ?? ""}
              onChange={(v) => setFilter("reportingManagerId", v)}
              options={(lookups?.managers ?? []).map((m) => ({ value: m.id, label: m.fullName }))}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Joined between</span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label="Joined from"
                  value={filters.joinedFrom ?? ""}
                  onChange={(e) => setFilter("joinedFrom", e.target.value)}
                />
                <Input
                  type="date"
                  aria-label="Joined to"
                  value={filters.joinedTo ?? ""}
                  onChange={(e) => setFilter("joinedTo", e.target.value)}
                />
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="size-4" /> Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm">
          <span className="font-medium">
            {selected.size} selected
          </span>
          {can("employees", "export") && (
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download className="size-4" /> Export selected
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {loading && <TableSkeleton rows={6} columns={7} />}
      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={UserCog}
          title={`No ${noun}s found`}
          description={
            activeFilterCount > 0 || search
              ? "No records match the current search and filters."
              : "Add your first employee to get started."
          }
          action={
            activeFilterCount > 0 || search ? (
              <Button size="sm" variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : can("employees", "create") ? (
              <Button asChild size="sm">
                <Link href={addHref}>
                  <Plus className="size-4" /> Add {noun}
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          {/* Wide table scrolls inside its own container rather than the page. */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all on this page"
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Employee" column="fullName" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  </TableHead>
                  <TableHead>
                    <SortButton label="ID" column="employeeId" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  </TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>
                    <SortButton label="Joined" column="joiningDate" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  </TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.map((employee) => {
                  const status = employee.employmentStatus as EmploymentStatus;
                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(employee.id)}
                          onCheckedChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(employee.id)) next.delete(employee.id);
                              else next.add(employee.id);
                              return next;
                            })
                          }
                          aria-label={`Select ${employee.fullName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            initials={employee.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                            size="sm"
                          />
                          <Link href={`/employees/${employee.id}`} className="font-medium hover:underline">
                            {employee.fullName}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{employee.employeeId}</TableCell>
                      <TableCell>{employee.department?.name ?? "—"}</TableCell>
                      <TableCell>{employee.designation || "—"}</TableCell>
                      <TableCell>{employee.employeeType ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{employee.joiningDate?.slice(0, 10) ?? "—"}</TableCell>
                      <TableCell>{employee.reportingManager?.fullName ?? "—"}</TableCell>
                      <TableCell>{employee.campus?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={EMPLOYMENT_STATUS_TONES[status] ?? "neutral"}>
                          {EMPLOYMENT_STATUS_LABELS[status] ?? employee.employmentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/employees/${employee.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} record{result.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
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
    </div>
  );
}

function SortButton({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (column: string) => void;
}) {
  const active = sortBy === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="flex items-center gap-1 font-medium hover:text-foreground"
      aria-label={`Sort by ${label}${active ? `, currently ${sortDir}ending` : ""}`}
    >
      {label}
      <ArrowUpDown className={active ? "size-3.5 text-primary-600" : "size-3.5 opacity-40"} aria-hidden="true" />
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Any" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
