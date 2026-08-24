"use client";

import { useEffect, useState } from "react";
import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_STATUS_TONES, type EmploymentStatus } from "@/lib/constants/hr";
import { STAFF_CATEGORY_LABELS } from "@/lib/constants/people";
import { employeeService } from "@/services/hrService";
import type { EmployeeDetail, EmployeeActivity } from "@/types/hr";
import { useCan } from "@/hooks/use-can";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { EmployeeDocumentsTab } from "@/features/hr/employee-documents-tab";
import { Clock, Lock, CalendarClock } from "lucide-react";

/**
 * The employee profile's tab set (spec §2.7).
 *
 * Tabs whose module hasn't been built yet render an explicit "arrives in
 * phase N" empty state rather than a control that does nothing — the spec
 * forbids fake buttons, and a labelled placeholder is honest about status while
 * keeping the intended structure visible.
 */
const FUTURE_TABS = [
  { value: "attendance", label: "Attendance", phase: "Attendance module" },
  { value: "leave", label: "Leave", phase: "Leave Management module" },
  { value: "payroll", label: "Payroll", phase: "Payroll module" },
  { value: "performance", label: "Performance", phase: "Performance module" },
  { value: "training", label: "Training", phase: "Training module" },
  { value: "timetable", label: "Timetable", phase: "Timetable integration" },
] as const;

