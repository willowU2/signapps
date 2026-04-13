"use client";

import dynamic from "next/dynamic";
import { usePageTitle } from "@/hooks/use-page-title";

const SocialAnalytics = dynamic(
  () =>
    import("@/components/social/social-analytics").then((m) => ({
      default: m.SocialAnalytics,
    })),
  {
    loading: () => <div className="h-96 animate-pulse rounded bg-muted" />,
    ssr: false,
  },
);
const HashtagEvolutionChart = dynamic(
  () =>
    import("@/components/social/hashtag-evolution-chart").then((m) => ({
      default: m.HashtagEvolutionChart,
    })),
  {
    loading: () => <div className="h-64 animate-pulse rounded bg-muted" />,
    ssr: false,
  },
);
const CompetitorMonitor = dynamic(
  () =>
    import("@/components/social/competitor-monitor").then((m) => ({
      default: m.CompetitorMonitor,
    })),
  {
    loading: () => <div className="h-64 animate-pulse rounded bg-muted" />,
    ssr: false,
  },
);
const WeeklyPdfReport = dynamic(
  () =>
    import("@/components/social/weekly-pdf-report").then((m) => ({
      default: m.WeeklyPdfReport,
    })),
  {
    loading: () => <div className="h-48 animate-pulse rounded bg-muted" />,
    ssr: false,
  },
);

export default function SocialAnalyticsPage() {
  usePageTitle("Social — Analytique");
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SocialAnalytics />
      <div className="p-6 space-y-6 border-t">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <HashtagEvolutionChart />
          <CompetitorMonitor />
        </div>
        <div className="max-w-sm">
          <WeeklyPdfReport />
        </div>
      </div>
    </div>
  );
}
