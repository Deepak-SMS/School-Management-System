"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, GripVertical, KeyRound, Minus, Plus, School } from "lucide-react";
import { ASSIGNABLE_ROLE_LABELS } from "@/config/roles-assignable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrgPerson } from "@/features/organization/organization-chart";

/**
 * The organisation as a top-down chart: a box per person, connected by lines to
 * the people who report to them.
 *
 * Connectors are drawn with CSS borders rather than SVG or a layout library —
 * the boxes stay real DOM elements, so drag-and-drop, links and focus order all
 * keep working exactly as they do in the list view.
 */

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.15] as const;

export function OrganizationTree({
  people,
  departmentNames,
  schoolName,
  canEdit,
  canManageAccess,
  dragging,
  setDragging,
  onDropOnPerson,
  onDropOnRoot,
  onGrantAccess,
}: {
  people: OrgPerson[];
  departmentNames: Map<string, string>;
  schoolName: string;
  canEdit: boolean;
  canManageAccess: boolean;
  dragging: OrgPerson | null;
  setDragging: (p: OrgPerson | null) => void;
  onDropOnPerson: (target: OrgPerson) => void;
  onDropOnRoot: () => void;
  onGrantAccess: (p: OrgPerson) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoomIndex, setZoomIndex] = useState(3);
  const [rootHot, setRootHot] = useState(false);

  const byManager = useMemo(() => {
    const map = new Map<string | null, OrgPerson[]>();
    for (const person of people) {
      map.set(person.reportingManagerId, [...(map.get(person.reportingManagerId) ?? []), person]);
    }
    return map;
  }, [people]);

  // Anyone with no manager, or whose manager isn't in view, hangs off the school
  // itself — so nobody is silently missing from the chart.
  const roots = useMemo(() => {
    const ids = new Set(people.map((p) => p.id));
    return people.filter((p) => !p.reportingManagerId || !ids.has(p.reportingManagerId));
  }, [people]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const zoom = ZOOM_STEPS[zoomIndex];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {people.length} {people.length === 1 ? "person" : "people"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="Zoom in"
          >
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
            Expand all
          </Button>
        </div>
      </div>

      {/* A wide chart scrolls inside its own frame rather than the page. */}
      <div className="overflow-x-auto rounded-lg border border-border bg-background p-6">
        <div
          className="mx-auto w-fit origin-top transition-transform"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* The school is the trunk every top-level person hangs from, and the
              drop target for promoting someone to the top. */}
          <div className="flex flex-col items-center">
            <div
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setRootHot(true);
              }}
              onDragLeave={() => setRootHot(false)}
              onDrop={(e) => {
                e.preventDefault();
                setRootHot(false);
                onDropOnRoot();
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                rootHot
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-foreground/70 bg-surface-raised text-foreground",
              )}
            >
              <School className="size-4" aria-hidden="true" />
              {schoolName}
            </div>

            {roots.length > 0 && (
              <>
                {/* Trunk from the school down to the first row. */}
                <span className="h-6 w-px bg-border-strong" aria-hidden="true" />
                <ChildRow
                  nodes={roots}
                  byManager={byManager}
                  departmentNames={departmentNames}
                  collapsed={collapsed}
                  toggle={toggle}
                  canEdit={canEdit}
                  canManageAccess={canManageAccess}
                  dragging={dragging}
                  setDragging={setDragging}
                  onDropOnPerson={onDropOnPerson}
                  onGrantAccess={onGrantAccess}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One row of siblings plus their subtrees.
 *
 * The connector bracket is three pieces: a stub down into each child, and a
 * horizontal rule across the row that is trimmed to half-width at the first and
 * last child so it starts and ends under a box rather than in mid-air.
 */
function ChildRow({
  nodes,
  byManager,
  departmentNames,
  collapsed,
  toggle,
  canEdit,
  canManageAccess,
  dragging,
  setDragging,
  onDropOnPerson,
  onGrantAccess,
}: {
  nodes: OrgPerson[];
  byManager: Map<string | null, OrgPerson[]>;
  departmentNames: Map<string, string>;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  canEdit: boolean;
  canManageAccess: boolean;
  dragging: OrgPerson | null;
  setDragging: (p: OrgPerson | null) => void;
  onDropOnPerson: (target: OrgPerson) => void;
  onGrantAccess: (p: OrgPerson) => void;
}) {
  return (
    <div className="flex items-start justify-center">
      {nodes.map((node, index) => {
        const reports = byManager.get(node.id) ?? [];
        const isCollapsed = collapsed.has(node.id);
        const isFirst = index === 0;
        const isLast = index === nodes.length - 1;
        const isOnly = nodes.length === 1;

        return (
          <div key={node.id} className="flex flex-col items-center px-3">
            {/* Horizontal bracket across siblings — hidden when there's only one. */}
            <div className="relative h-6 w-full">
              {!isOnly && (
                <span
                  className={cn(
                    "absolute top-0 h-px bg-border-strong",
                    isFirst && "left-1/2 right-0",
                    isLast && "left-0 right-1/2",
                    !isFirst && !isLast && "left-0 right-0",
                  )}
                  aria-hidden="true"
                />
              )}
              {/* Stub down into this box. */}
              <span className="absolute left-1/2 top-0 h-6 w-px bg-border-strong" aria-hidden="true" />
            </div>

            <PersonBox
              person={node}
              departmentName={node.departmentId ? departmentNames.get(node.departmentId) : undefined}
              reportCount={reports.length}
              isCollapsed={isCollapsed}
              onToggle={() => toggle(node.id)}
              canEdit={canEdit}
              canManageAccess={canManageAccess}
              dragging={dragging}
              setDragging={setDragging}
              onDropOnPerson={onDropOnPerson}
              onGrantAccess={onGrantAccess}
            />

            {reports.length > 0 && !isCollapsed && (
              <>
                <span className="h-6 w-px bg-border-strong" aria-hidden="true" />
                <ChildRow
                  nodes={reports}
                  byManager={byManager}
                  departmentNames={departmentNames}
                  collapsed={collapsed}
                  toggle={toggle}
                  canEdit={canEdit}
                  canManageAccess={canManageAccess}
                  dragging={dragging}
                  setDragging={setDragging}
                  onDropOnPerson={onDropOnPerson}
                  onGrantAccess={onGrantAccess}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PersonBox({
  person,
  departmentName,
  reportCount,
  isCollapsed,
  onToggle,
  canEdit,
  canManageAccess,
  dragging,
  setDragging,
  onDropOnPerson,
  onGrantAccess,
}: {
  person: OrgPerson;
  departmentName?: string;
  reportCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  canEdit: boolean;
  canManageAccess: boolean;
  dragging: OrgPerson | null;
  setDragging: (p: OrgPerson | null) => void;
  onDropOnPerson: (target: OrgPerson) => void;
  onGrantAccess: (p: OrgPerson) => void;
}) {
  const [hot, setHot] = useState(false);
  const isDragging = dragging?.id === person.id;

  return (
    <div
      draggable={canEdit}
      onDragStart={() => setDragging(person)}
      onDragEnd={() => {
        setDragging(null);
        setHot(false);
      }}
      onDragOver={(e) => {
        if (!dragging || dragging.id === person.id) return;
        e.preventDefault();
        e.stopPropagation();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setHot(false);
        onDropOnPerson(person);
      }}
      className={cn(
        "relative w-52 rounded-lg border bg-surface-raised px-3 py-2.5 shadow-sm transition-colors",
        hot ? "border-primary-500 ring-2 ring-primary-500/30" : "border-border",
        isDragging && "opacity-40",
        canEdit && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canEdit && (
          <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/employees/${person.id}`}
            className="block truncate text-sm font-medium text-foreground hover:underline"
          >
            {person.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{person.designation ?? person.employeeId}</p>
          {departmentName && <p className="truncate text-xs text-muted-foreground">{departmentName}</p>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {person.access ? (
          <Badge variant="success">
            {ASSIGNABLE_ROLE_LABELS[person.access.role as keyof typeof ASSIGNABLE_ROLE_LABELS] ?? person.access.role}
          </Badge>
        ) : (
          <Badge variant="neutral">No login</Badge>
        )}

        {canManageAccess && (
          <button
            type="button"
            onClick={() => onGrantAccess(person)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            aria-label={person.access ? `Manage access for ${person.name}` : `Grant access to ${person.name}`}
          >
            <KeyRound className="size-3.5" />
          </button>
        )}
      </div>

      {/* Collapse control sits on the box so a large branch can be folded away. */}
      {reportCount > 0 && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute -bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          aria-expanded={!isCollapsed}
          aria-label={`${isCollapsed ? "Show" : "Hide"} ${reportCount} report${reportCount === 1 ? "" : "s"} under ${person.name}`}
        >
          {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
          {reportCount}
        </button>
      )}
    </div>
  );
}
