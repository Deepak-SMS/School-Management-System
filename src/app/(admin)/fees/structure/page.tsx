import { FeeStructureTable } from "@/features/fees/fee-structure-table";
import { FeeCategoryManager } from "@/features/fees/fee-category-manager";
import { FeeStudentCategoryManager } from "@/features/fees/fee-student-category-manager";
import { LateFeeRuleManager } from "@/features/fees/late-fee-rule-manager";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function FeeStructurePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Fees & Finance", href: "/fees/structure" }, { label: "Fee Structure" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Fee Structure</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define fee heads, per-class fee plans, installment schedules and late-fee rules, then publish to assign them
          to students automatically.
        </p>
      </div>

      <Tabs defaultValue="structures">
        <TabsList>
          <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          <TabsTrigger value="categories">Fee Categories</TabsTrigger>
          <TabsTrigger value="student-categories">Student Categories</TabsTrigger>
          <TabsTrigger value="late-fees">Late Fee Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="structures">
          <FeeStructureTable />
        </TabsContent>
        <TabsContent value="categories">
          <FeeCategoryManager />
        </TabsContent>
        <TabsContent value="student-categories">
          <FeeStudentCategoryManager />
        </TabsContent>
        <TabsContent value="late-fees">
          <LateFeeRuleManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
