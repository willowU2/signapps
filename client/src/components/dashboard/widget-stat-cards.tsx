'use client';

import { StatCard } from '@/components/dashboard/stat-card';
import { Container, HardDrive, Network, Activity } from 'lucide-react';
import Link from 'next/link';
import { useDashboardData } from '@/hooks/use-dashboard';

export function WidgetStatCards() {
  const { data: dashboardData } = useDashboardData();

  const uptimeHours = Math.floor((dashboardData?.uptime || 0) / 3600);
  const uptimeDays = Math.floor(uptimeHours / 24);
  const uptimeStr = uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours % 24}h` : `${uptimeHours}h`;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link href="/containers">
        <StatCard
          title="Containers"
          value={`${dashboardData?.runningContainers || 0}/${dashboardData?.containers || 0}`}
          icon={Container}
          description="Running / Total"
          className="cursor-pointer hover:border-primary/50 transition-colors"
        />
      </Link>
      <Link href="/storage">
        <StatCard
          title="Storage"
          value={dashboardData?.storage || '0'}
          icon={HardDrive}
          description="S3 Buckets"
          className="cursor-pointer hover:border-primary/50 transition-colors"
        />
      </Link>
      <Link href="/routes">
        <StatCard
          title="Routes"
          value={dashboardData?.routes || 0}
          icon={Network}
          description="Active proxy routes"
          className="cursor-pointer hover:border-primary/50 transition-colors"
        />
      </Link>
      <StatCard
        title="Uptime"
        value={uptimeStr || '-'}
        icon={Activity}
        description="System uptime"
      />
    </div>
  );
}
