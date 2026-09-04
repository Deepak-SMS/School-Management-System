"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Users } from "lucide-react";
import { studentService } from "@/services/studentService";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure, StudentDocumentRecord, StudentRecord } from "@/types/student";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DocumentGroup } from "@/features/students/document-group";
import { cn } from "@/lib/utils";

/** Pick a class, then a section, to browse every filed document for that section's students. */
export function StudentDocumentsBrowser() {
  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [studentsError, setStudentsError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [documents, setDocuments] = useState<StudentDocumentRecord[] | null>(null);
  const [documentsError, setDocumentsError] = useState(false);

  useEffect(() => {
    schoolStructureService.get().then(setStructure).catch(() => {});
  }, []);

  const selectedClass = structure?.classes.find((c) => c.id === classId);

  function loadStudents(forClassId: string, forSectionId: string) {
    setStudentsError(false);
    setStudents(null);
    setSelectedId(null);
    setDocuments(null);
    studentService
      .list({ classId: forClassId, sectionId: forSectionId || undefined, pageSize: 100 })
      .then((result) => {
        setStudents(result.data);
        if (result.data[0]) setSelectedId(result.data[0].id);
      })
      .catch(() => setStudentsError(true));
  }

  function handleClassChange(value: string) {
    const nextClassId = value === "all" ? "" : value;
    setClassId(nextClassId);
    setSectionId("");
    setStudents(null);
    setSelectedId(null);
    setDocuments(null);
    if (nextClassId) loadStudents(nextClassId, "");
  }

  function handleSectionChange(value: string) {
    const nextSectionId = value === "all" ? "" : value;
    setSectionId(nextSectionId);
    if (classId) loadStudents(classId, nextSectionId);
  }

  function loadDocuments(studentId: string) {
    setDocumentsError(false);
    setDocuments(null);
    studentService
      .listDocuments(studentId)
      .then((r) => setDocuments(r.data))
      .catch(() => setDocumentsError(true));
  }

  useEffect(() => {
    if (selectedId) setTimeout(() => loadDocuments(selectedId), 0);
  }, [selectedId]);

  const selectedStudent = students?.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={classId || undefined} onValueChange={handleClassChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {structure?.classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sectionId || "all"} onValueChange={handleSectionChange} disabled={!classId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {selectedClass?.sections.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                {section.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!classId && (
        <EmptyState
          icon={Users}
          title="Pick a class and section"
          description="Choose a class above to see its students and every document filed for them."
        />
      )}

      {classId && studentsError && <ErrorState onRetry={() => loadStudents(classId, sectionId)} />}

      {classId && !studentsError && students === null && <LoadingState />}

      {classId && !studentsError && students !== null && students.length === 0 && (
        <EmptyState icon={Users} title="No students here" description="This class and section has no students yet." />
      )}

      {classId && !studentsError && students !== null && students.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-2 lg:max-h-[70vh] lg:overflow-y-auto">
            {students.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => setSelectedId(student.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]",
                  student.id === selectedId && "bg-primary-50 dark:bg-primary-500/10",
                )}
              >
                <Avatar initials={`${student.firstName[0]}${student.lastName[0]}`} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {student.firstName} {student.lastName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {student.admissionNumber}
                    {student.rollNumber ? ` · Roll ${student.rollNumber}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {selectedStudent && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedStudent.admissionNumber} · {selectedStudent.class.name}
                    {selectedStudent.section ? `-${selectedStudent.section.name}` : ""}
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/students/${selectedStudent.id}`}>View profile</Link>
                </Button>
              </div>
            )}

            {documentsError && <ErrorState onRetry={() => selectedId && loadDocuments(selectedId)} />}
            {!documentsError && documents === null && <LoadingState />}
            {!documentsError && documents !== null && documents.length === 0 && (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Admission papers and academic records filed for this student will appear here."
              />
            )}
            {!documentsError && documents !== null && documents.length > 0 && (
              <>
                <DocumentGroup title="Admission documents" documents={documents.filter((d) => d.category === "admission")} />
                <DocumentGroup title="Academic documents" documents={documents.filter((d) => d.category === "academic")} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
