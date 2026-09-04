import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CreateSchoolWizard } from "@/features/platform/schools/create-school-wizard";

export default function NewSchoolPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Schools", href: "/super-admin/schools" }, { label: "Create School" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Create School</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Onboard a new school and generate its admin&apos;s first login.
        </p>
      </div>
      <CreateSchoolWizard />
    </div>
  );
}
