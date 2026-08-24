"use client";

import { useRouter } from "next/navigation";
import { campusService } from "@/services/campusService";
import { CampusForm } from "@/features/campuses/campus-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewCampusPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Campuses", href: "/school/campuses" },
            { label: "Add Campus" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Campus</h1>
      </div>
      <CampusForm
        onSubmit={async (input) => {
          const campus = await campusService.create(input);
          toast({ title: "Campus created", variant: "success" });
          router.push(`/school/campuses/${campus.id}`);
        }}
      />
    </div>
  );
}
