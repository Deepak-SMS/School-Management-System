"use client";

import { useEffect, useState } from "react";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import type { ClassRecord } from "@/types/class";

export const DAILY_VALUE = "daily";

interface ClassSubject {
  id: string;
  name: string;
  code: string;
}

/**
 * The class → section → subject cascade shared by every admin-facing
 * attendance screen that browses the whole school (Mark Attendance, Class
 * Reports) rather than a teacher's own `getTeacherScope()`-scoped list.
 */
export function useClassSectionPicker(initialClassId = "") {
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [classId, setClassIdState] = useState(initialClassId);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [subjectId, setSubjectId] = useState(DAILY_VALUE);

  useEffect(() => {
    classService.list({ pageSize: 200, status: "active" }).then((r) => setClasses(r.data)).catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!classId) return;
    sectionService.list({ classId, pageSize: 100 }).then((r) => setSections(r.data.map((s) => ({ id: s.id, name: s.name })))).catch(() => setSections([]));
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    const selectedClass = classes?.find((c) => c.id === classId);
    if (!selectedClass) return;
    fetch(`/api/classes/${classId}/subjects?academicYearId=${selectedClass.academicYear.id}`)
      .then((r) => r.json())
      .then((body) => setSubjects(body.data.map((a: { subject: ClassSubject }) => a.subject)))
      .catch(() => setSubjects([]));
  }, [classId, classes]);

  function setClassId(id: string) {
    setClassIdState(id);
    setSectionId("");
    setSections([]);
    setSubjects([]);
    setSubjectId(DAILY_VALUE);
  }

  const selectedClass = classes?.find((c) => c.id === classId);
  const selectedSection = sections.find((s) => s.id === sectionId);
  const subjectName = subjectId === DAILY_VALUE ? undefined : subjects.find((s) => s.id === subjectId)?.name;

  return {
    classes,
    classId,
    setClassId,
    sections,
    sectionId,
    setSectionId,
    subjects,
    subjectId,
    setSubjectId,
    selectedClass,
    selectedSection,
    subjectName,
  };
}