export function EmployeeProfile({ employee, onChanged }: { employee: EmployeeDetail; onChanged?: () => void }) {
  const can = useCan();
  const canSeePay = can("employeeSalary", "view");

  return (
    <Tabs defaultValue="overview" className="w-full">
      {/* Horizontally scrollable so 13 tabs stay usable on a phone. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList className="w-max">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {FUTURE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview">
        <OverviewTab employee={employee} />
      </TabsContent>

      <TabsContent value="personal">
        <DetailCard
          title="Personal information"
          rows={[
            ["Full name", employee.fullName],
            ["Preferred name", employee.preferredName],
            ["Date of birth", formatDate(employee.dateOfBirth)],
            ["Gender", capitalize(employee.gender)],
            ["Blood group", employee.bloodGroup],
            ["Marital status", capitalize(employee.maritalStatus)],
            ["Mobile", employee.mobileNumber],
            ["Alternate number", employee.alternateNumber],
            ["Personal email", employee.email],
            ["Current address", joinAddress(employee.address, employee.city, employee.state, employee.pinCode)],
            ["Permanent address", employee.permanentAddress],
            ["Emergency contact", joinParts([employee.emergencyName, employee.emergencyRelation, employee.emergencyContact])],
          ]}
        />
      </TabsContent>

      <TabsContent value="employment">
        <DetailCard
          title="Professional information"
          rows={[
            ["Employee ID", employee.employeeId],
            ["Category", STAFF_CATEGORY_LABELS[employee.category as keyof typeof STAFF_CATEGORY_LABELS] ?? employee.category],
            ["Employee type", employee.employeeType],
            ["Department", employee.department?.name],
            ["Designation", employee.designation],
            ["Campus", employee.campus?.name],
            ["Work location", employee.workLocation],
            ["Reporting manager", employee.reportingManager?.fullName],
            ["Joining date", formatDate(employee.joiningDate)],
            ["Confirmation date", formatDate(employee.confirmationDate)],
            ["Probation", employee.probationMonths ? `${employee.probationMonths} months` : null],
            ["Employment status", EMPLOYMENT_STATUS_LABELS[employee.employmentStatus as EmploymentStatus] ?? employee.employmentStatus],
            ["Official email", employee.officialEmail],
          ]}
        />
        {canSeePay && (
          <div className="mt-4">
            <DetailCard
              title="Bank & payroll"
              rows={[
                ["PAN", employee.panNumber],
                ["Bank name", employee.bankName],
                ["Account holder", employee.bankAccountHolder],
                ["Account number", employee.bankAccountNumber],
                ["IFSC", employee.bankIfsc],
                ["PF number", employee.pfNumber],
                ["ESIC number", employee.esicNumber],
              ]}
            />
          </div>
        )}
        {!canSeePay && (
          <div className="mt-4">
            <EmptyState
              icon={Lock}
              title="Bank and payroll details are restricted"
              description="Your role doesn't include salary access, so these fields aren't loaded."
            />
          </div>
        )}
      </TabsContent>

      <TabsContent value="education">
        {employee.educations && employee.educations.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Education</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {employee.educations.map((e) => (
                <div key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-foreground">{e.degree}</p>
                    <p className="text-sm text-muted-foreground">{joinParts([e.institution, e.board])}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {joinParts([e.passingYear ? String(e.passingYear) : null, e.percentage ? `${e.percentage}%` : null])}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No education records" description="Qualifications added to this employee will appear here." />
        )}
      </TabsContent>

      <TabsContent value="experience">
        {employee.experiences && employee.experiences.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Previous experience</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {employee.experiences.map((x) => (
                <div key={x.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-foreground">{x.organization}</p>
                    <p className="text-sm text-muted-foreground">{x.designation ?? "—"}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(x.startDate)} – {x.endDate ? formatDate(x.endDate) : "Present"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No experience records" description="Previous employment added here will appear on the profile." />
        )}
      </TabsContent>

      <TabsContent value="documents">
        <EmployeeDocumentsTab staffId={employee.id} onChanged={onChanged} />
      </TabsContent>

      {FUTURE_TABS.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          <EmptyState
            icon={CalendarClock}
            title={`${t.label} isn't available yet`}
            description={`This tab activates with the ${t.phase}. The employee record is already linked, so no data migration is needed when it lands.`}
          />
        </TabsContent>
      ))}

      <TabsContent value="activity">
        <ActivityTab staffId={employee.id} />
      </TabsContent>
    </Tabs>
  );
}

function OverviewTab({ employee }: { employee: EmployeeDetail }) {
  const status = employee.employmentStatus as EmploymentStatus;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DetailCard
        title="At a glance"
        rows={[
          ["Employee ID", employee.employeeId],
          ["Department", employee.department?.name],
          ["Designation", employee.designation],
          ["Employee type", employee.employeeType],
          ["Campus", employee.campus?.name],
          ["Reporting manager", employee.reportingManager?.fullName],
          ["Joining date", formatDate(employee.joiningDate)],
          ["Experience here", tenure(employee.joiningDate)],
        ]}
        badge={
          <Badge variant={EMPLOYMENT_STATUS_TONES[status] ?? "neutral"}>
            {EMPLOYMENT_STATUS_LABELS[status] ?? employee.employmentStatus}
          </Badge>
        }
      />
      <DetailCard
        title="Contact"
        rows={[
          ["Mobile", employee.mobileNumber],
          ["Alternate", employee.alternateNumber],
          ["Personal email", employee.email],
          ["Official email", employee.officialEmail],
          ["Address", joinAddress(employee.address, employee.city, employee.state, employee.pinCode)],
          ["Emergency", joinParts([employee.emergencyName, employee.emergencyRelation, employee.emergencyContact])],
        ]}
      />
    </div>
  );
}

function ActivityTab({ staffId }: { staffId: string }) {
  const [items, setItems] = useState<EmployeeActivity[] | null>(null);

  useEffect(() => {
    employeeService
      .activity(staffId)
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  }, [staffId]);

  if (!items) return <LoadingState />;
  if (items.length === 0) {
    return <EmptyState icon={Clock} title="No activity yet" description="Changes to this employee will be recorded here." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-foreground">{item.description}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function DetailCard({
  title,
  rows,
  badge,
}: {
  title: string;
  rows: [string, string | null | undefined][];
  badge?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {badge}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="break-words text-foreground">{value || "—"}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Years/months since joining — the "experience" figure the overview shows. */
function tenure(joiningDate?: string | null): string {
  if (!joiningDate) return "";
  const start = new Date(joiningDate);
  if (Number.isNaN(start.getTime())) return "";
  const months = Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} month${rest === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"}${rest ? ` ${rest} mo` : ""}`;
}

function capitalize(value?: string | null): string {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" · ");
}

function joinAddress(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ");
}
