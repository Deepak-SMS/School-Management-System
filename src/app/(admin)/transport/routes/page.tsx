import { RouteTable } from "@/features/transport/route-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function TransportRoutesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Routes" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Routes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every route, its stops, and its current vehicle and driver.</p>
      </div>
      <RouteTable />
    </div>
  );
}
