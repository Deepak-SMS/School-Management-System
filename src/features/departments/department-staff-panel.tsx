"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Trash2, Users, Pencil, Upload, UserPlus, Building } from "lucide-react";
import { departmentService } from "@/services/departmentService";
import { staffService } from "@/services/staffService";
import type { DepartmentRecord } from "@/types/department";
import type { StaffRecord } from "@/types/staff";
import { DEPARTMENT_TYPE_LABELS } from "@/lib/constants/school";
import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_STATUS_TONES, type EmploymentStatus } from "@/lib/constants/hr";
import { STAFF_CATEGORY_LABELS } from "@/lib/constants/people";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmployeeImportModal } from "@/features/departments/employee-import-modal";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

interface DepartmentStaff {
  id: string;
  fullName: string;
  employeeId: string;
  category: string;
  employmentStatus: string;
  mobileNumber: string;
  email?: string | null;
  designation: string;
  employeeType?: string | null;
  isHead: boolean;
}

/**
 * Departments with their staff underneath — the view a school actually works
 * from ("who is in Finance") rather than one employee at a time.
 *
 * Staff are moved between departments here; nobody is ever deleted from this
 * screen, because leaving the school is an HR action with its own workflow.
 */
export function DepartmentStaffPanel() {
  const can = useCan();
  const [departments, setDepartments] = useState<DepartmentRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    departmentService
      .list({ pageSize: 200 })
      .then((r) => {
        if (cancelled) return;
        setDepartments(r.data);
        setError(false);
        if (r.data[0]) setExpanded((prev) => (prev.size === 0 ? new Set([r.data[0].id]) : prev));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visible = useMemo(
    () =>
      (departments ?? []).filter(
        (d) => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()),
      ),
    [departments, search],
  );

  if (error) return <ErrorState description="Couldn't load departments." onRetry={reload} />;
  if (!departments) return <LoadingState />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input placeholder="Find a department…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {can("employees", "import") && (
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import employees
          </Button>
        )}

        {can("employees", "create") && (
          <Button asChild variant="secondary">
            <Link href="/employees/new">
              <UserPlus className="size-4" /> Add employee
            </Link>
          </Button>
        )}

        {can("departments", "create") && (
          <Button asChild className="ml-auto">
            <Link href="/school/departments/new">
              <Plus className="size-4" /> Add department
            </Link>
          </Button>
        )}
      </div>

      {departments.length === 0 ? (
        <EmptyState
          icon={Building}
          title="No departments yet"
          description="Create departments like Academics, Finance, Library or Transport, then place staff in them."
          action={
            can("departments", "create") ? (
              <Button asChild size="sm">
                <Link href="/school/departments/new">
                  <Plus className="size-4" /> Add department
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((dept) => (
            <DepartmentRow
              key={dept.id}
              dept={dept}
              expanded={expanded.has(dept.id)}
              onToggle={() => toggle(dept.id)}
              onChanged={reload}
            />
          ))}
        </div>
      )}

      <EmployeeImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          reload();
        }}
      />
    </div>
  );
}

