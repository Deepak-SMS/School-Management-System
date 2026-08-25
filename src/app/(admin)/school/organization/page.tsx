import { OrganizationChart } from "@/features/organization/organization-chart";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function OrganizationPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[{ label: "School Management", href: "/school/profile" }, { label: "Organization" }]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who works in which department, who reports to whom, and what each person can access.
        </p>
      </div>

      <OrganizationChart />
    </div>
  );
}
