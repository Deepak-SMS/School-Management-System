import { EnquiryManager } from "@/features/admissions/enquiry-manager";

export default function AdmissionEnquiriesPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Admission Enquiries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track walk-in, phone and website leads, and generate an application link once a family is ready to apply.
        </p>
      </div>
      <EnquiryManager />
    </div>
  );
}
