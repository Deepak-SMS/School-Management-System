"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Users, BookOpen, UserCog } from "lucide-react";
import { classService, type ClassTeacherEntry } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import { subjectService } from "@/services/subjectService";
import { studentService } from "@/services/studentService";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";
import type { SubjectRecord } from "@/types/subject";
import type { StudentRecord } from "@/types/student";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cls, setCls] = useState<ClassRecord | null>(null);
  const [sections, setSections] = useState<SectionRecord[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectRecord[] | null>(null);
  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [teachers, setTeachers] = useState<ClassTeacherEntry[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    classService.get(id).then(setCls).catch(() => setError(true));
    sectionService.list({ classId: id, pageSize: 100 }).then((r) => setSections(r.data));
    subjectService.list({ classId: id, pageSize: 100 }).then((r) => setSubjects(r.data));
    studentService.list({ classId: id, pageSize: 100 }).then((r) => setStudents(r.data));
    classService.listTeachers(id).then((r) => setTeachers(r.data));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-5xl px-6 py-16" onRetry={load} />;
  if (!cls) return <LoadingState className="mx-auto max-w-5xl px-6 py-16" />;

  const utilization = cls.capacity ? Math.round(((cls.counts?.students ?? 0) / cls.capacity) * 100) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Classes", href: "/school/classes" },
            { label: cls.name },
          ]}
        />
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{cls.name}</h1>
          <Badge variant={cls.status === "active" ? "success" : "neutral"}>{cls.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {cls.academicYear.label} · {cls.campus.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Sections" value={cls.counts?.sections ?? 0} icon={Layers} />
        <StatCard
          label="Students"
          value={cls.capacity ? `${cls.counts?.students ?? 0} / ${cls.capacity}` : cls.counts?.students ?? 0}
          icon={Users}
          tone={utilization !== null && utilization >= 90 ? "warning" : "primary"}
          description={utilization !== null ? `${utilization}% capacity` : undefined}
        />
        <StatCard label="Subjects" value={subjects?.length ?? 0} icon={BookOpen} />
        <StatCard label="Teachers" value={teachers?.length ?? 0} icon={UserCog} />
      </div>

      <Tabs defaultValue="sections">
        <TabsList>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
        </TabsList>

        <TabsContent value="sections">
          {!sections ? (
            <LoadingState className="py-8" />
          ) : sections.length === 0 ? (
            <EmptyState icon={Layers} title="No sections yet" description="Add sections for this class." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Class Teacher</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => (
                  <TableRow key={section.id}>
                    <TableCell className="font-medium">{section.name}</TableCell>
                    <TableCell>{section.room ?? "—"}</TableCell>
                    <TableCell>{section.classTeacher?.fullName ?? "—"}</TableCell>
                    <TableCell>
                      {section.counts?.students ?? 0}
                      {section.capacity ? ` / ${section.capacity}` : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/sections/${section.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="students">
          {!students ? (
            <LoadingState className="py-8" />
          ) : students.length === 0 ? (
            <EmptyState icon={Users} title="No students yet" description="Students enrolled in this class will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Section</TableHead>
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
                    <TableCell>{student.section?.name ?? "—"}</TableCell>
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
            <EmptyState icon={BookOpen} title="No subjects assigned" description="Assign subjects to this class from the Subjects module." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="capitalize">{subject.subjectType.replace("_", " ")}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/subjects/${subject.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="teachers">
          {!teachers ? (
            <LoadingState className="py-8" />
          ) : teachers.length === 0 ? (
            <EmptyState icon={UserCog} title="No teachers assigned" description="Assign a class teacher or subject teachers." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.fullName}</TableCell>
                    <TableCell>{t.designation}</TableCell>
                    <TableCell>{t.subjects.join(", ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

