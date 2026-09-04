"use client";

import { useEffect, useState } from "react";
import { useCan } from "@/hooks/use-can";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

interface AttendanceSettingsRecord {
  id: string;
  mode: string;
  warningThreshold: number;
  criticalThreshold: number;
  allowHalfDay: boolean;
  allowLate: boolean;
  allowLeave: boolean;
}

export function AttendanceSettingsForm() {
  const can = useCan();
  const canEdit = can("studentAttendance", "edit");
  const [settings, setSettings] = useState<AttendanceSettingsRecord | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    fetch("/api/attendance/settings")
      .then((r) => r.json())
      .then((s) => {
        setSettings(s);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(load, []);

  function field<K extends keyof AttendanceSettingsRecord>(key: K, value: AttendanceSettingsRecord[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  async function submit() {
    if (!settings) return;
    setBusy(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/attendance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: settings.mode,
          warningThreshold: settings.warningThreshold,
          criticalThreshold: settings.criticalThreshold,
          allowHalfDay: settings.allowHalfDay,
          allowLate: settings.allowLate,
          allowLeave: settings.allowLeave,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setSettings(body);
      toast({ title: "Attendance settings saved", variant: "success" });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save attendance settings.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState description="Couldn't load attendance settings." onRetry={load} />;
  if (!settings) return <LoadingState className="py-8" />;

  return (
    <div className="flex flex-col gap-4">
      {saveError && <Alert variant="danger">{saveError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marking mode</CardTitle>
          <CardDescription>Descriptive only — daily and period-wise marking are both always available.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Mode">
            {(f) => (
              <Select value={settings.mode} onValueChange={(v) => field("mode", v)} disabled={!canEdit}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily only</SelectItem>
                  <SelectItem value="period">Period-wise only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaulter thresholds</CardTitle>
          <CardDescription>Below the warning threshold flags a student on the Defaulters list; below critical highlights them.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Warning threshold (%)">
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                max={100}
                disabled={!canEdit}
                value={settings.warningThreshold}
                onChange={(e) => field("warningThreshold", Number(e.target.value))}
              />
            )}
          </FormField>
          <FormField label="Critical threshold (%)">
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                max={100}
                disabled={!canEdit}
                value={settings.criticalThreshold}
                onChange={(e) => field("criticalThreshold", Number(e.target.value))}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Optional statuses</CardTitle>
          <CardDescription>Present and Absent are always available. Turning one off here hides it from the marking screen going forward.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SettingToggle label="Half day" checked={settings.allowHalfDay} disabled={!canEdit} onChange={(v) => field("allowHalfDay", v)} />
          <SettingToggle label="Late" checked={settings.allowLate} disabled={!canEdit} onChange={(v) => field("allowLate", v)} />
          <SettingToggle label="Leave" checked={settings.allowLeave} disabled={!canEdit} onChange={(v) => field("allowLeave", v)} />
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

function SettingToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
