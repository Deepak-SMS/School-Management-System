"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, GripVertical, KeyRound, ShieldOff, Users, Building, UserCog } from "lucide-react";
import { ASSIGNABLE_ROLE_LABELS } from "@/config/roles-assignable";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessDialog } from "@/features/organization/access-dialog";
import { OrganizationTree } from "@/features/organization/organization-tree";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

export interface OrgPerson {
  id: string;
  name: string;
  employeeId: string;
  category: string;
  employmentStatus: string;
  departmentId: string | null;
  reportingManagerId: string | null;
  designation: string | null;
  access: { role: string; email: string; isActive: boolean } | null;
}

interface OrgDepartment {
  id: string;
  name: string;
  code: string;
  departmentType: string;
  headStaffId: string | null;
  status: string;
}

/**
 * The school's reporting structure, grouped by department.
 *
 * Dragging a person onto another makes them report to that person; dropping onto
 * a department header moves them into it; dropping onto "Not reporting to
 * anyone" detaches them. Each drop is a single PATCH — the server rejects a move
 * that would make the reporting line loop back on itself.
 */
export function OrganizationChart() {
  const can = useCan();
  const canEdit = can("employees", "edit");
  const canManageAccess = can("schoolProfile", "edit") && canEdit;

  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [people, setPeople] = useState<OrgPerson[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<OrgPerson | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [accessFor, setAccessFor] = useState<OrgPerson | null>(null);
  const [view, setView] = useState<"tree" | "list">("tree");
  const [schoolName, setSchoolName] = useState("School");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/organization")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setDepartments(body.departments);
        setPeople(body.people);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    // The chart's root box is the school itself, so top-level people have
    // something to hang from.
    fetch("/api/school")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.name) setSchoolName(body.name);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const byManager = useMemo(() => {
    const map = new Map<string | null, OrgPerson[]>();
    for (const person of people ?? []) {
      const key = person.reportingManagerId;
      map.set(key, [...(map.get(key) ?? []), person]);
    }
    return map;
  }, [people]);

  async function move(person: OrgPerson, patch: { reportingManagerId?: string | null; departmentId?: string | null }) {
    // Applied locally first so the chart responds immediately; a rejected move
    // is rolled back by the reload in the catch.
    setPeople((prev) =>
      (prev ?? []).map((p) =>
        p.id === person.id
          ? {
              ...p,
              ...(patch.reportingManagerId !== undefined && { reportingManagerId: patch.reportingManagerId }),
              ...(patch.departmentId !== undefined && { departmentId: patch.departmentId }),
            }
          : p,
      ),
    );

    try {
      const response = await fetch(`/api/organization/staff/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json();
      if (!response.ok) throw body;
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't move that person", variant: "danger" });
      reload();
    }
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (error) return <ErrorState description="Couldn't load the organisation chart." onRetry={reload} />;
  if (!people) return <LoadingState />;

  if (people.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No employees yet"
        description="Add employees and they'll appear here, ready to be arranged into reporting lines."
        action={
          <Button asChild size="sm">
            <Link href="/employees/new">Add employee</Link>
          </Button>
        }
      />
    );
  }

  const matches = (p: OrgPerson) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.employeeId.toLowerCase().includes(search.toLowerCase());

  const unassigned = people.filter((p) => !p.departmentId);

  const departmentNames = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={view} onValueChange={(v) => setView(v as "tree" | "list")}>
        <TabsList>
          <TabsTrigger value="tree">Chart</TabsTrigger>
          <TabsTrigger value="list">By department</TabsTrigger>
        </TabsList>
      </Tabs>

      {canEdit && (
        <Alert variant="info">
          {view === "tree"
            ? "Drag a person onto someone else to make them report to them, or onto the school at the top to move them to the top level."
            : "Drag a person onto someone else to make them report to them, onto a department to move them there, or onto Not reporting to anyone to detach them."}
        </Alert>
      )}

      {view === "tree" && (
        <OrganizationTree
          people={people}
          departmentNames={departmentNames}
          schoolName={schoolName}
          canEdit={canEdit}
          canManageAccess={canManageAccess}
          dragging={dragging}
          setDragging={setDragging}
          onDropOnPerson={(target) => {
            if (dragging && dragging.id !== target.id) {
              move(dragging, { reportingManagerId: target.id, departmentId: target.departmentId });
            }
            setDragging(null);
          }}
          onDropOnRoot={() => {
            if (dragging) move(dragging, { reportingManagerId: null });
            setDragging(null);
          }}
          onGrantAccess={setAccessFor}
        />
      )}

      {view === "tree" && accessFor && (
        <AccessDialog
          person={accessFor}
          onClose={() => setAccessFor(null)}
          onSaved={() => {
            setAccessFor(null);
            reload();
          }}
        />
      )}

      {view === "list" && (
        <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input placeholder="Find a person…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground">
          {people.length} {people.length === 1 ? "person" : "people"} · {departments.length} departments
        </span>
      </div>

      {departments.map((department) => {
        const inDepartment = people.filter((p) => p.departmentId === department.id);
        // Roots within a department: nobody above them, or a manager who sits elsewhere.
        const roots = inDepartment.filter(
          (p) => !p.reportingManagerId || !inDepartment.some((x) => x.id === p.reportingManagerId),
        );
        const isCollapsed = collapsed.has(department.id);

        return (
          <section
            key={department.id}
            className={cn(
              "rounded-lg border transition-colors",
              dropTarget === `dept:${department.id}` ? "border-primary-500 bg-primary-50/40" : "border-border",
            )}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              setDropTarget(`dept:${department.id}`);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropTarget(null);
              if (dragging && dragging.departmentId !== department.id) {
                move(dragging, { departmentId: department.id });
              }
              setDragging(null);
            }}
          >
            <button
              type="button"
              onClick={() => toggle(department.id)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <ChevronDown
                className={cn("size-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")}
                aria-hidden="true"
              />
              <Building className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium text-foreground">{department.name}</span>
              <Badge variant="neutral">{inDepartment.length}</Badge>
            </button>

            {!isCollapsed && (
              <div className="border-t border-border px-4 py-3">
                {inDepartment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nobody here yet{canEdit ? " — drag someone onto this department." : "."}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {roots.filter(matches).map((person) => (
                      <PersonNode
                        key={person.id}
                        person={person}
                        depth={0}
                        byManager={byManager}
                        isHead={department.headStaffId === person.id}
                        canEdit={canEdit}
                        canManageAccess={canManageAccess}
                        dragging={dragging}
                        dropTarget={dropTarget}
                        setDragging={setDragging}
                        setDropTarget={setDropTarget}
                        onDropOn={(target) => {
                          if (dragging && dragging.id !== target.id) {
                            move(dragging, { reportingManagerId: target.id, departmentId: target.departmentId });
                          }
                          setDragging(null);
                        }}
                        onGrantAccess={setAccessFor}
                        matches={matches}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}

      <section
        className={cn(
          "rounded-lg border border-dashed p-4 transition-colors",
          dropTarget === "unassigned" ? "border-primary-500 bg-primary-50/40" : "border-border",
        )}
        onDragOver={(e) => {
          if (!dragging) return;
          e.preventDefault();
          setDropTarget("unassigned");
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDropTarget(null);
          if (dragging) move(dragging, { reportingManagerId: null, departmentId: null });
          setDragging(null);
        }}
      >
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <UserCog className="size-4 text-muted-foreground" aria-hidden="true" />
          Not reporting to anyone
          <Badge variant="neutral">{unassigned.length}</Badge>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          People with no department. Drop someone here to detach them.
        </p>

        {unassigned.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {unassigned.filter(matches).map((person) => (
              <PersonNode
                key={person.id}
                person={person}
                depth={0}
                byManager={byManager}
                isHead={false}
                canEdit={canEdit}
                canManageAccess={canManageAccess}
                dragging={dragging}
                dropTarget={dropTarget}
                setDragging={setDragging}
                setDropTarget={setDropTarget}
                onDropOn={(target) => {
                  if (dragging && dragging.id !== target.id) {
                    move(dragging, { reportingManagerId: target.id, departmentId: target.departmentId });
                  }
                  setDragging(null);
                }}
                onGrantAccess={setAccessFor}
                matches={matches}
              />
            ))}
          </ul>
        )}
      </section>

      {accessFor && (
        <AccessDialog
          person={accessFor}
          onClose={() => setAccessFor(null)}
          onSaved={() => {
            setAccessFor(null);
            reload();
          }}
        />
      )}
        </>
      )}
    </div>
  );
}

function PersonNode({
  person,
  depth,
  byManager,
  isHead,
  canEdit,
  canManageAccess,
  dragging,
  dropTarget,
  setDragging,
  setDropTarget,
  onDropOn,
  onGrantAccess,
  matches,
}: {
  person: OrgPerson;
  depth: number;
  byManager: Map<string | null, OrgPerson[]>;
  isHead: boolean;
  canEdit: boolean;
  canManageAccess: boolean;
  dragging: OrgPerson | null;
  dropTarget: string | null;
  setDragging: (p: OrgPerson | null) => void;
  setDropTarget: (t: string | null) => void;
  onDropOn: (target: OrgPerson) => void;
  onGrantAccess: (p: OrgPerson) => void;
  matches: (p: OrgPerson) => boolean;
}) {
  const reports = byManager.get(person.id) ?? [];
  const isDropTarget = dropTarget === `person:${person.id}`;
  const isDragging = dragging?.id === person.id;

  return (
    <li>
      <div
        draggable={canEdit}
        onDragStart={() => setDragging(person)}
        onDragEnd={() => {
          setDragging(null);
          setDropTarget(null);
        }}
        onDragOver={(e) => {
          if (!dragging || dragging.id === person.id) return;
          e.preventDefault();
          e.stopPropagation();
          setDropTarget(`person:${person.id}`);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDropTarget(null);
          onDropOn(person);
        }}
        style={{ marginLeft: depth * 20 }}
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 transition-colors",
          isDropTarget ? "border-primary-500 bg-primary-50" : "border-border bg-surface-raised",
          isDragging && "opacity-40",
          canEdit && "cursor-grab active:cursor-grabbing",
        )}
      >
        {canEdit && <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
            <Link href={`/employees/${person.id}`} className="hover:underline">
              {person.name}
            </Link>
            {isHead && <Badge variant="info">Head</Badge>}
            {person.access ? (
              <Badge variant="success">
                {ASSIGNABLE_ROLE_LABELS[person.access.role as keyof typeof ASSIGNABLE_ROLE_LABELS] ??
                  person.access.role}
              </Badge>
            ) : (
              <Badge variant="neutral">No login</Badge>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {person.employeeId}
            {person.designation ? ` · ${person.designation}` : ""}
            {reports.length > 0 ? ` · ${reports.length} report${reports.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>

        {canManageAccess && (
          <Button variant="ghost" size="sm" onClick={() => onGrantAccess(person)}>
            {person.access ? <ShieldOff className="size-4" /> : <KeyRound className="size-4" />}
            {person.access ? "Access" : "Grant access"}
          </Button>
        )}
      </div>

      {reports.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {reports.filter(matches).map((report) => (
            <PersonNode
              key={report.id}
              person={report}
              depth={depth + 1}
              byManager={byManager}
              isHead={false}
              canEdit={canEdit}
              canManageAccess={canManageAccess}
              dragging={dragging}
              dropTarget={dropTarget}
              setDragging={setDragging}
              setDropTarget={setDropTarget}
              onDropOn={onDropOn}
              onGrantAccess={onGrantAccess}
              matches={matches}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
