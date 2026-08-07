"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface TimePoint {
  date: string;
  reach: number;
  engagement: number;
}
export interface EngagementSlice {
  name: string;
  value: number;
}
export interface HourPoint {
  hour: string;
  engagement: number;
}

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };
const AXIS_LABEL = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
  fontWeight: 600,
};
const CHART_COLORS = ["#2563eb", "#14b8a6", "#f59e0b", "#ef4444", "#7c3aed", "#0891b2"];
const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
  fontSize: 12,
};

function formatCompact(value: number | string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value);
  if (numericValue >= 1000000) return `${Math.round(numericValue / 100000) / 10}M`;
  if (numericValue >= 1000) return `${Math.round(numericValue / 100) / 10}K`;
  return String(numericValue);
}

export function AnalyticsCharts({
  overTime,
  engagement,
  byHour,
}: {
  overTime: TimePoint[];
  engagement: EngagementSlice[];
  byHour: HourPoint[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Reach &amp; engagement over time</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden pb-4">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={overTime} margin={{ left: 8, right: 18, top: 12, bottom: 28 }}>
              <defs>
                <linearGradient id="reachLine" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
                <linearGradient id="engagementLine" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={AXIS}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={18}
                label={{ value: "Date", position: "insideBottom", offset: -16, style: AXIS_LABEL }}
              />
              <YAxis
                yAxisId="reach"
                tick={AXIS}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                width={48}
                label={{ value: "Reach", angle: -90, position: "insideLeft", style: AXIS_LABEL }}
              />
              <YAxis
                yAxisId="engagement"
                orientation="right"
                tick={AXIS}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                width={54}
                label={{ value: "Engagement", angle: 90, position: "insideRight", style: AXIS_LABEL }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: "#2563eb", strokeWidth: 1, strokeDasharray: "4 4" }}
                labelStyle={{ fontWeight: 700 }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
              <Line
                yAxisId="reach"
                type="monotone"
                dataKey="reach"
                name="Reach"
                stroke="url(#reachLine)"
                strokeWidth={3}
                dot={{ r: 3, fill: "#ffffff", stroke: "#2563eb", strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
              <Line
                yAxisId="engagement"
                type="monotone"
                dataKey="engagement"
                name="Engagement"
                stroke="url(#engagementLine)"
                strokeWidth={3}
                dot={{ r: 3, fill: "#ffffff", stroke: "#f59e0b", strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engagement breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden pb-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={engagement} margin={{ left: 8, right: 16, top: 12, bottom: 28 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={AXIS}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval={0}
                label={{ value: "Interaction type", position: "insideBottom", offset: -16, style: AXIS_LABEL }}
              />
              <YAxis
                tick={AXIS}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                width={48}
                label={{ value: "Total", angle: -90, position: "insideLeft", style: AXIS_LABEL }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "rgba(20, 184, 166, 0.08)" }}
                labelStyle={{ fontWeight: 700 }}
              />
              <Bar dataKey="value" name="Interactions" radius={[7, 7, 2, 2]} minPointSize={4} maxBarSize={56}>
                {engagement.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engagement by posting hour</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden pb-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byHour} margin={{ left: 8, right: 16, top: 12, bottom: 28 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={AXIS}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={10}
                label={{ value: "Posting hour", position: "insideBottom", offset: -16, style: AXIS_LABEL }}
              />
              <YAxis
                tick={AXIS}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                width={48}
                label={{ value: "Avg engagement", angle: -90, position: "insideLeft", style: AXIS_LABEL }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
                labelStyle={{ fontWeight: 700 }}
              />
              <Bar dataKey="engagement" name="Avg engagement" radius={[7, 7, 2, 2]} minPointSize={4} maxBarSize={34}>
                {byHour.map((entry, index) => (
                  <Cell key={entry.hour} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
