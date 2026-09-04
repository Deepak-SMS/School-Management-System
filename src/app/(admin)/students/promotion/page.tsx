import { PromotionWorkspace } from "@/features/students/promotion/promotion-workspace";

export default function StudentPromotionPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Student promotion</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Move students from one academic year&apos;s classes into another&apos;s — promote them a grade,
          retain them, or mark them graduated/exited.
        </p>
      </div>
      <PromotionWorkspace />
    </div>
  );
}
