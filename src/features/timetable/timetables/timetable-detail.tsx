"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Send } from "lucide-react";
import { timetableService } from "@/services/timetableService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import { staffService } from "@/services/staffService";
import type { TimetableDetail as TimetableDetailType } from "@/types/timetable";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";
import type { StaffRecord } from "@/types/staff";
import type { RoomRecord } from "@/types/timetable";
import { TIMETABLE_STATUS_LABELS } from "@/lib/constants/timetable";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TimetableGrid } from "@/features/timetable/grid/timetable-grid";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = { draft: "warning", published: "success", archived: "neutral" };

export function TimetableDetail({ timetable: initial }: { timetable: TimetableDetailType }) {
  const router = useRouter();
  const user = useCurrentUser();
  const canEdit = hasPermission(user.role, "timetable", "edit");
  const canPublish = hasPermission(user.role, "timetable", "approve");

  const [timetable, setTimetable] = useState(initial);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set(timetable.classes.map((c) => c.classId)));
  const [savingClasses, setSavingClasses] = useState(false);

  const [generating, setGenerating] = useState(false);

  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [viewMode, setViewMode] = useState<"section" | "teacher" | "room">("section");
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [teachers, setTeachers] = useState<StaffRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState("");

  useEffect(() => {
    classService.list({ pageSize: 100, status: "active" }).then((r) => setClasses(r.data));
    staffService.list({ pageSize: 200, category: "teacher" }).then((r) => setTeachers(r.data));
    timetableService.listRooms().then((r) => setRooms(r.data));
  }, []);

  useEffect(() => {
    Promise.all(timetable.classes.map((c) => sectionService.list({ classId: c.classId, pageSize: 100, status: "active" }))).then((results) => {
      const merged = results.flatMap((r) => r.data);
      const unique = Array.from(new Map(merged.map((s) => [s.id, s])).values());
      setSections(unique);
      if (!selectedFilterId && unique[0]) setSelectedFilterId(unique[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable.classes]);

  function toggleClass(id: string) {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveClasses() {
    setSavingClasses(true);
    try {
      await timetableService.updateTimetable(timetable.id, { classes: Array.from(selectedClassIds).map((classId) => ({ classId })) });
      toast({ title: "Classes updated", variant: "success" });
      const refreshed = await timetableService.getTimetable(timetable.id);
      setTimetable(refreshed);
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't update classes.", variant: "danger" });
    } finally {
      setSavingClasses(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const report = await timetableService.generateTimetable(timetable.id);
      toast({
        title: report.unplaced.length === 0 ? "Generated — everything placed" : `Generated — ${report.unplaced.length} unplaced`,
        variant: report.unplaced.length === 0 ? "success" : "warning",
      });
      const refreshed = await timetableService.getTimetable(timetable.id);
      setTimetable(refreshed);
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't generate the timetable.", variant: "danger" });
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await timetableService.updateTimetable(timetable.id, { status: "published" });
      toast({ title: "Timetable published", variant: "success" });
      setConfirmingPublish(false);
      const refreshed = await timetableService.getTimetable(timetable.id);
      setTimetable(refreshed);
      router.refresh();
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't publish.", variant: "danger" });
    } finally {
      setPublishing(false);
    }
  }

  const report = timetable.lastGenerationReport;

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_TONE[timetable.status] ?? "neutral"}>
            {TIMETABLE_STATUS_LABELS[timetable.status as keyof typeof TIMETABLE_STATUS_LABELS] ?? timetable.status}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {timetable.academicYear.label} · {timetable.timingSet.name}
          </p>
        </div>
        {canPublish && timetable.status === "draft" && (
          <Button size="sm" onClick={() => setConfirmingPublish(true)}>
            <Send className="size-4" /> Publish
          </Button>
        )}
      </Card>

      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="grid">Grid</TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
          <Card className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap gap-3">
              {classes.map((cls) => (
                <label key={cls.id} className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={selectedClassIds.has(cls.id)} onCheckedChange={() => toggleClass(cls.id)} disabled={!canEdit} />
                  {cls.name}
                </label>
              ))}
            </div>
            {canEdit && (
              <Button size="sm" className="self-start" onClick={saveClasses} isLoading={savingClasses}>
                Save
              </Button>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="generate">
          <Card className="flex flex-col gap-4 p-4">
            {canEdit && (
              <Button className="self-start" onClick={handleGenerate} isLoading={generating}>
                <RefreshCw className="size-4" /> Generate
              </Button>
            )}
            {report && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground">
                  {report.placed.length} of {report.totalUnits} periods placed
                  {report.unplaced.length > 0 && ` — ${report.unplaced.length} unassigned`}
                </p>
                {report.unplaced.length > 0 && (
                  <Alert variant="warning" title="Unassigned periods">
                    <ul className="list-inside list-disc">
                      {report.unplaced.slice(0, 20).map((u, i) => (
                        <li key={i}>{u.reason}</li>
                      ))}
                    </ul>
                    {report.unplaced.length > 20 && <p className="mt-1">…and {report.unplaced.length - 20} more.</p>}
                  </Alert>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="grid">
          <Card className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={viewMode} onValueChange={(v) => { setViewMode(v as typeof viewMode); setSelectedFilterId(""); }}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="section">By Section</SelectItem>
                  <SelectItem value="teacher">By Teacher</SelectItem>
                  <SelectItem value="room">By Room</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedFilterId} onValueChange={setSelectedFilterId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {viewMode === "section" && sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  {viewMode === "teacher" && teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}
                  {viewMode === "room" && rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <TimetableGrid
              timetableId={timetable.id}
              periods={timetable.timingSet.periods}
              workingDays={timetable.workingDays}
              sectionId={viewMode === "section" ? selectedFilterId || undefined : undefined}
              teacherId={viewMode === "teacher" ? selectedFilterId || undefined : undefined}
              roomId={viewMode === "room" ? selectedFilterId || undefined : undefined}
              editable={canEdit}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmingPublish}
        onOpenChange={setConfirmingPublish}
        title="Publish this timetable?"
        description="Teachers, students, and parents will be able to see it once published."
        confirmLabel="Publish"
        isLoading={publishing}
        onConfirm={handlePublish}
      />
    </div>
  );
}
