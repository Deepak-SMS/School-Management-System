"use client";

import { useEffect, useState } from "react";
import { librarySettingsService } from "@/services/libraryService";
import type { LibrarySettingsRecord } from "@/types/library";
import { useCan } from "@/hooks/use-can";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

export function LibrarySettingsForm() {
  const can = useCan();
  const canEdit = can("librarySettings", "edit");
  const [settings, setSettings] = useState<LibrarySettingsRecord | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    librarySettingsService
      .get()
      .then((s) => {
        setSettings(s);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(load, []);

  function field<K extends keyof LibrarySettingsRecord>(key: K, value: string) {
    if (!settings) return;
    const num = Number(value);
    setSettings({ ...settings, [key]: Number.isFinite(num) ? num : settings[key] });
  }

  async function submit() {
    if (!settings) return;
    setBusy(true);
    setSaveError(null);
    try {
      const updated = await librarySettingsService.update({
        studentMaxBooks: settings.studentMaxBooks,
        studentIssueDays: settings.studentIssueDays,
        teacherMaxBooks: settings.teacherMaxBooks,
        teacherIssueDays: settings.teacherIssueDays,
        staffMaxBooks: settings.staffMaxBooks,
        staffIssueDays: settings.staffIssueDays,
        maxRenewals: settings.maxRenewals,
        finePerDay: settings.finePerDay,
        maxFine: settings.maxFine,
        reminderDaysBefore: settings.reminderDaysBefore,
      });
      setSettings(updated);
      toast({ title: "Library settings saved", variant: "success" });
    } catch (e) {
      setSaveError((e as ApiError)?.error ?? "Couldn't save library settings.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState description="Couldn't load library settings." onRetry={load} />;
  if (!settings) return <LoadingState className="py-8" />;

  return (
    <div className="flex flex-col gap-4">
      {saveError && <Alert variant="danger">{saveError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Borrowing limits</CardTitle>
          <CardDescription>Maximum books out at once and the issue period, by role.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RoleLimitRow
            label="Student"
            maxBooks={settings.studentMaxBooks}
            issueDays={settings.studentIssueDays}
            canEdit={canEdit}
            onMaxBooksChange={(v) => field("studentMaxBooks", v)}
            onIssueDaysChange={(v) => field("studentIssueDays", v)}
          />
          <RoleLimitRow
            label="Teacher"
            maxBooks={settings.teacherMaxBooks}
            issueDays={settings.teacherIssueDays}
            canEdit={canEdit}
            onMaxBooksChange={(v) => field("teacherMaxBooks", v)}
            onIssueDaysChange={(v) => field("teacherIssueDays", v)}
          />
          <RoleLimitRow
            label="Staff"
            maxBooks={settings.staffMaxBooks}
            issueDays={settings.staffIssueDays}
            canEdit={canEdit}
            onMaxBooksChange={(v) => field("staffMaxBooks", v)}
            onIssueDaysChange={(v) => field("staffIssueDays", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Renewals &amp; fines</CardTitle>
          <CardDescription>Applied automatically once circulation and fines land.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Max renewals">
            {(f) => (
              <Input {...f} type="number" min={0} disabled={!canEdit} value={settings.maxRenewals} onChange={(e) => field("maxRenewals", e.target.value)} />
            )}
          </FormField>
          <FormField label="Fine per day (₹)">
            {(f) => (
              <Input {...f} type="number" min={0} disabled={!canEdit} value={settings.finePerDay} onChange={(e) => field("finePerDay", e.target.value)} />
            )}
          </FormField>
          <FormField label="Maximum fine (₹)">
            {(f) => (
              <Input {...f} type="number" min={0} disabled={!canEdit} value={settings.maxFine} onChange={(e) => field("maxFine", e.target.value)} />
            )}
          </FormField>
          <FormField label="Reminder, days before due">
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                disabled={!canEdit}
                value={settings.reminderDaysBefore}
                onChange={(e) => field("reminderDaysBefore", e.target.value)}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={submit} isLoading={busy}>
            Save settings
          </Button>
        </div>
      )}
    </div>
  );
}

function RoleLimitRow({
  label,
  maxBooks,
  issueDays,
  canEdit,
  onMaxBooksChange,
  onIssueDaysChange,
}: {
  label: string;
  maxBooks: number;
  issueDays: number;
  canEdit: boolean;
  onMaxBooksChange: (value: string) => void;
  onIssueDaysChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr_1fr] sm:items-end">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <FormField label="Max books">
        {(f) => <Input {...f} type="number" min={0} disabled={!canEdit} value={maxBooks} onChange={(e) => onMaxBooksChange(e.target.value)} />}
      </FormField>
      <FormField label="Issue period (days)">
        {(f) => <Input {...f} type="number" min={1} disabled={!canEdit} value={issueDays} onChange={(e) => onIssueDaysChange(e.target.value)} />}
      </FormField>
    </div>
  );
}
