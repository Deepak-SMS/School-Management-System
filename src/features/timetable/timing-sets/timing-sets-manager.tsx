"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, CalendarRange } from "lucide-react";
import { timetableService } from "@/services/timetableService";
import type { TimingSetRecord } from "@/types/timetable";
import type { TimingSetInput } from "@/lib/validation/timetable";
import { TimingSetForm } from "@/features/timetable/timing-sets/timing-set-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";

export function TimingSetsManager() {
  const [timingSets, setTimingSets] = useState<TimingSetRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<"create" | TimingSetRecord | null>(null);

  function load() {
    setLoading(true);
    timetableService
      .listTimingSets()
      .then((r) => setTimingSets(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCreate(input: TimingSetInput) {
    await timetableService.createTimingSet(input);
    toast({ title: "Timing set created", variant: "success" });
    setModalMode(null);
    load();
  }

  async function handleUpdate(id: string, input: TimingSetInput) {
    await timetableService.updateTimingSet(id, input);
    toast({ title: "Timing set updated", variant: "success" });
    setModalMode(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalMode("create")}>
          <Plus className="size-4" /> Add Timing Set
        </Button>
      </div>

      {loading && <TableSkeleton rows={3} columns={2} />}

      {!loading && timingSets && timingSets.length === 0 && (
        <EmptyState icon={CalendarRange} title="No timing sets yet" description="Define period timings before creating a timetable." />
      )}

      {!loading && timingSets && timingSets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {timingSets.map((ts) => (
            <Card key={ts.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{ts.name}</p>
                <Button variant="ghost" size="sm" onClick={() => setModalMode(ts)}>
                  <Pencil className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ts.periods.map((p) => (
                  <Badge key={p.id} variant={p.kind === "teaching" ? "neutral" : "primary"}>
                    {p.label} · {p.startTime}–{p.endTime}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalMode !== null} onOpenChange={(v) => !v && setModalMode(null)}>
        <ModalContent title={modalMode === "create" ? "Add timing set" : "Edit timing set"} size="lg">
          <TimingSetForm
            defaultValues={
              modalMode && modalMode !== "create"
                ? { name: modalMode.name, periods: modalMode.periods.map((p) => ({ sortOrder: p.sortOrder, label: p.label, startTime: p.startTime, endTime: p.endTime, kind: p.kind as TimingSetInput["periods"][number]["kind"] })) }
                : undefined
            }
            submitLabel={modalMode === "create" ? "Add timing set" : "Save"}
            onSubmit={(input) => (modalMode === "create" ? handleCreate(input) : handleUpdate((modalMode as TimingSetRecord).id, input))}
          />
        </ModalContent>
      </Modal>
    </div>
  );
}
