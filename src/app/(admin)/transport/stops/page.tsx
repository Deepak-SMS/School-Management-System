import { StopTable } from "@/features/transport/stop-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function TransportStopsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Transport" }, { label: "Stops" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Stops</h1>
        <p className="mt-1 text-sm text-muted-foreground">The pickup and drop points routes are built from.</p>
      </div>
      <StopTable />
    </div>
  );
}
