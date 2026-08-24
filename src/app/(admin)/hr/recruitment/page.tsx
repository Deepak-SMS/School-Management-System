import { CandidatePipeline } from "@/features/hr/candidate-pipeline";

export default function RecruitmentPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Recruitment pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every application and the stage it sits at. Moves are validated against the pipeline, so a candidate can&apos;t
          skip screening or approval.
        </p>
      </div>
      <CandidatePipeline />
    </div>
  );
}
