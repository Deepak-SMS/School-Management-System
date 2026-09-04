import { CertificateRecordsTable } from "@/features/certificates/certificate-records-table";

export default function GeneratedCertificatesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Generated Certificates</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every certificate this school has issued — searchable, downloadable, and revocable.</p>
      </div>
      <CertificateRecordsTable />
    </div>
  );
}
