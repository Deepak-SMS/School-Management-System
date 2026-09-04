import { StudentTransportTable } from "@/features/transport/student-transport-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function TransportStudentsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Student Transport" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Student Transport</h1>
        <p className="mt-1 text-sm text-muted-foreground">Which students ride which route, and their pickup/drop stops.</p>
      </div>
      <StudentTransportTable />
    </div>
  );
}
