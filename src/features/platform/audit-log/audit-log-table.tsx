"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { platformService } from "@/services/platformService";
import type { PlatformAuditLogResponse } from "@/types/platform";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

const PAGE_SIZE = 30;

const ACTION_LABELS: Record<string, string> = {
  "school.created": "School created",
  "school.status_changed": "Status changed",
  "school.plan_changed": "Plan changed",
  "school.modules_updated": "Modules updated",
};

export function AuditLogTable() {
  const [result, setResult] = useState<PlatformAuditLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  function load() {
    setLoading(true);
    setError(null);
    platformService
      .listAuditLog({ page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load the audit log."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  if (loading) return <TableSkeleton rows={8} columns={4} />;
  if (error) return <ErrorState description={error} onRetry={() => setPage((p) => p)} />;
  if (!result || result.data.length === 0) {
    return <EmptyState icon={ScrollText} title="No activity yet" description="Platform actions will show up here." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>School</TableHead>
            <TableHead>By</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.data.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</TableCell>
              <TableCell>
                {entry.targetSchool ? (
                  <Link href={`/super-admin/schools/${entry.targetSchool.id}`} className="hover:underline">
                    {entry.targetSchool.name}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{entry.actor.name}</TableCell>
              <TableCell className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{result.total} entries</span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
