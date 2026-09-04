"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClassSectionPicker } from "@/features/ai/shared/class-section-picker";
import { AUDIENCE_MODES, type AudienceMode } from "@/lib/ai/communication/audience-modes";

interface AudiencePickerProps {
  mode: AudienceMode;
  onModeChange: (mode: AudienceMode) => void;
  classId: string | undefined;
  sectionId: string | undefined;
  onClassChange: (id: string | undefined) => void;
  onSectionChange: (id: string | undefined) => void;
  thresholdPct: number;
  onThresholdChange: (pct: number) => void;
}

export function AudiencePicker({ mode, onModeChange, classId, sectionId, onClassChange, onSectionChange, thresholdPct, onThresholdChange }: AudiencePickerProps) {
  const modeInfo = AUDIENCE_MODES.find((m) => m.value === mode)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Audience</Label>
        <Select value={mode} onValueChange={(v) => onModeChange(v as AudienceMode)}>
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{modeInfo.description}</p>
      </div>

      {(modeInfo.needsClassSection || modeInfo.needsThreshold) && (
        <div className="flex flex-wrap items-end gap-3">
          {modeInfo.needsClassSection && (
            <ClassSectionPicker classId={classId} sectionId={sectionId} onClassChange={onClassChange} onSectionChange={onSectionChange} />
          )}
          {modeInfo.needsThreshold && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Below % attendance</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={thresholdPct}
                onChange={(e) => onThresholdChange(Math.max(1, Math.min(100, Number(e.target.value) || 75)))}
                className="w-28"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
