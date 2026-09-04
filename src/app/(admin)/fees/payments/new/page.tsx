import { RecordPaymentForm } from "@/features/fees/record-payment-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function RecordPaymentPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Fees & Finance", href: "/fees/structure" },
            { label: "Receipts", href: "/fees/receipts" },
            { label: "Record payment" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Record payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An official receipt is generated automatically once the payment is saved.
        </p>
      </div>
      <RecordPaymentForm />
    </div>
  );
}
