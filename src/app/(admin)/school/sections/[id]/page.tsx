"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Users, BookOpen, UserCog, DoorOpen } from "lucide-react";
import { sectionService, type SectionSubjectEntry } from "@/services/sectionService";
import { studentService } from "@/services/studentService";
import type { SectionRecord } from "@/types/section";
import type { StudentRecord } from "@/types/student";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

export default function SectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [section, setSection] = useState<SectionRecord | null>(null);
  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [subjects, setSubjects] = useState<SectionSubjectEntry[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    sectionService.get(id).then(setSection).catch(() => setError(true));
    studentService.list({ sectionId: id, pageSize: 100 }).then((r) => setStudents(r.data));
    sectionService.listSubjects(id).then((r) => setSubjects(r.data));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!section) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  const studentCount = section.counts?.students ?? 0;
  const availableSeats = section.capacity ? Math.max(0, section.capacity - studentCount) : null;
  const teachers = new Map<string, string>();
  if (section.classTeacher) teachers.set(section.classTeacher.id, section.classTeacher.fullName);
  subjects?.forEach((s) => {
    if (s.teacher) teachers.set(s.teacher.id, s.teacher.fullName);
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Sections", href: "/school/sections" },
            { label: section.name },
          ]}
        />
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">
            {section.class.name} - {section.name}
          </h1>
          <Badge variant={section.status === "active" ? "success" : "neutral"}>{section.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {section.academicYear.label} · {section.campus.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Students" value={section.capacity ? `${studentCount} / ${section.capacity}` : studentCount} icon={Users} />
        <StatCard label="Available seats" value={availableSeats ?? "—"} icon={DoorOpen} />
        <StatCard label="Subjects" value={subjects?.length ?? 0} icon={BookOpen} />
        <StatCard label="Teachers" value={teachers.size} icon={UserCog} />
      </div>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          {!students ? (
            <LoadingState className="py-8" />
          ) : students.length === 0 ? (
            <EmptyState icon={Users} title="No students yet" description="Students assigned to this section will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={`${student.firstName[0]}${student.lastName[0]}`} size="sm" />
                        <Link href={`/students/${student.id}`} className="font-medium hover:underline">
                          {student.firstName} {student.lastName}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{student.admissionNumber}</TableCell>
                    <TableCell>{student.rollNumber ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={student.status === "active" ? "success" : "neutral"}>{student.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="subjects">
          {!subjects ? (
            <LoadingState className="py-8" />
          ) : subjects.length === 0 ? (
            <EmptyState icon={BookOpen} title="No subjects assigned" description="Assign subjects to this section's class." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Teacher</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="capitalize">{subject.subjectType.replace("_", " ")}</TableCell>
                    <TableCell>{subject.teacher?.fullName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="teachers">
          {teachers.size === 0 ? (
            <EmptyState icon={UserCog} title="No teachers assigned" description="Assign a class teacher or subject teachers." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {[...teachers.entries()].map(([teacherId, name]) => (
                <li key={teacherId} className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2">
                  <Avatar initials={name.split(" ").map((n) => n[0]).slice(0, 2).join("")} size="sm" />
                  <span className="font-medium text-foreground">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
