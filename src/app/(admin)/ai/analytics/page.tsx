"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AttendanceAnalyticsView } from "@/features/ai/analytics/attendance-analytics-view";
import { FeesAnalyticsView } from "@/features/ai/analytics/fees-analytics-view";

export default function AiAnalyticsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real numbers from your school&apos;s data, narrated in plain language.</p>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="pt-4">
          <AttendanceAnalyticsView />
        </TabsContent>
        <TabsContent value="fees" className="pt-4">
          <FeesAnalyticsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
