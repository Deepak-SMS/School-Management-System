"use client";

import { useSearchParams } from "next/navigation";
import { NewsTable } from "@/features/news/news-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function AllNewsPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? undefined;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "News Management", href: "/news" }, { label: "All News" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">All News</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search, filter, and manage every announcement — drafts, scheduled, published, and archived.</p>
      </div>
      <NewsTable initialStatus={initialStatus} />
    </div>
  );
}
