import { RssManager } from '@/components/social/rss-manager';

export const metadata = { title: 'SignSocial — Automation' };

export default function SocialAutomationPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Automation</h1>
        <p className="text-muted-foreground text-sm mt-1">
          RSS auto-posting and evergreen content queues
        </p>
      </div>
      <RssManager />
    </div>
  );
}
