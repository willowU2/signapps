/**
 * Workload Dashboard Component
 *
 * Displays team workload with utilization charts, capacity comparison,
 * overload alerts, and historical trends.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
  Users,
  Calendar,
  Target,
  ChevronRight,
  Download,
} from 'lucide-react';
import type {
  WorkloadData,
  WorkloadBreakdown,
  TeamMember,
  DateRange,
} from '@/lib/scheduling/types/scheduling';
import { timeItemsApi } from '@/lib/api/scheduler';

// ============================================================================
// Types
// ============================================================================

interface WorkloadDashboardProps {
  members: TeamMember[];
  workloadData: WorkloadData[];
  period: DateRange;
  onPeriodChange?: (period: '7d' | '14d' | '30d') => void;
  onMemberClick?: (memberId: string) => void;
  onExport?: () => void;
  className?: string;
}

interface WorkloadBarChartProps {
  data: WorkloadData[];
  maxHours?: number;
}

interface WorkloadBreakdownChartProps {
  breakdown: WorkloadBreakdown;
  totalHours: number;
}

// ============================================================================
// Constants
// ============================================================================

const UTILIZATION_THRESHOLDS = {
  low: 60,
  optimal: 80,
  high: 100,
  overload: 120,
};

const BREAKDOWN_COLORS = {
  meetings: { bg: 'bg-blue-500', text: 'text-blue-500', label: 'R\u00e9unions' },
  focusTime: { bg: 'bg-green-500', text: 'text-green-500', label: 'Focus' },
  tasks: { bg: 'bg-purple-500', text: 'text-purple-500', label: 'T\u00e2ches' },
  other: { bg: 'bg-gray-400', text: 'text-gray-400', label: 'Autre' },
};

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

// ============================================================================
// Main Component
// ============================================================================

export function WorkloadDashboard({
  members,
  workloadData,
  period,
  onPeriodChange,
  onMemberClick,
  onExport,
  className,
}: WorkloadDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = React.useState<'7d' | '14d' | '30d'>('7d');
  const [sortBy, setSortBy] = React.useState<'name' | 'utilization'>('utilization');

  // Compute summary stats
  const summaryStats = React.useMemo(() => {
    const totalScheduled = workloadData.reduce((sum, w) => sum + w.scheduledHours, 0);
    const totalCapacity = workloadData.reduce((sum, w) => sum + w.capacityHours, 0);
    const avgUtilization = totalCapacity > 0 ? (totalScheduled / totalCapacity) * 100 : 0;
    const overloadedCount = workloadData.filter(
      (w) => w.utilizationPercent > UTILIZATION_THRESHOLDS.overload
    ).length;
    const underutilizedCount = workloadData.filter(
      (w) => w.utilizationPercent < UTILIZATION_THRESHOLDS.low
    ).length;

    return {
      totalScheduled,
      totalCapacity,
      avgUtilization,
      overloadedCount,
      underutilizedCount,
      memberCount: workloadData.length,
    };
  }, [workloadData]);

  // Sort data
  const sortedData = React.useMemo(() => {
    return [...workloadData].sort((a, b) => {
      if (sortBy === 'utilization') {
        return b.utilizationPercent - a.utilizationPercent;
      }
      return a.memberName.localeCompare(b.memberName);
    });
  }, [workloadData, sortBy]);

  // Handle period change
  const handlePeriodChange = (value: '7d' | '14d' | '30d') => {
    setSelectedPeriod(value);
    onPeriodChange?.(value);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Charge de travail</h2>
          <p className="text-sm text-muted-foreground">
            {workloadData.length} membres \u00b7 {formatDateRange(period)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="14d">14 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
            </SelectContent>
          </Select>

          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Utilisation moyenne"
          value={`${Math.round(summaryStats.avgUtilization)}%`}
          icon={Target}
          description={getUtilizationLabel(summaryStats.avgUtilization)}
          color={getUtilizationColor(summaryStats.avgUtilization)}
        />
        <SummaryCard
          title="Heures planifi\u00e9es"
          value={`${Math.round(summaryStats.totalScheduled)}h`}
          icon={Clock}
          description={`sur ${Math.round(summaryStats.totalCapacity)}h de capacit\u00e9`}
        />
        <SummaryCard
          title="Membres"
          value={summaryStats.memberCount.toString()}
          icon={Users}
          description={
            summaryStats.overloadedCount > 0
              ? `${summaryStats.overloadedCount} en surcharge`
              : 'Charge \u00e9quilibr\u00e9e'
          }
          alert={summaryStats.overloadedCount > 0}
        />
        <SummaryCard
          title="Capacit\u00e9 disponible"
          value={`${Math.round(summaryStats.totalCapacity - summaryStats.totalScheduled)}h`}
          icon={Calendar}
          description={
            summaryStats.underutilizedCount > 0
              ? `${summaryStats.underutilizedCount} sous-utilis\u00e9s`
              : 'Bien r\u00e9partie'
          }
        />
      </div>

      {/* Alerts */}
      {summaryStats.overloadedCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">
            {summaryStats.overloadedCount} membre{summaryStats.overloadedCount > 1 ? 's' : ''} en
            surcharge (&gt;120% d'utilisation)
          </span>
        </div>
      )}

      {/* Team Workload Grid */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">D\u00e9tail par membre</CardTitle>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'utilization')}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utilization">Par utilisation</SelectItem>
                <SelectItem value="name">Par nom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedData.map((data) => (
              <WorkloadRow
                key={data.memberId}
                data={data}
                onClick={() => onMemberClick?.(data.memberId)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparaison d'\u00e9quipe</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkloadBarChart data={sortedData} />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Summary Card
// ============================================================================

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color?: string;
  alert?: boolean;
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  description,
  color,
  alert,
}: SummaryCardProps) {
  return (
    <Card className={cn(alert && 'border-destructive/50')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className={cn('h-4 w-4', color || 'text-muted-foreground')} />
        </div>
        <div className={cn('mt-2 text-2xl font-bold', color)}>{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Workload Row
// ============================================================================

interface WorkloadRowProps {
  data: WorkloadData;
  onClick?: () => void;
}

function WorkloadRow({ data, onClick }: WorkloadRowProps) {
  const TrendIcon = TREND_ICONS[data.trend];
  const utilizationColor = getUtilizationColor(data.utilizationPercent);
  const isOverloaded = data.utilizationPercent > UTILIZATION_THRESHOLDS.overload;

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors',
        isOverloaded && 'bg-destructive/5'
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10">
        <AvatarImage src={data.avatarUrl} alt={data.memberName} />
        <AvatarFallback>
          {data.memberName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Name and hours */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{data.memberName}</span>
          {isOverloaded && (
            <Badge variant="destructive" className="text-xs">
              Surcharge
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {Math.round(data.scheduledHours)}h / {Math.round(data.capacityHours)}h
          </span>
          <span>\u00b7</span>
          <WorkloadBreakdownMini breakdown={data.breakdown} />
        </div>
      </div>

      {/* Utilization progress */}
      <div className="w-40">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-sm font-medium', utilizationColor)}>
            {Math.round(data.utilizationPercent)}%
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <TrendIcon
                  className={cn(
                    'h-4 w-4',
                    data.trend === 'up'
                      ? 'text-red-500'
                      : data.trend === 'down'
                        ? 'text-green-500'
                        : 'text-muted-foreground'
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                {data.trend === 'up' && data.trendPercent
                  ? `+${data.trendPercent}% vs p\u00e9riode pr\u00e9c\u00e9dente`
                  : data.trend === 'down' && data.trendPercent
                    ? `${data.trendPercent}% vs p\u00e9riode pr\u00e9c\u00e9dente`
                    : 'Stable'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Progress
          value={Math.min(data.utilizationPercent, 150)}
          max={150}
          className={cn(
            'h-2',
            data.utilizationPercent > UTILIZATION_THRESHOLDS.overload &&
              '[&>div]:bg-destructive'
          )}
        />
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// ============================================================================
// Mini Breakdown
// ============================================================================

interface WorkloadBreakdownMiniProps {
  breakdown: WorkloadBreakdown;
}

function WorkloadBreakdownMini({ breakdown }: WorkloadBreakdownMiniProps) {
  const total = breakdown.meetings + breakdown.focusTime + breakdown.tasks + breakdown.other;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {breakdown.meetings > 0 && (
        <span className={cn('text-xs', BREAKDOWN_COLORS.meetings.text)}>
          {Math.round((breakdown.meetings / total) * 100)}% r\u00e9u
        </span>
      )}
      {breakdown.focusTime > 0 && (
        <>
          <span className="text-muted-foreground">\u00b7</span>
          <span className={cn('text-xs', BREAKDOWN_COLORS.focusTime.text)}>
            {Math.round((breakdown.focusTime / total) * 100)}% focus
          </span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Bar Chart
// ============================================================================

function WorkloadBarChart({ data, maxHours = 50 }: WorkloadBarChartProps) {
  const max = Math.max(maxHours, ...data.map((d) => d.scheduledHours));

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const barWidth = (item.scheduledHours / max) * 100;
        const capacityWidth = (item.capacityHours / max) * 100;

        return (
          <div key={item.memberId} className="flex items-center gap-3">
            <div className="w-24 truncate text-sm">{item.memberName.split(' ')[0]}</div>
            <div className="flex-1 relative h-6 bg-muted rounded">
              {/* Capacity marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-border z-10"
                style={{ left: `${capacityWidth}%` }}
              />

              {/* Scheduled bar */}
              <div
                className={cn(
                  'absolute top-0 bottom-0 left-0 rounded transition-all',
                  item.utilizationPercent > UTILIZATION_THRESHOLDS.overload
                    ? 'bg-destructive'
                    : item.utilizationPercent > UTILIZATION_THRESHOLDS.high
                      ? 'bg-yellow-500'
                      : 'bg-primary'
                )}
                style={{ width: `${barWidth}%` }}
              />

              {/* Hours label */}
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
                {Math.round(item.scheduledHours)}h
              </span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-primary" />
          <span>Heures planifi\u00e9es</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-border" />
          <span>Capacit\u00e9</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-destructive" />
          <span>Surcharge</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Workload Detail Sheet
// ============================================================================

export interface WorkloadDetailProps {
  data: WorkloadData;
  onClose?: () => void;
}

export function WorkloadDetail({ data, onClose }: WorkloadDetailProps) {
  const total =
    data.breakdown.meetings +
    data.breakdown.focusTime +
    data.breakdown.tasks +
    data.breakdown.other;

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={data.avatarUrl} alt={data.memberName} />
          <AvatarFallback className="text-lg">
            {data.memberName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{data.memberName}</h3>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(data.period)}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground">Utilisation</p>
          <p className={cn('text-2xl font-bold', getUtilizationColor(data.utilizationPercent))}>
            {Math.round(data.utilizationPercent)}%
          </p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground">Heures</p>
          <p className="text-2xl font-bold">
            {Math.round(data.scheduledHours)}
            <span className="text-sm font-normal text-muted-foreground">
              /{Math.round(data.capacityHours)}h
            </span>
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div>
        <h4 className="text-sm font-medium mb-3">R\u00e9partition du temps</h4>
        <div className="space-y-3">
          {Object.entries(BREAKDOWN_COLORS).map(([key, config]) => {
            const hours = data.breakdown[key as keyof WorkloadBreakdown];
            const percent = total > 0 ? (hours / total) * 100 : 0;

            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{config.label}</span>
                  <span className="font-medium">{Math.round(hours)}h</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full transition-all', config.bg)}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trend */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <span className="text-sm">Tendance</span>
        <div className="flex items-center gap-2">
          {React.createElement(TREND_ICONS[data.trend], {
            className: cn(
              'h-4 w-4',
              data.trend === 'up'
                ? 'text-red-500'
                : data.trend === 'down'
                  ? 'text-green-500'
                  : 'text-muted-foreground'
            ),
          })}
          <span
            className={cn(
              'text-sm font-medium',
              data.trend === 'up'
                ? 'text-red-500'
                : data.trend === 'down'
                  ? 'text-green-500'
                  : 'text-muted-foreground'
            )}
          >
            {data.trend === 'up' && data.trendPercent
              ? `+${data.trendPercent}%`
              : data.trend === 'down' && data.trendPercent
                ? `${data.trendPercent}%`
                : 'Stable'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getUtilizationColor(percent: number): string {
  if (percent > UTILIZATION_THRESHOLDS.overload) return 'text-destructive';
  if (percent > UTILIZATION_THRESHOLDS.high) return 'text-yellow-600 dark:text-yellow-500';
  if (percent < UTILIZATION_THRESHOLDS.low) return 'text-blue-600 dark:text-blue-500';
  return 'text-green-600 dark:text-green-500';
}

function getUtilizationLabel(percent: number): string {
  if (percent > UTILIZATION_THRESHOLDS.overload) return 'Surcharge d\u00e9tect\u00e9e';
  if (percent > UTILIZATION_THRESHOLDS.high) return 'Charge \u00e9lev\u00e9e';
  if (percent < UTILIZATION_THRESHOLDS.low) return 'Sous-utilisation';
  return 'Charge optimale';
}

function formatDateRange(range: DateRange): string {
  const start = range.start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  const end = range.end.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  return `${start} - ${end}`;
}

// ============================================================================
// Real Data Fetcher
// ============================================================================

export async function fetchWorkloadData(
  members: TeamMember[],
  start: Date,
  end: Date
): Promise<WorkloadData[]> {
  const memberIds = members.map((m) => m.id);
  if (memberIds.length === 0) return [];

  try {
    const res = await timeItemsApi.queryUsersEvents(memberIds, start.toISOString(), end.toISOString());
    const items = res.data.items;

    return members.map((member) => {
      // Find items for this specific member (either they own it or they are attendee)
      // Note: for MVP we just use owner_id. A full implementation would check relations.
      const memberItems = items.filter((item) => item.owner_id === member.id);

      let meetingsHours = 0;
      let focusHours = 0;
      let tasksHours = 0;
      let otherHours = 0;

      memberItems.forEach((item) => {
        const durationMin = item.duration_minutes || 60; // default 1h
        const durationHrs = durationMin / 60;

        if (item.item_type === 'meeting' || item.item_type === 'event') {
          meetingsHours += durationHrs;
        } else if (item.item_type === 'task') {
          tasksHours += durationHrs;
        } else if (item.item_type === 'block' && item.title.toLowerCase().includes('focus')) {
          focusHours += durationHrs;
        } else {
          otherHours += durationHrs;
        }
      });

      const scheduledHours = meetingsHours + focusHours + tasksHours + otherHours;
      const capacityHours = 40; // Default capacity per week, could be adjusted by DateRange
      const utilizationPercent = (scheduledHours / capacityHours) * 100;

      return {
        memberId: member.id,
        memberName: member.name,
        avatarUrl: member.avatarUrl,
        period: { start, end },
        scheduledHours,
        capacityHours,
        utilizationPercent,
        breakdown: {
          meetings: meetingsHours,
          focusTime: focusHours,
          tasks: tasksHours,
          other: otherHours,
        },
        trend: 'stable', // Real historical comparison would require another query
        trendPercent: 0,
      };
    });
  } catch (error) {
    console.error('Failed to fetch workload data:', error);
    return [];
  }
}

