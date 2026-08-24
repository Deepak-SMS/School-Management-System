"use client";

import { use, useEffect, useState } from "react";
import { Users, UserCog, Building } from "lucide-react";
import { departmentService, type DepartmentStaffRecord } from "@/services/departmentService";
import type { DepartmentRecord } from "@/types/department";
import { DEPARTMENT_TYPE_LABELS } from "@/lib/constants/school";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

export default function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [department, setDepartment] = useState<DepartmentRecord | null>(null);
  const [staff, setStaff] = useState<DepartmentStaffRecord[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    departmentService.get(id).then(setDepartment).catch(() => setError(true));
    departmentService.listStaff(id).then((r) => setStaff(r.data));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!department) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  const teachers = staff?.filter((s) => s.category === "teacher") ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Departments", href: "/school/departments" },
            { label: department.name },
          ]}
        />
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{department.name}</h1>
          <Badge variant={department.status === "active" ? "success" : "neutral"}>{department.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {department.code} · {DEPARTMENT_TYPE_LABELS[department.departmentType as keyof typeof DEPARTMENT_TYPE_LABELS] ?? department.departmentType}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Employees" value={department.counts?.employees ?? 0} icon={Users} />
        <StatCard label="Teachers" value={department.counts?.teachers ?? 0} icon={UserCog} />
        <StatCard label="Campus" value={department.campus?.name ?? "All campuses"} icon={Building} />
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <StaffList staff={staff} emptyLabel="No employees assigned to this department yet." />
        </TabsContent>

        <TabsContent value="teachers">
          <StaffList staff={teachers} emptyLabel="No teachers assigned to this department yet." />
        </TabsContent>

        <TabsContent value="settings" className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Department head" value={department.head?.fullName} />
          <Field label="Campus" value={department.campus?.name ?? "All campuses"} />
          <Field label="Email" value={department.email} />
          <Field label="Phone" value={department.phone} />
          <Field label="Description" value={department.description} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StaffList({ staff, emptyLabel }: { staff: DepartmentStaffRecord[] | null; emptyLabel: string }) {
  if (!staff) return <LoadingState className="py-8" />;
  if (staff.length === 0) return <EmptyState icon={Users} title="No records" description={emptyLabel} />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Employee ID</TableHead>
          <TableHead>Designation</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <Avatar initials={s.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")} size="sm" />
                <span className="font-medium">{s.fullName}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{s.employeeId}</TableCell>
            <TableCell>{s.designation}</TableCell>
            <TableCell>
              <Badge variant={s.employmentStatus === "active" ? "success" : "neutral"}>{s.employmentStatus}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
