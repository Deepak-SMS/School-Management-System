import { DepartmentTable } from "@/features/departments/department-table";
import { DepartmentStaffPanel } from "@/features/departments/department-staff-panel";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function DepartmentsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "Departments" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Departments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize academic and administrative departments, and the staff who work in them.
        </p>
      </div>

      {/*
        "Staff by department" leads because that's the working view — who is in
        Finance, who is in Transport. The table stays for maintaining the
        department records themselves.
      */}
      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff by department</TabsTrigger>
          <TabsTrigger value="list">Department list</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <DepartmentStaffPanel />
        </TabsContent>

        <TabsContent value="list">
          <DepartmentTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
