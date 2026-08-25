import { SubjectTable } from "@/features/subjects/subject-table";
import { ClassSubjectsPanel } from "@/features/subjects/class-subjects-panel";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function SubjectsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "Subjects" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Subjects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage subjects and assign them to classes, sections, and teachers.
        </p>
      </div>

      {/*
        Two views of the same SubjectAssignment data. "By class" is the default
        because that is how a school thinks about it — what does Class 6 study —
        whereas the flat list is for maintaining the subject catalogue itself.
      */}
      <Tabs defaultValue="by-class">
        <TabsList>
          <TabsTrigger value="by-class">By class</TabsTrigger>
          <TabsTrigger value="all">All subjects</TabsTrigger>
        </TabsList>

        <TabsContent value="by-class">
          <ClassSubjectsPanel />
        </TabsContent>

        <TabsContent value="all">
          <SubjectTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
