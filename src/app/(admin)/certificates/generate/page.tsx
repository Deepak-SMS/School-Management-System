import { Suspense } from "react";
import { GenerateCertificateForm } from "@/features/certificates/generate-certificate-form";

export default function GenerateCertificatePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Generate Certificate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a certificate type and template, find the student or staff member, and generate. School information and their profile fields are filled in automatically.
        </p>
      </div>
      <Suspense>
        <GenerateCertificateForm />
      </Suspense>
    </div>
  );
}
