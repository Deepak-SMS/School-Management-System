import { SchoolsTable } from "@/features/platform/schools/schools-table";

export default function PlatformSchoolsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Schools</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every school on the platform.</p>
      </div>
      <SchoolsTable />
    </div>
  );
}
