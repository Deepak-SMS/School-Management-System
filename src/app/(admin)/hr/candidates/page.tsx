import { CandidateManager } from "@/features/hr/candidate-manager";

export default function CandidatesPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Candidates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A shared talent pool — one record per person, applied to as many vacancies as needed.
        </p>
      </div>
      <CandidateManager />
    </div>
  );
}