function DepartmentRow({
  dept,
  expanded,
  onToggle,
  onChanged,
}: {
  dept: DepartmentRecord;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const can = useCan();
  const [staff, setStaff] = useState<DepartmentStaff[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<DepartmentStaff | null>(null);
  const [deletingDept, setDeletingDept] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;

    fetch(`/api/departments/${dept.id}/staff`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setStaff(body.data);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [expanded, dept.id, reloadKey]);

  async function removeFromDepartment() {
    if (!removing) return;
    try {
      const response = await fetch(`/api/departments/${dept.id}/staff/${removing.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({ title: `${removing.fullName} removed from ${dept.name}`, variant: "success" });
      setRemoving(null);
      reload();
      onChanged();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the employee", variant: "danger" });
      setRemoving(null);
    }
  }

  /**
   * The API refuses to delete a department that still has staff, since that
   * would orphan their records. Deactivate is the honest alternative, so the
   * dialog offers that instead of a delete that would fail.
   */
  async function deleteOrDeactivateDepartment() {
    try {
      if (hasStaff) {
        await departmentService.update(dept.id, { status: "inactive" });
        toast({ title: `${dept.name} deactivated`, variant: "success" });
      } else {
        await departmentService.remove(dept.id);
        toast({ title: `${dept.name} deleted`, variant: "success" });
      }
      setDeletingDept(false);
      onChanged();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the department", variant: "danger" });
      setDeletingDept(false);
    }
  }

  const employeeCount = staff?.length ?? dept.counts?.employees ?? 0;
  const hasStaff = employeeCount > 0;

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
          <span className="truncate font-medium text-foreground">{dept.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{dept.code}</span>
          <Badge variant="neutral">
            {DEPARTMENT_TYPE_LABELS[dept.departmentType as keyof typeof DEPARTMENT_TYPE_LABELS] ?? dept.departmentType}
          </Badge>
          <Badge variant={employeeCount > 0 ? "info" : "neutral"}>
            {employeeCount} employee{employeeCount === 1 ? "" : "s"}
          </Badge>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/school/departments/${dept.id}`}>View</Link>
          </Button>
          {can("departments", "edit") && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/school/departments/${dept.id}`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
          )}
          {can("departments", "delete") && (
            <Button variant="ghost" size="sm" onClick={() => setDeletingDept(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {loadError && <ErrorState description="Couldn't load this department's staff." onRetry={reload} />}
          {!loadError && !staff && <LoadingState />}

          {!loadError && staff && (
            <div className="flex flex-col gap-3">
              {staff.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={`No staff in ${dept.name} yet`}
                  description="Move existing employees here, or import a list."
                  action={
                    can("employees", "edit") ? (
                      <Button size="sm" onClick={() => setAdding(true)}>
                        <Plus className="size-4" /> Add staff
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <ul className="flex flex-col divide-y divide-border">
                    {staff.map((person) => {
                      const status = person.employmentStatus as EmploymentStatus;
                      return (
                        <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">
                              {person.fullName}
                              {person.isHead && (
                                <Badge variant="info" className="ml-2">
                                  Head
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {person.employeeId}
                              {" · "}
                              {person.designation || STAFF_CATEGORY_LABELS[person.category as keyof typeof STAFF_CATEGORY_LABELS] || person.category}
                              {person.employeeType ? ` · ${person.employeeType}` : ""}
                              {" · "}
                              {person.mobileNumber}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant={EMPLOYMENT_STATUS_TONES[status] ?? "neutral"}>
                              {EMPLOYMENT_STATUS_LABELS[status] ?? person.employmentStatus}
                            </Badge>
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/employees/${person.id}`}>View</Link>
                            </Button>
                            {can("employees", "edit") && (
                              <Button variant="ghost" size="sm" onClick={() => setRemoving(person)}>
                                <Trash2 className="size-4" /> Remove
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {can("employees", "edit") && (
                    <div>
                      <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                        <Plus className="size-4" /> Add staff to {dept.name}
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
        <AddStaffModal
          dept={dept}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            reload();
            onChanged();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={`Remove ${removing?.fullName ?? "employee"} from ${dept.name}?`}
        description="They stay on staff — only their department is cleared, so you can place them elsewhere."
        confirmLabel="Remove"
        onConfirm={removeFromDepartment}
      />

      <ConfirmDialog
        open={deletingDept}
        onOpenChange={setDeletingDept}
        title={hasStaff ? `Deactivate ${dept.name}?` : `Delete ${dept.name}?`}
        description={
          hasStaff
            ? `${employeeCount} employee(s) work here, so this department can't be deleted — that would orphan their records. It will be deactivated instead. Move the staff elsewhere first if you want to delete it.`
            : "This department has no staff and will be deleted permanently."
        }
        confirmLabel={hasStaff ? "Deactivate" : "Delete department"}
        variant="destructive"
        onConfirm={deleteOrDeactivateDepartment}
      />
    </div>
  );
}

function AddStaffModal({
  dept,
  onClose,
  onAdded,
}: {
  dept: DepartmentRecord;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [candidates, setCandidates] = useState<StaffRecord[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    staffService
      .list({ pageSize: 200 })
      .then((r) => {
        if (!cancelled) setCandidates(r.data);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Anyone not already in this department — including people with no department
  // at all, which is where newly imported staff land.
  const available = useMemo(
    () =>
      (candidates ?? [])
        .filter((s) => s.department?.id !== dept.id)
        .filter(
          (s) =>
            !search ||
            s.fullName.toLowerCase().includes(search.toLowerCase()) ||
            s.employeeId.toLowerCase().includes(search.toLowerCase()),
        ),
    [candidates, dept.id, search],
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/departments/${dept.id}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffIds: Array.from(selected) }),
      });
      const body = await response.json();
      if (!response.ok) throw body;

      toast({
        title: `Moved ${body.moved} employee${body.moved === 1 ? "" : "s"} to ${dept.name}`,
        description: body.alreadyHere > 0 ? `${body.alreadyHere} were already here.` : undefined,
        variant: "success",
      });
      onAdded();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't move those employees.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title={`Add staff to ${dept.name}`}
        description="An employee belongs to one department, so this moves them here from wherever they are now."
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <Input placeholder="Search by name or employee ID…" value={search} onChange={(e) => setSearch(e.target.value)} />

          {!candidates && <LoadingState />}

          {candidates && available.length === 0 && (
            <EmptyState
              title="Nobody to add"
              description={
                search ? "No employees match that search." : "Every employee is already in this department."
              }
            />
          )}

          {candidates && available.length > 0 && (
            <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
              {available.map((person) => (
                <li key={person.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                    <Checkbox
                      checked={selected.has(person.id)}
                      onCheckedChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(person.id)) next.delete(person.id);
                          else next.add(person.id);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{person.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {person.employeeId}
                        {person.designation ? ` · ${person.designation}` : ""}
                        {" · "}
                        {person.department?.name ?? "No department"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy} disabled={selected.size === 0}>
              Move {selected.size || ""} to {dept.name}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
