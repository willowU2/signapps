'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AnnouncementBoard } from '@/components/announcements/announcement-board';
import { Megaphone } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';

export default function AnnouncementsPage() {
  usePageTitle('Annonces');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [initialAnnouncements, setInitialAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/comms/announcements')
      .then(r => r.json())
      .then(records => {
        if (!Array.isArray(records)) return;
        const mapped = records.map((r: { id: string; data: Record<string, unknown>; created_at: string }) => ({
          id: r.id,
          title: r.data.title ?? '',
          content: r.data.content ?? '',
          author: r.data.author ?? 'Unknown',
          date: new Date(r.created_at),
          category: r.data.category ?? 'General',
          isPinned: r.data.isPinned ?? false,
          likes: r.data.likes ?? 0,
          liked: false,
        }));
        setInitialAnnouncements(mapped);
      })
      .catch(() => {});
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Internal Announcements</h1>
            <p className="text-sm text-muted-foreground">Company-wide communications and updates</p>
          </div>
        </div>
        <AnnouncementBoard initialAnnouncements={initialAnnouncements} />
      </div>
    </AppLayout>
  );
}
