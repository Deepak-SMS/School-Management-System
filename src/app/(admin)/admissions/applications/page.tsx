import { ApplicationsReview } from "@/features/admissions/applications-review";

export default function ApplicationsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review admission forms submitted by parents and approve them into student records.
        </p>
      </div>
      <ApplicationsReview />
    </div>
  );
}
