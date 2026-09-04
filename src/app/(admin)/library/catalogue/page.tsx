import { BookTable } from "@/features/library/book-table";
import { LibraryCategoryManager } from "@/features/library/library-category-manager";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function LibraryCataloguePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Library", href: "/library" }, { label: "Catalogue" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Catalogue</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every book title on file, and the categories they&apos;re classified under.</p>
      </div>

      <Tabs defaultValue="books">
        <TabsList>
          <TabsTrigger value="books">Books</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="books">
          <BookTable />
        </TabsContent>
        <TabsContent value="categories">
          <LibraryCategoryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
