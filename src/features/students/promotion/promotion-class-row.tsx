"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PromotionAction } from "@/lib/validation/promotion";
import type { PromotionPreviewClass, PromotionTargetClass } from "@/services/promotionService";

export interface ClassOutcome {
  action: PromotionAction;
  targetClassId?: string;
  targetSectionId?: string;
}

const ACTION_LABELS: Record<PromotionAction, string> = {
  promote: "Promote to",
  retain: "Retain (repeat grade)",
  exit: "Graduate / exit",
};

interface PromotionClassRowProps {
  cls: PromotionPreviewClass;
  outcome: ClassOutcome;
  onChange: (outcome: ClassOutcome) => void;
  targetClasses: PromotionTargetClass[];
  expanded: boolean;
  onToggleExpand: () => void;
  studentOverrides: Record<string, PromotionAction>;
  onStudentOverrideChange: (studentId: string, action: PromotionAction | null) => void;
  /** Suggested target class id for each action, so switching Promote ↔ Retain re-defaults sensibly instead of clearing to blank. */
  suggestions: { promote?: string; retain?: string };
}

export function PromotionClassRow({
  cls,
  outcome,
  onChange,
  targetClasses,
  expanded,
  onToggleExpand,
  studentOverrides,
  onStudentOverrideChange,
  suggestions,
}: PromotionClassRowProps) {
  const targetClass = targetClasses.find((c) => c.id === outcome.targetClassId);
  const needsTarget = outcome.action !== "exit";
  const unresolved = needsTarget && !outcome.targetClassId;

  return (
    <>
      <TableRow className={cn(unresolved && "bg-danger-50/60 dark:bg-danger-500/10")}>
        <TableCell>
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary-600"
          >
            {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
            {cls.name}
          </button>
        </TableCell>
        <TableCell className="tabular-nums">{cls.studentCount}</TableCell>
        <TableCell>
          <Select
            value={outcome.action}
            onValueChange={(v) => {
              const action = v as PromotionAction;
              const targetClassId = action === "promote" ? suggestions.promote : action === "retain" ? suggestions.retain : undefined;
              onChange({ action, targetClassId, targetSectionId: undefined });
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ACTION_LABELS) as PromotionAction[]).map((action) => (
                <SelectItem key={action} value={action}>
                  {ACTION_LABELS[action]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          {needsTarget ? (
            <Select
              value={outcome.targetClassId ?? "unresolved"}
              onValueChange={(v) => onChange({ ...outcome, targetClassId: v, targetSectionId: undefined })}
            >
              <SelectTrigger className={cn("w-44", unresolved && "border-danger-500 focus:border-danger-500 focus:ring-danger-500/30")}>
                <SelectValue placeholder="Pick a class" />
              </SelectTrigger>
              <SelectContent>
                {unresolved && (
                  <SelectItem value="unresolved" disabled>
                    No suggestion — pick one
                  </SelectItem>
                )}
                {targetClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {needsTarget && targetClass && targetClass.sections.length > 0 ? (
            <Select
              value={outcome.targetSectionId ?? "unassigned"}
              onValueChange={(v) => onChange({ ...outcome, targetSectionId: v === "unassigned" ? undefined : v })}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {targetClass.sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-black/[.02] p-0 dark:bg-white/[.02]">
            <div className="flex flex-col divide-y divide-border px-4">
              {cls.students.map((student) => {
                const override = studentOverrides[student.id];
                return (
                  <div key={student.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="text-foreground">{student.fullName}</span>{" "}
                      <span className="text-muted-foreground">
                        · {student.admissionNumber}
                        {student.rollNumber ? ` · Roll ${student.rollNumber}` : ""}
                      </span>
                      {override && (
                        <Badge variant="warning" className="ml-2">
                          Exception
                        </Badge>
                      )}
                    </div>
                    <Select
                      value={override ?? "default"}
                      onValueChange={(v) => onStudentOverrideChange(student.id, v === "default" ? null : (v as PromotionAction))}
                    >
                      <SelectTrigger className="w-52 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Follow class ({ACTION_LABELS[outcome.action]})</SelectItem>
                        {(Object.keys(ACTION_LABELS) as PromotionAction[]).map((action) => (
                          <SelectItem key={action} value={action}>
                            {ACTION_LABELS[action]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
