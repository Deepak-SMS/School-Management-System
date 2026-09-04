import { AdmissionsOverview } from "@/features/admissions/admissions-overview";

export default function AdmissionsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Admissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where the year&apos;s admissions stand — pending decisions, seats filled, and who was admitted.
        </p>
      </div>
      <AdmissionsOverview />
    </div>
  );
}
