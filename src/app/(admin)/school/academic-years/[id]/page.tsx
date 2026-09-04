"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Layers, School, Users, UserCog, CheckCircle2 } from "lucide-react";
import { academicYearService } from "@/services/academicYearService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import { subjectService } from "@/services/subjectService";
import { AcademicYearForm } from "@/features/academic-years/academic-year-form";
import type { AcademicYearInput } from "@/lib/validation/academicYear";
import type { AcademicYearRecord } from "@/types/academicYear";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";
import type { SubjectRecord } from "@/types/subject";
import { useCan } from "@/hooks/use-can";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";

const statusVariant: Record<string, "success" | "neutral" | "warning" | "danger" | "info"> = {
  active: "success",
  draft: "neutral",
  upcoming: "info",
  archived: "neutral",
};

function toDefaultValues(year: AcademicYearRecord): Partial<AcademicYearInput> {
  return {
    label: year.label,
    status: year.status as AcademicYearInput["status"],
    startDate: year.startDate.slice(0, 10),
    endDate: year.endDate.slice(0, 10),
    admissionStartDate: year.admissionStartDate?.slice(0, 10) ?? undefined,
    admissionEndDate: year.admissionEndDate?.slice(0, 10) ?? undefined,
    promotionDate: year.promotionDate?.slice(0, 10) ?? undefined,
    resultPublicationDate: year.resultPublicationDate?.slice(0, 10) ?? undefined,
  };
}

export default function AcademicYearDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const canEdit = can("academicYears", "edit");
  const [year, setYear] = useState<AcademicYearRecord | null>(null);
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [sections, setSections] = useState<SectionRecord[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activeTab, setActiveTab] = useState("classes");

  // Lets the "Edit" action on the academic years table jump straight to this
  // tab (?tab=settings) without needing useSearchParams()/a Suspense boundary.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab !== "settings") return;
    const timeout = setTimeout(() => setActiveTab("settings"), 0);
    return () => clearTimeout(timeout);
  }, []);

  function load() {
    academicYearService.get(id).then(setYear).catch(() => setError(true));
    classService.list({ academicYearId: id, pageSize: 100 }).then((r) => setClasses(r.data));
    sectionService.list({ academicYearId: id, pageSize: 100 }).then((r) => setSections(r.data));
    subjectService.list({ academicYearId: id, pageSize: 100 }).then((r) => setSubjects(r.data));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-5xl px-6 py-16" onRetry={load} />;
  if (!year) return <LoadingState className="mx-auto max-w-5xl px-6 py-16" />;

  async function handleSetActive() {
    setActivating(true);
    try {
      await academicYearService.setActive(id);
      toast({ title: "Academic year activated", variant: "success" });
      load();
    } catch {
      toast({ title: "Couldn't activate academic year", variant: "danger" });
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Academic Years", href: "/school/academic-years" },
            { label: year.label },
          ]}
        />
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{year.label}</h1>
          <Badge variant={statusVariant[year.status] ?? "neutral"}>{year.status}</Badge>
          {year.status !== "active" && (
            <Button variant="secondary" size="sm" isLoading={activating} onClick={handleSetActive}>
              <CheckCircle2 className="size-4" /> Set as active
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {year.startDate.slice(0, 10)} – {year.endDate.slice(0, 10)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Students" value={year.counts?.students ?? 0} icon={Users} />
        <StatCard label="Classes" value={year.counts?.classes ?? 0} icon={School} />
        <StatCard label="Sections" value={year.counts?.sections ?? 0} icon={Layers} />
        <StatCard label="Subjects" value={year.counts?.subjects ?? 0} icon={BookOpen} />
        <StatCard label="Teachers" value={year.counts?.teachers ?? 0} icon={UserCog} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
          {!classes ? (
            <LoadingState className="py-8" />
          ) : classes.length === 0 ? (
            <EmptyState icon={School} title="No classes yet" description="Add classes for this academic year." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>{cls.campus.name}</TableCell>
                    <TableCell>{cls.counts?.sections ?? 0}</TableCell>
                    <TableCell>{cls.counts?.students ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/classes/${cls.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="sections">
          {!sections ? (
            <LoadingState className="py-8" />
          ) : sections.length === 0 ? (
            <EmptyState icon={Layers} title="No sections yet" description="Add sections under this academic year's classes." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => (
                  <TableRow key={section.id}>
                    <TableCell className="font-medium">{section.name}</TableCell>
                    <TableCell>{section.class.name}</TableCell>
                    <TableCell>{section.counts?.students ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/sections/${section.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="subjects">
          {!subjects ? (
            <LoadingState className="py-8" />
          ) : subjects.length === 0 ? (
            <EmptyState icon={BookOpen} title="No subjects assigned" description="Assign subjects to classes for this academic year." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Classes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="capitalize">{subject.subjectType.replace("_", " ")}</TableCell>
                    <TableCell>{subject.counts?.classes ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/school/subjects/${subject.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="settings">
          {canEdit ? (
            <AcademicYearForm
              key={`${year.id}-${year.status}`}
              defaultValues={toDefaultValues(year)}
              submitLabel="Save changes"
              onSubmit={async (input) => {
                const updated = await academicYearService.update(id, input);
                setYear(updated);
                toast({ title: "Academic year updated", variant: "success" });
              }}
            />
          ) : (
            <div className="flex flex-col gap-3 text-sm sm:grid sm:grid-cols-2">
              <Field label="Start date" value={year.startDate.slice(0, 10)} />
              <Field label="End date" value={year.endDate.slice(0, 10)} />
              <Field label="Admission start date" value={year.admissionStartDate?.slice(0, 10)} />
              <Field label="Admission end date" value={year.admissionEndDate?.slice(0, 10)} />
              <Field label="Promotion date" value={year.promotionDate?.slice(0, 10)} />
              <Field label="Result publication date" value={year.resultPublicationDate?.slice(0, 10)} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
