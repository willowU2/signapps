'use client';

// IDEA-115: Notification bundling — group N similar notifications into one

import { useMemo } from 'react';
import { Bell } from 'lucide-react';
import { AppNotification } from '@/stores/notification-store';

interface BundledGroup {
  key: string;
  type: string;
  count: number;
  label: string;
  latest: AppNotification;
  all: AppNotification[];
}

const BUNDLE_THRESHOLD = 3;

const TYPE_LABELS: Record<string, string> = {
  mail: 'nouveaux emails',
  tasks: 'tâches mises à jour',
  calendar: 'rappels calendrier',
  container: 'événements container',
  security: 'alertes sécurité',
  storage: 'notifications stockage',
  user: 'activités utilisateur',
  system: 'notifications système',
};

export function bundleNotifications(notifications: AppNotification[]): {
  bundled: BundledGroup[];
  singles: AppNotification[];
} {
  // Group by type
  const groups = new Map<string, AppNotification[]>();
  for (const n of notifications) {
    const key = n.type;
    const arr = groups.get(key) ?? [];
    arr.push(n);
    groups.set(key, arr);
  }

  const bundled: BundledGroup[] = [];
  const singles: AppNotification[] = [];

  groups.forEach((items, type) => {
    if (items.length >= BUNDLE_THRESHOLD) {
      const sorted = [...items].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      bundled.push({
        key: type,
        type,
        count: items.length,
        label: `${items.length} ${TYPE_LABELS[type] ?? 'notifications'}`,
        latest: sorted[0],
        all: sorted,
      });
    } else {
      singles.push(...items);
    }
  });

  return { bundled, singles };
}

interface BundledGroupCardProps {
  group: BundledGroup;
  onExpand: (group: BundledGroup) => void;
}

export function BundledGroupCard({ group, onExpand }: BundledGroupCardProps) {
  return (
    <button
      onClick={() => onExpand(group)}
      className="w-full flex items-center gap-3 p-3 rounded-xl border bg-accent/20 hover:bg-accent/40 transition-colors text-left"
    >
      <div className="flex-shrink-0 rounded-full p-2 bg-primary/10 text-primary">
        <Bell className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{group.label}</p>
        <p className="text-xs text-muted-foreground truncate">
          Dernier : {group.latest.title}
        </p>
      </div>
      <span className="flex-shrink-0 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
        {group.count}
      </span>
    </button>
  );
}

interface NotificationBundleViewProps {
  notifications: AppNotification[];
  renderSingle: (n: AppNotification) => React.ReactNode;
}

export function NotificationBundleView({
  notifications,
  renderSingle,
}: NotificationBundleViewProps) {
  const { bundled, singles } = useMemo(
    () => bundleNotifications(notifications),
    [notifications]
  );

  // No bundling if all singles
  if (bundled.length === 0) {
    return <>{notifications.map((n) => renderSingle(n))}</>;
  }

  return (
    <div className="space-y-2">
      {bundled.map((g) => (
        <BundledGroupCard
          key={g.key}
          group={g}
          onExpand={() => {}}
        />
      ))}
      {singles.map((n) => renderSingle(n))}
    </div>
  );
}
