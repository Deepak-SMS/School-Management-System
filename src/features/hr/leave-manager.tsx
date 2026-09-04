"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Check, Plus, X } from "lucide-react";
import {
  hrAttendanceService,
  type LeaveBalanceRow,
  type LeaveRequestRecord,
  type LeaveTypeRecord,
} from "@/services/hrAttendanceService";
import type { ApiError } from "@/services/studentService";
import {
  HALF_DAY_LABELS,
  HALF_DAY_OPTIONS,
  LEAVE_REQUEST_STATUSES,
  LEAVE_REQUEST_STATUS_LABELS,
  LEAVE_REQUEST_TONES,
  type LeaveRequestStatus,
} from "@/lib/constants/hr-attendance";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LeaveManager() {
  const can = useCan();
  const canApprove = can("staffLeave", "approve");

  const [types, setTypes] = useState<LeaveTypeRecord[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRow[] | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [requests, setRequests] = useState<LeaveRequestRecord[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [halfDay, setHalfDay] = useState("none");
  const [reason, setReason] = useState("");

  const [decision, setDecision] = useState<{ request: LeaveRequestRecord; to: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    hrAttendanceService
      .listLeaveTypes()
      .then((r) => setTypes(r.data))
      .catch(() => setTypes([]));

    hrAttendanceService
      .leaveBalances()
      .then((r) => {
        setBalances(r.data);
        setBalanceError(null);
      })
      .catch((e) => {
        // An HR account with no linked employee record has no balances of its
        // own — that is normal, not a failure.
        setBalances([]);
        setBalanceError((e as ApiError)?.error ?? null);
      });
  }, []);

  function loadRequests() {
    hrAttendanceService
      .listLeaveRequests({ status })
      .then((r) => {
        setRequests(r.data);
        setPendingCount(r.pendingCount);
      })
      .catch(() => setRequests([]));
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function apply() {
    setError(null);
    setSubmitting(true);
    try {
      await hrAttendanceService.applyForLeave({ leaveTypeId, startDate, endDate, halfDay, reason });
      toast({ title: "Leave applied for", variant: "success" });
      setApplyOpen(false);
      setReason("");
      loadRequests();
      hrAttendanceService
        .leaveBalances()
        .then((r) => setBalances(r.data))
        .catch(() => undefined);
    } catch (e) {
      setError((e as ApiError)?.error ?? "The request couldn't be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function decide() {
    if (!decision) return;
    setError(null);
    setSubmitting(true);
    try {
      await hrAttendanceService.decideLeave(decision.request.id, decision.to, note || undefined);
      toast({
        title: decision.to === "approved" ? "Leave approved" : "Leave rejected",
        description:
          decision.to === "approved" ? "Attendance has been written for the days it covers." : undefined,
        variant: "success",
      });
      setDecision(null);
      setNote("");
      loadRequests();
    } catch (e) {
      setError((e as ApiError)?.error ?? "That didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="danger" title="Couldn't complete that">
          {error}
        </Alert>
      )}

      {canApprove && pendingCount > 0 && (
        <Alert variant="warning" title={`${pendingCount} leave request${pendingCount === 1 ? "" : "s"} awaiting approval`}>
          Approving one writes the attendance for every working day it covers.
        </Alert>
      )}

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="balances">My balances</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-48" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  {LEAVE_REQUEST_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAVE_REQUEST_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={() => setApplyOpen(true)} disabled={types.length === 0}>
                <Plus className="size-4" /> Apply for leave
              </Button>
            </div>

            {!requests ? (
              <TableSkeleton />
            ) : requests.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No leave requests"
                description="Applications appear here for approval."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{r.staff?.fullName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.staff?.employeeId}</p>
                      </TableCell>
                      <TableCell>
                        {r.leaveType?.name}
                        {r.leaveType && !r.leaveType.isPaid && (
                          <Badge variant="warning" className="ml-2">
                            Unpaid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.startDate.slice(0, 10)}
                        {r.endDate.slice(0, 10) !== r.startDate.slice(0, 10) ? ` → ${r.endDate.slice(0, 10)}` : ""}
                        {r.halfDay !== "none" && (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            ({HALF_DAY_LABELS[r.halfDay as keyof typeof HALF_DAY_LABELS]})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.days}</TableCell>
                      <TableCell>
                        <Badge variant={LEAVE_REQUEST_TONES[r.status as LeaveRequestStatus]}>
                          {LEAVE_REQUEST_STATUS_LABELS[r.status as LeaveRequestStatus] ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canApprove && r.status === "pending" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => setDecision({ request: r, to: "approved" })}>
                              <Check className="size-4" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDecision({ request: r, to: "rejected" })}
                            >
                              <X className="size-4" /> Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="balances">
          {balanceError ? (
            <Alert variant="warning" title="No employee record linked to this account">
              {balanceError}
            </Alert>
          ) : !balances ? (
            <TableSkeleton />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Leave balance</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Entitled</TableHead>
                      <TableHead className="text-right">Carried</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.map((b) => (
                      <TableRow key={b.leaveTypeId}>
                        <TableCell>
                          <span className="font-medium text-foreground">{b.name}</span>
                          {!b.isPaid && (
                            <Badge variant="warning" className="ml-2">
                              Unpaid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{b.unlimited ? "—" : b.entitled}</TableCell>
                        <TableCell className="text-right">{b.carriedForward}</TableCell>
                        <TableCell className="text-right">{b.used}</TableCell>
                        <TableCell className="text-right">{b.pending}</TableCell>
                        <TableCell className="text-right font-medium">
                          {b.available === null ? "No limit" : b.available}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Modal open={applyOpen} onOpenChange={setApplyOpen}>
        <ModalContent title="Apply for leave">
          <div className="flex flex-col gap-4">
            <FormField label="Leave type" required>
              {() => (
                <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.annualQuota !== null ? ` (${t.annualQuota}/yr)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="From" required>
                {(f) => <Input {...f} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
              </FormField>
              <FormField label="To" required>
                {(f) => <Input {...f} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
              </FormField>
            </div>

            <FormField label="Half day" description="Only for a single date">
              {() => (
                <Select value={halfDay} onValueChange={setHalfDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HALF_DAY_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h}>
                        {HALF_DAY_LABELS[h]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField label="Reason" required>
              {(f) => <Textarea {...f} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </FormField>

            <p className="text-xs text-muted-foreground">
              Holidays and weekly offs inside the range don&apos;t count against your balance.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setApplyOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={apply}
                isLoading={submitting}
                disabled={!leaveTypeId || reason.trim().length < 5}
              >
                Apply
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>

      <Modal open={decision !== null} onOpenChange={(open) => !open && setDecision(null)}>
        <ModalContent title={decision?.to === "approved" ? "Approve this leave?" : "Reject this leave?"}>
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-muted-foreground">
              {decision?.to === "approved"
                ? `${decision.request.days} day${decision.request.days === 1 ? "" : "s"} of ${decision.request.leaveType?.name} for ${decision.request.staff?.fullName}. Approving writes the attendance for those days.`
                : "It goes back to the employee with your reason attached."}
            </p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={decision?.to === "approved" ? "Note (optional)" : "Reason"}
              aria-label="Note"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDecision(null)}>
                Back
              </Button>
              <Button
                onClick={decide}
                isLoading={submitting}
                variant={decision?.to === "rejected" ? "destructive" : "primary"}
                disabled={decision?.to === "rejected" && note.trim().length < 5}
              >
                Confirm
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
