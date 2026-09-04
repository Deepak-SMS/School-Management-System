"use client";

import { useEffect, useState } from "react";
import { ScrollText, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useActiveChild } from "@/providers/active-child-provider";
import { portalService } from "@/services/portalService";
import type { PortalCertificate } from "@/types/portal";

export function PortalCertificatesView() {
  const { activeChild, isLoading: childLoading } = useActiveChild();
  const [certificates, setCertificates] = useState<PortalCertificate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!activeChild) return;
    setLoading(true);
    setError(null);
    portalService
      .getCertificates(activeChild.id)
      .then((r) => setCertificates(r.data))
      .catch(() => setError("Couldn't load certificates."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (childLoading) return;
    const timeout = setTimeout(() => {
      if (!activeChild) {
        setLoading(false);
        return;
      }
      load();
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild?.id, childLoading]);

  if (childLoading || loading) return <LoadingState />;
  if (!activeChild) return <EmptyState title="No student linked to this account yet" />;
  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!certificates) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Certificates</h1>
        <p className="mt-1 text-sm text-muted-foreground">{activeChild.firstName}&apos;s issued certificates.</p>
      </div>

      {certificates.length === 0 ? (
        <EmptyState icon={ScrollText} title="No certificates yet" description="Certificates issued by your school will appear here." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {certificates.map((cert) => (
            <div key={cert.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{cert.certificateType.name}</p>
                <p className="text-xs text-muted-foreground">
                  {cert.certificateNumber} · {new Date(cert.issueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              {cert.pdfUrl && (
                <Button asChild variant="secondary" size="sm">
                  <a href={cert.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="size-4" /> Download
                  </a>
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
