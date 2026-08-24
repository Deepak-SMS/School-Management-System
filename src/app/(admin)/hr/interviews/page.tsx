import { InterviewManager } from "@/features/hr/interview-manager";

export default function InterviewsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Interviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scheduled rounds and panel scorecards. Scores inform the hiring decision — they never make it automatically.
        </p>
      </div>
      <InterviewManager />
    </div>
  );
}
