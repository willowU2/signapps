'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { UserActivity } from '@/components/admin/user-activity';
import { Users } from 'lucide-react';

export default function UserActivityPage() {
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">User Activity Report</h1>
        </div>
        <UserActivity />
      </div>
    </AppLayout>
  );
}
