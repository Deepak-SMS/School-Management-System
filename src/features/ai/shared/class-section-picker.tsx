"use client";

import { useEffect, useState } from "react";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Option {
  id: string;
  name: string;
}

interface ClassSectionPickerProps {
  classId: string | undefined;
  sectionId: string | undefined;
  onClassChange: (classId: string | undefined) => void;
  onSectionChange: (sectionId: string | undefined) => void;
}

const ALL = "__all__";

/** Class + Section filter pair, shared by AI Analytics, Report Generator, and Communication Assistant — section options reset whenever the class changes. */
export function ClassSectionPicker({ classId, sectionId, onClassChange, onSectionChange }: ClassSectionPickerProps) {
  const [classes, setClasses] = useState<Option[] | null>(null);
  const [sections, setSections] = useState<Option[] | null>(null);

  useEffect(() => {
    classService.list({ pageSize: 100 }).then((r) => setClasses(r.data));
  }, []);

  useEffect(() => {
    if (!classId) return;
    sectionService.list({ classId, pageSize: 100 }).then((r) => setSections(r.data));
  }, [classId]);

  // Rendered instead of resetting `sections` in the effect above: a stale
  // fetch for the previously-selected class should never appear once the
  // class is cleared, but the class of that stale response is stamped on
  // each option's parent id, not tracked separately here — simplest correct
  // fix is to just not show any options when there's no class selected.
  const visibleSections = classId ? sections : null;

  return (
    <>
      <Select
        value={classId ?? ALL}
        onValueChange={(v) => {
          onClassChange(v === ALL ? undefined : v);
          onSectionChange(undefined);
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All classes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All classes</SelectItem>
          {classes?.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sectionId ?? ALL} onValueChange={(v) => onSectionChange(v === ALL ? undefined : v)} disabled={!classId}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All sections" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All sections</SelectItem>
          {visibleSections?.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
