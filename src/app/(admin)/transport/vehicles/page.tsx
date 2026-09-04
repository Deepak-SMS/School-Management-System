import { VehicleTable } from "@/features/transport/vehicle-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function TransportVehiclesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Vehicles" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Vehicles</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage every vehicle in the school&apos;s transport fleet.</p>
      </div>
      <VehicleTable />
    </div>
  );
}
