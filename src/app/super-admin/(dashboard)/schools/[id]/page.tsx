import { notFound } from "next/navigation";
import { loadSchoolDetail } from "@/lib/platform-schools";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SchoolDetail } from "@/features/platform/schools/school-detail";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const school = await loadSchoolDetail(id);
  if (!school) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Schools", href: "/super-admin/schools" }, { label: school.name }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">{school.name}</h1>
      </div>
      <SchoolDetail school={school} />
    </div>
  );
}
