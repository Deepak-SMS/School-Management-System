import { ReceiptTable } from "@/features/fees/receipt-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function ReceiptsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Fees & Finance", href: "/fees/structure" }, { label: "Receipts" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Receipts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every receipt issued, in order. One is generated automatically each time a payment is recorded.
        </p>
      </div>
      <ReceiptTable />
    </div>
  );
}
