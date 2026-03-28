'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AnnouncementBoard } from '@/components/announcements/announcement-board';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Bell } from 'lucide-react';

export default function AnnouncementsPage() {
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
        <AnnouncementBoard />
      </div>
    </AppLayout>
  );
}
