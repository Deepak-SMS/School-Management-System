import { AdmissionReports } from "@/features/admissions/admission-reports";

export default function AdmissionReportsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Admission reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The enquiry-to-admission funnel, where applications stand, and which sources and counsellors convert.
        </p>
      </div>
      <AdmissionReports />
    </div>
  );
}
