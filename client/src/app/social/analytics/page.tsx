import { SocialAnalytics } from '@/components/social/social-analytics';
import { HashtagEvolutionChart } from '@/components/social/hashtag-evolution-chart';
import { CompetitorMonitor } from '@/components/social/competitor-monitor';
import { WeeklyPdfReport } from '@/components/social/weekly-pdf-report';

export const metadata = { title: 'SignSocial — Analytics' };

export default function SocialAnalyticsPage() {
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
