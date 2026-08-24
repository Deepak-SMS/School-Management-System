import { OfferManager } from "@/features/hr/offer-manager";

export default function OffersPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Offers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Offers raised from selected candidates. An accepted offer is what unlocks conversion to an employee.
        </p>
      </div>
      <OfferManager />
    </div>
  );
}
