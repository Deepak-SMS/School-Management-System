import { DesignationManager } from "@/features/hr/designation-manager";

export default function DesignationsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Designations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The job titles employees hold. Each school defines its own — nothing here is fixed by the platform.
        </p>
      </div>
      <DesignationManager />
    </div>
  );
}
