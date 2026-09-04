"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Copy, Check, Trash2, Pencil } from "lucide-react";
import { ALL_MODULES } from "@/config/permissions";
import { platformService } from "@/services/platformService";
import { SCHOOL_STATUSES, SCHOOL_STATUS_LABELS, SCHOOL_PLANS, SCHOOL_PLAN_LABELS } from "@/lib/constants/platform";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminCredentialsDialog } from "@/features/platform/schools/admin-credentials-dialog";
import { EditSchoolDialog } from "@/features/platform/schools/edit-school-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";
import type { UpdateSchoolInput } from "@/lib/validation/platform-school";
import type { CreatedSchoolAdmin, SchoolDetail as SchoolDetailType } from "@/types/platform";

const STATUS_BADGE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  trial: "warning",
  suspended: "danger",
  expired: "danger",
  cancelled: "neutral",
};

/** "employeeSalary" -> "Employee Salary" — no per-module label map to maintain as the matrix grows. */
function humanizeModuleKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export function SchoolDetail({ school: initialSchool }: { school: SchoolDetailType }) {
  const router = useRouter();
  const [school, setSchool] = useState(initialSchool);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<CreatedSchoolAdmin | null>(null);
  const [origin, setOrigin] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setTimeout(() => setOrigin(window.location.origin), 0);
  }, []);

  const loginUrl = school.slug ? `${origin}/${school.slug}/admin` : null;

  async function copyLoginUrl() {
    if (!loginUrl) return;
    await navigator.clipboard.writeText(loginUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function confirmDeleteSchool() {
    setIsDeleting(true);
    try {
      await platformService.deleteSchool(school.id);
      router.push("/super-admin/schools");
      router.refresh();
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't delete this school.", variant: "danger" });
      setIsDeleting(false);
    }
  }

  async function confirmResetPassword() {
    setIsResetting(true);
    try {
      const admin = await platformService.resetAdminPassword(school.id);
      setConfirmingReset(false);
      setIssuedCredentials(admin);
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't reset the password.", variant: "danger" });
    } finally {
      setIsResetting(false);
    }
  }

  const enabledSet = school.enabledModules === null ? null : new Set(school.enabledModules);

  async function applyStatusChange() {
    if (!pendingStatus) return;
    setIsSaving(true);
    try {
      const updated = await platformService.updateSchool(school.id, {
        status: pendingStatus as UpdateSchoolInput["status"],
      });
      setSchool(updated);
      toast({ title: "Status updated", variant: "success" });
      setPendingStatus(null);
      router.refresh();
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't update status.", variant: "danger" });
    } finally {
      setIsSaving(false);
    }
  }

  async function changePlan(plan: string) {
    try {
      const updated = await platformService.updateSchool(school.id, { plan: plan as UpdateSchoolInput["plan"] });
      setSchool(updated);
      toast({ title: "Plan updated", variant: "success" });
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't update plan.", variant: "danger" });
    }
  }

  async function toggleModule(module: string, checked: boolean) {
    const current = enabledSet ? Array.from(enabledSet) : [...ALL_MODULES];
    const next = checked ? [...current, module] : current.filter((m) => m !== module);
    try {
      const updated = await platformService.updateSchool(school.id, { enabledModules: next });
      setSchool(updated);
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't update modules.", variant: "danger" });
    }
  }

  async function unrestrictModules() {
    try {
      const updated = await platformService.updateSchool(school.id, { enabledModules: null });
      setSchool(updated);
      toast({ title: "All modules unrestricted", variant: "success" });
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't update modules.", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{school.name}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{school.city ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE_TONE[school.status] ?? "neutral"}>
              {SCHOOL_STATUS_LABELS[school.status as keyof typeof SCHOOL_STATUS_LABELS] ?? school.status}
            </Badge>
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">School Admin</p>
            <p className="mt-0.5 text-sm text-foreground">{school.admin?.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{school.admin?.email}</p>
            {school.admin && (
              <Button variant="link" size="sm" className="mt-1 h-auto p-0" onClick={() => setConfirmingReset(true)}>
                <KeyRound className="size-3.5" /> Reset password
              </Button>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Students / Staff</p>
            <p className="mt-0.5 text-sm text-foreground">
              {school.studentCount} students · {school.staffCount} staff
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Created</p>
            <p className="mt-0.5 text-sm text-foreground">{new Date(school.createdAt).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-danger-500/40">
        <CardHeader>
          <CardTitle className="text-danger-600">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Delete school</p>
            <p className="text-sm text-muted-foreground">
              {school.studentCount > 0 || school.staffCount > 0
                ? "This school has students or staff on record — set its status to Cancelled instead of deleting it."
                : "Permanently removes this school and everything on it. This can't be undone."}
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={school.studentCount > 0 || school.staffCount > 0}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="size-4" /> Delete school
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <Select value={school.status} onValueChange={setPendingStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHOOL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SCHOOL_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Plan</p>
            <Select value={school.plan} onValueChange={changePlan}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHOOL_PLANS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {SCHOOL_PLAN_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branded login link</CardTitle>
        </CardHeader>
        <CardContent>
          {loginUrl ? (
            <>
              <p className="text-sm text-muted-foreground">
                Share this with {school.name} — it opens their sign-in page directly. It&apos;s a convenience link, not
                a secret: anyone with an account still needs their own password, and it only ever signs in someone
                who already belongs to this school.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                  {loginUrl}
                </code>
                <Button type="button" variant="secondary" size="sm" onClick={copyLoginUrl}>
                  {linkCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {linkCopied ? "Copied" : "Copy link"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This school doesn&apos;t have a login link yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Module Access</CardTitle>
          {enabledSet !== null && (
            <button type="button" onClick={unrestrictModules} className="text-xs font-medium text-primary-600 hover:underline">
              Unrestrict all
            </button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_MODULES.map((module) => (
            <label key={module} className="flex items-center justify-between gap-3 text-sm text-foreground">
              {humanizeModuleKey(module)}
              <Switch
                checked={enabledSet === null || enabledSet.has(module)}
                onCheckedChange={(checked) => toggleModule(module, checked)}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title={`Change status to "${pendingStatus ? SCHOOL_STATUS_LABELS[pendingStatus as keyof typeof SCHOOL_STATUS_LABELS] : ""}"?`}
        description="This changes what the school's admin and staff can do right away."
        confirmLabel="Change status"
        isLoading={isSaving}
        onConfirm={applyStatusChange}
      />

      <ConfirmDialog
        open={confirmingReset}
        onOpenChange={setConfirmingReset}
        title={`Reset password for ${school.admin?.name ?? "this admin"}?`}
        description="Their current password stops working immediately and any signed-in sessions are ended. A new temporary password is generated for you to hand them."
        confirmLabel="Reset password"
        variant="destructive"
        isLoading={isResetting}
        onConfirm={confirmResetPassword}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${school.name}?`}
        description="This permanently removes the school, its admin's access, and every record on it. This can't be undone."
        confirmLabel="Delete school"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDeleteSchool}
      />

      {issuedCredentials && (
        <AdminCredentialsDialog admin={issuedCredentials} onClose={() => setIssuedCredentials(null)} />
      )}

      {isEditing && (
        <EditSchoolDialog
          school={school}
          onClose={() => setIsEditing(false)}
          onSaved={(updated) => {
            setSchool(updated);
            setIsEditing(false);
            toast({ title: "School details updated", variant: "success" });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
