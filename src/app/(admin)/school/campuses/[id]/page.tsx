"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { School, Users, UserCog, Building, Layers } from "lucide-react";
import { campusService, type CampusTeacherEntry } from "@/services/campusService";
import { classService } from "@/services/classService";
import { departmentService } from "@/services/departmentService";
import type { CampusRecord } from "@/types/campus";
import type { ClassRecord } from "@/types/class";
import type { DepartmentRecord } from "@/types/department";
import { CAMPUS_TYPE_LABELS } from "@/lib/constants/school";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

export default function CampusDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campus, setCampus] = useState<CampusRecord | null>(null);
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[] | null>(null);
  const [teachers, setTeachers] = useState<CampusTeacherEntry[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    campusService.get(id).then(setCampus).catch(() => setError(true));
    classService.list({ campusId: id, pageSize: 100 }).then((r) => setClasses(r.data));
    departmentService.list({ campusId: id, pageSize: 100 }).then((r) => setDepartments(r.data));
    campusService.listTeachers(id).then((r) => setTeachers(r.data));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-5xl px-6 py-16" onRetry={load} />;
  if (!campus) return <LoadingState className="mx-auto max-w-5xl px-6 py-16" />;

  const utilization = campus.studentCapacity ? Math.round(((campus.counts?.students ?? 0) / campus.studentCapacity) * 100) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Campuses", href: "/school/campuses" },
            { label: campus.name },
          ]}
        />
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{campus.name}</h1>
          <Badge variant={campus.status === "active" ? "success" : "neutral"}>{campus.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {CAMPUS_TYPE_LABELS[campus.campusType as keyof typeof CAMPUS_TYPE_LABELS] ?? campus.campusType}
          {campus.city ? ` · ${campus.city}` : ""} · Head: {campus.head?.fullName ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Classes" value={campus.counts?.classes ?? 0} icon={School} />
        <StatCard label="Sections" value={campus.counts?.sections ?? 0} icon={Layers} />
        <StatCard
          label="Students"
          value={campus.studentCapacity ? `${campus.counts?.students ?? 0} / ${campus.studentCapacity}` : campus.counts?.students ?? 0}
          icon={Users}
          tone={utilization !== null && utilization >= 90 ? "warning" : "primary"}
          description={utilization !== null ? `${utilization}% capacity` : undefined}
        />
        <StatCard label="Departments" value={campus.counts?.departments ?? 0} icon={Building} />
        <StatCard label="Teachers" value={teachers?.length ?? 0} icon={UserCog} />
      </div>

      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
          {!classes ? (
            <LoadingState className="py-8" />
          ) : classes.length === 0 ? (
            <EmptyState icon={School} title="No classes yet" description="Add classes for this campus." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>{cls.academicYear.label}</TableCell>
                    <TableCell>{cls.counts?.sections ?? 0}</TableCell>
                    <TableCell>
                      {cls.counts?.students ?? 0}
                      {cls.capacity ? ` / ${cls.capacity}` : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/classes/${cls.id}`}>View</Link>
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
            <EmptyState icon={UserCog} title="No teachers assigned" description="Assign class teachers to classes in this campus." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Classes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.fullName}</TableCell>
                    <TableCell>{t.designation}</TableCell>
                    <TableCell>{t.classes.join(", ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="departments">
          {!departments ? (
            <LoadingState className="py-8" />
          ) : departments.length === 0 ? (
            <EmptyState icon={Building} title="No departments yet" description="Add departments under this campus." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Head</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.head?.fullName ?? "—"}</TableCell>
                    <TableCell>{dept.counts?.employees ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/departments/${dept.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="settings" className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Address" value={campus.address} />
          <Field label="City" value={campus.city} />
          <Field label="Phone" value={campus.phone} />
          <Field label="Email" value={campus.email} />
          <Field label="Website" value={campus.website} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
