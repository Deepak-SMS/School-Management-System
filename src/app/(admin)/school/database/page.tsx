import { DatabaseManager } from "@/features/database/database-manager";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DatabasePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "Database" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Database</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Export the whole school database to Excel, or bulk-load it back in.
        </p>
      </div>
      <DatabaseManager />
    </div>
  );
}
