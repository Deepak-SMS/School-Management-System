"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSignature, UserCheck } from "lucide-react";
import { offerService, applicationService, type OfferRecord } from "@/services/recruitmentService";
import { OFFER_STATUSES } from "@/lib/constants/hr";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "info"> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  expired: "warning",
  withdrawn: "neutral",
};

/** What an offer may become next — mirrors the server's transition table. */
const NEXT_STATUSES: Record<string, string[]> = {
  draft: ["sent", "withdrawn"],
  sent: ["accepted", "rejected", "expired", "withdrawn"],
  accepted: [],
  rejected: [],
  expired: ["sent"],
  withdrawn: [],
};

export function OfferManager() {
  const can = useCan();
  const [rows, setRows] = useState<OfferRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState("");
  const [converting, setConverting] = useState<OfferRecord | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    offerService
      .list({ status: status || undefined })
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, reloadKey]);

  async function move(offer: OfferRecord, next: string) {
    try {
      await offerService.setStatus(offer.id, next);
      toast({ title: `Offer ${next}`, variant: "success" });
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the offer", variant: "danger" });
    }
  }

  async function convert() {
    if (!converting) return;
    try {
      const result = await applicationService.convert(converting.application.id);
      toast({
        title: "Candidate converted to employee",
        description: `${result.fullName} · ${result.employeeId}`,
        variant: "success",
      });
      setConverting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't convert the candidate", variant: "danger" });
      setConverting(null);
    }
  }

  if (error) return <ErrorState description="Couldn't load offers." onRetry={load} />;

  return (
    <div className="flex flex-col gap-4">
      <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any status</SelectItem>
          {OFFER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!rows && <TableSkeleton rows={4} columns={6} />}

      {rows?.length === 0 && (
        <EmptyState
          icon={FileSignature}
          title="No offers yet"
          description="Offers are raised from the recruitment pipeline once a candidate is selected."
        />
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offer</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Vacancy</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Joining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const next = NEXT_STATUSES[o.status] ?? [];
                const canConvert = o.status === "accepted" && o.application.status !== "joined";
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.code ?? "—"}</TableCell>
                    <TableCell>
                      {o.application.candidate.firstName} {o.application.candidate.lastName ?? ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{o.application.vacancy.title}</span>
                        <span className="text-xs text-muted-foreground">{o.application.vacancy.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {o.salaryAmount != null ? o.salaryAmount.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{o.joiningDate?.slice(0, 10) ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[o.status] ?? "neutral"}>{o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canConvert && can("candidates", "convert") && (
                          <Button variant="ghost" size="sm" onClick={() => setConverting(o)}>
                            <UserCheck className="size-4" /> Convert
                          </Button>
                        )}
                        {o.application.status === "joined" && <Badge variant="success">Joined</Badge>}
                        {can("offers", "edit") && next.length > 0 && (
                          <Select value="" onValueChange={(v) => move(o, v)}>
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Move to" />
                            </SelectTrigger>
                            <SelectContent>
                              {next.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(converting)}
        onOpenChange={(v) => !v && setConverting(null)}
        title={`Convert ${converting?.application.candidate.firstName ?? "candidate"} to an employee?`}
        description="This creates the employee record from the agreed offer terms, generates an employee ID, and marks the application as joined. The candidate record is kept and linked — no duplicate is created."
        confirmLabel="Convert to employee"
        onConfirm={convert}
      />
    </div>
  );
}
