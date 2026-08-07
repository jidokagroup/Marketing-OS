import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type XAnalyticsTotals = {
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
};

type Metric = { label: string; value: string };

const DEMO_X_METRICS: Metric[] = [
  { label: "Impressions", value: "48,200" },
  { label: "Likes", value: "1,240" },
  { label: "Replies", value: "312" },
  { label: "Reposts", value: "486" },
];

const DEMO_EMAIL_METRICS: Metric[] = [
  { label: "Emails sent", value: "4,800" },
  { label: "Open rate", value: "41.2%" },
  { label: "Click rate", value: "4.8%" },
  { label: "Unsubscribes", value: "12" },
];

const DEMO_GOOGLE_BUSINESS_METRICS: Metric[] = [
  { label: "Profile views", value: "3,120" },
  { label: "Search appearances", value: "9,450" },
  { label: "Calls", value: "42" },
  { label: "Direction requests", value: "88" },
  { label: "Website clicks", value: "210" },
];

const DEMO_AD_PLATFORMS: { name: string; metrics: Metric[] }[] = [
  {
    name: "TikTok Ads",
    metrics: [
      { label: "Spend", value: "$620" },
      { label: "Impressions", value: "152,000" },
      { label: "Clicks", value: "3,890" },
      { label: "CTR", value: "2.6%" },
      { label: "Conversions", value: "94" },
      { label: "ROAS", value: "2.1x" },
    ],
  },
  {
    name: "Facebook Ads",
    metrics: [
      { label: "Spend", value: "$1,150" },
      { label: "Impressions", value: "238,000" },
      { label: "Clicks", value: "5,420" },
      { label: "CTR", value: "2.3%" },
      { label: "Conversions", value: "163" },
      { label: "ROAS", value: "3.4x" },
    ],
  },
  {
    name: "Instagram Ads",
    metrics: [
      { label: "Spend", value: "$940" },
      { label: "Impressions", value: "197,500" },
      { label: "Clicks", value: "4,710" },
      { label: "CTR", value: "2.4%" },
      { label: "Conversions", value: "128" },
      { label: "ROAS", value: "2.8x" },
    ],
  },
  {
    name: "Google Ads",
    metrics: [
      { label: "Spend", value: "$1,480" },
      { label: "Impressions", value: "88,300" },
      { label: "Clicks", value: "6,240" },
      { label: "CTR", value: "7.1%" },
      { label: "Conversions", value: "211" },
      { label: "ROAS", value: "3.9x" },
    ],
  },
];

function DemoBadge() {
  return (
    <Badge
      variant="outline"
      className="border-amber-500/60 bg-amber-500/10 text-amber-600"
    >
      Demo data
    </Badge>
  );
}

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsExtendedSections({
  xTotals,
  emailPlatform,
}: {
  xTotals: XAnalyticsTotals | null;
  emailPlatform: string | null;
}) {
  const xMetrics: Metric[] = xTotals
    ? [
        { label: "Impressions", value: xTotals.impressions.toLocaleString() },
        { label: "Likes", value: xTotals.likes.toLocaleString() },
        { label: "Replies", value: xTotals.replies.toLocaleString() },
        { label: "Reposts", value: xTotals.reposts.toLocaleString() },
      ]
    : DEMO_X_METRICS;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
        Sections marked <span className="font-medium">Demo data</span> show
        sample numbers so you can preview the layout. They are not pulled from
        your accounts yet.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>X analytics</CardTitle>
              {xTotals ? <Badge variant="outline">Live data</Badge> : <DemoBadge />}
            </div>
            <CardDescription>
              {xTotals
                ? "Aggregated from imported X post analytics."
                : "Live numbers import after X posts are published from the Scheduler."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MetricGrid metrics={xMetrics} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>
                Email analytics{emailPlatform ? ` · ${emailPlatform}` : ""}
              </CardTitle>
              <DemoBadge />
            </div>
            <CardDescription>
              {emailPlatform
                ? `${emailPlatform} is connected. Live campaign metrics start with the first sent campaign.`
                : "Choose an email provider in Settings, then connect or configure that provider to attach live campaign metrics."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MetricGrid metrics={DEMO_EMAIL_METRICS} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Google Business Profile</CardTitle>
            <DemoBadge />
          </div>
          <CardDescription>
            Sample of how local search performance will appear once a Google
            Business Profile is linked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {DEMO_GOOGLE_BUSINESS_METRICS.map((metric) => (
              <div key={metric.label} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{metric.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Ads</CardTitle>
            <DemoBadge />
          </div>
          <CardDescription>
            Sample paid performance across ad platforms. Live numbers require
            connecting each ad account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            {DEMO_AD_PLATFORMS.map((platform) => (
              <div key={platform.name} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{platform.name}</p>
                  <DemoBadge />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {platform.metrics.map((metric) => (
                    <div key={metric.label}>
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <p className="text-lg font-bold tabular-nums">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
