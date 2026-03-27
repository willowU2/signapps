import { RssManager } from '@/components/social/rss-manager';
import { RssAutoShare } from '@/components/social/rss-auto-share';
import { EvergreenQueue } from '@/components/social/evergreen-queue';

export const metadata = { title: 'SignSocial — Automation' };

export default function SocialAutomationPage() {
  return (
    <div className="space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-bold">Automation</h1>
        <p className="text-muted-foreground text-sm mt-1">
          RSS auto-posting and evergreen content queues
        </p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-base font-semibold">RSS Feeds</h2>
          <RssManager />
        </div>
        <div className="space-y-6">
          <h2 className="text-base font-semibold">Auto-Share Queue</h2>
          <RssAutoShare />
        </div>
      </div>
      <div>
        <h2 className="text-base font-semibold mb-4">Evergreen Recycling</h2>
        <EvergreenQueue />
      </div>
    </div>
  );
}
