"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
}

/**
 * The one chart on the dashboard — CLAUDE.md earmarks recharts for "the Phase 2
 * dashboard" and this is the only multi-day, multi-series figure on the page;
 * everything else is a single-series proportion, which stays a plain bar list
 * (see BreakdownList in dashboard-overview.tsx) rather than pulling in a chart
 * for a shape a labelled bar already shows clearly.
 */
export function AttendanceTrendChart({ data }: { data: AttendanceTrendPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { weekday: "short" }),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-border)", opacity: 0.3 }}
            contentStyle={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="present" name="Present" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="absent" name="Absent" fill="var(--color-danger-500)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
