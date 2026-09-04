import { LibrarySettingsForm } from "@/features/library/library-settings-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function LibrarySettingsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Library", href: "/library" }, { label: "Settings" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Library Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Borrowing limits, renewal, and fine rules the rest of the library module will enforce.</p>
      </div>
      <LibrarySettingsForm />
    </div>
  );
}
