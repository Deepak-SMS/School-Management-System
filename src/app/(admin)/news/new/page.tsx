"use client";

import { useRouter } from "next/navigation";
import { newsService } from "@/services/newsService";
import { NewsForm } from "@/features/news/news-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewNewsPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "News Management", href: "/news" }, { label: "All News", href: "/news/all" }, { label: "Create News" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Create News</h1>
      </div>
      <NewsForm
        mode="create"
        submitLabel="Save"
        onSubmit={async (input) => {
          const news = await newsService.create(input);
          toast({
            title: news.status === "published" ? "Article published" : news.status === "scheduled" ? "Article scheduled" : "Draft saved",
            variant: "success",
          });
          router.push(`/news/${news.id}`);
        }}
      />
    </div>
  );
}
