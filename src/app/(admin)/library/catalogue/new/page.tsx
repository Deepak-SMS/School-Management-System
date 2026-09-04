import { BookForm } from "@/features/library/book-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function NewLibraryBookPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Library", href: "/library" }, { label: "Catalogue", href: "/library/catalogue" }, { label: "Add Book" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Book</h1>
        <p className="mt-1 text-sm text-muted-foreground">Catalogue a new title. Add physical copies from its profile once it&apos;s saved.</p>
      </div>
      <BookForm />
    </div>
  );
}
