import { SocialCalendar } from '@/components/social/social-calendar';

export const metadata = { title: 'SignSocial — Calendar' };

export default function SocialCalendarPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Publication Calendar</h1>
        <p className="text-muted-foreground text-sm mt-1">View and manage your scheduled posts</p>
      </div>
      <SocialCalendar />
    </div>
  );
}
