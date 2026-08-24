import { VacancyManager } from "@/features/hr/vacancy-manager";

export default function VacanciesPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Vacancies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open positions you are hiring for. Only vacancies marked open accept applications.
        </p>
      </div>
      <VacancyManager />
    </div>
  );
}
