import { DriverTable } from "@/features/transport/driver-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function TransportDriversPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Drivers" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Drivers</h1>
        <p className="mt-1 text-sm text-muted-foreground">School-employed and vendor drivers, with license and verification details.</p>
      </div>
      <DriverTable />
    </div>
  );
}
