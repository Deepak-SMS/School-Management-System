import { CertificateTypeManager } from "@/features/certificate-types/certificate-type-manager";

export default function CertificateTypesPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Certificate Types</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The kinds of certificates this school issues, each with its own numbering prefix. Starter types are shared across every school; add your own alongside them.
        </p>
      </div>
      <CertificateTypeManager />
    </div>
  );
}
