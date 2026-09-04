import { ExpenseDetail } from "@/features/finance/expense-detail";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <ExpenseDetail id={id} />
    </div>
  );
}
