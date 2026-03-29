/**
 * Analytics Dashboard Component
 *
 * Time usage statistics with breakdown charts, comparisons,
 * and actionable insights.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Clock,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Lightbulb,
  AlertTriangle,
  Info,
  Download,
  ChevronRight,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  differenceInMinutes,
  eachDayOfInterval,
  getDay,
  addDays,
  subWeeks,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type {
  ScheduleBlock,
  TimeAnalytics,
  AnalyticsInsight,
  DateRange,
} from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsDashboardProps {
  events: ScheduleBlock[];
  period?: '7d' | '14d' | '30d';
  onPeriodChange?: (period: '7d' | '14d' | '30d') => void;
  onExport?: () => void;
  className?: string;
}

interface TimeBreakdown {
  category: string;
  hours: number;
  percent: number;
  color: string;
}

interface DayStats {
  date: Date;
  hours: number;
  meetings: number;
  focus: number;
  tasks: number;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_COLORS = {
  meetings: { bg: 'bg-blue-500', text: 'text-blue-500', hex: '#3b82f6' },
  focus: { bg: 'bg-green-500', text: 'text-green-500', hex: '#22c55e' },
  tasks: { bg: 'bg-purple-500', text: 'text-purple-500', hex: '#a855f7' },
  breaks: { bg: 'bg-amber-500', text: 'text-amber-500', hex: '#f59e0b' },
  other: { bg: 'bg-gray-400', text: 'text-gray-400', hex: '#9ca3af' },
};

const CATEGORY_LABELS: Record<string, string> = {
  meetings: 'R\éunions',
  focus: 'Temps de focus',
  tasks: 'T\âches',
  breaks: 'Pauses',
  other: 'Autre',
};

// ============================================================================
// Main Component
// ============================================================================

export function AnalyticsDashboard({
  events,
  period = '7d',
  onPeriodChange,
  onExport,
  className,
}: AnalyticsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = React.useState(period);

  // Compute date range
  const dateRange = React.useMemo((): DateRange => {
    const now = new Date();
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '14d' ? 14 : 30;
    return {
      start: addDays(now, -days),
      end: now,
    };
  }, [selectedPeriod]);

  // Compute previous period for comparison
  const previousRange = React.useMemo((): DateRange => {
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '14d' ? 14 : 30;
    return {
      start: addDays(dateRange.start, -days),
      end: dateRange.start,
    };
  }, [dateRange, selectedPeriod]);

  // Analyze current period
  const analytics = React.useMemo(
    () => analyzeTimeUsage(events, dateRange),
    [events, dateRange]
  );

  // Analyze previous period for comparison
  const previousAnalytics = React.useMemo(
    () => analyzeTimeUsage(events, previousRange),
    [events, previousRange]
  );

  // Daily stats for chart
  const dailyStats = React.useMemo(
    () => computeDailyStats(events, dateRange),
    [events, dateRange]
  );

  // Generate insights
  const insights = React.useMemo(
    () => generateInsights(analytics, previousAnalytics, events),
    [analytics, previousAnalytics, events]
  );

  // Handle period change
  const handlePeriodChange = (value: '7d' | '14d' | '30d') => {
    setSelectedPeriod(value);
    onPeriodChange?.(value);
  };

  // Compute comparison
  const comparison = React.useMemo(() => {
    if (previousAnalytics.totalHours === 0) return null;
    const changePercent =
      ((analytics.totalHours - previousAnalytics.totalHours) / previousAnalytics.totalHours) *
      100;
    return { changePercent, trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'stable' };
  }, [analytics, previousAnalytics]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Statistiques</h2>
          <p className="text-sm text-muted-foreground">
            {format(dateRange.start, 'd MMM', { locale: fr })} -{' '}
            {format(dateRange.end, 'd MMM yyyy', { locale: fr })}
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
          title="Temps total"
          value={`${Math.round(analytics.totalHours)}h`}
          icon={Clock}
          comparison={comparison}
          description={`${Math.round(analytics.totalHours / (selectedPeriod === '7d' ? 7 : selectedPeriod === '14d' ? 14 : 30))}h/jour en moyenne`}
        />
        <SummaryCard
          title="R\éunions"
          value={`${Math.round(analytics.breakdown.find((b) => b.category === 'meetings')?.hours || 0)}h`}
          icon={Users}
          color={CATEGORY_COLORS.meetings.text}
          description={`${analytics.breakdown.find((b) => b.category === 'meetings')?.percent.toFixed(0) || 0}% du temps`}
        />
        <SummaryCard
          title="Temps de focus"
          value={`${Math.round(analytics.breakdown.find((b) => b.category === 'focus')?.hours || 0)}h`}
          icon={Target}
          color={CATEGORY_COLORS.focus.text}
          description={`${analytics.breakdown.find((b) => b.category === 'focus')?.percent.toFixed(0) || 0}% du temps`}
        />
        <SummaryCard
          title="T\âches"
          value={`${Math.round(analytics.breakdown.find((b) => b.category === 'tasks')?.hours || 0)}h`}
          icon={Calendar}
          color={CATEGORY_COLORS.tasks.text}
          description={`${analytics.breakdown.find((b) => b.category === 'tasks')?.percent.toFixed(0) || 0}% du temps`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">R\épartition du temps</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownChart breakdown={analytics.breakdown} />
          </CardContent>
        </Card>

        {/* Daily Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">\Évolution quotidienne</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyChart stats={dailyStats} />
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">D\étail par jour</CardTitle>
        </CardHeader>
        <CardContent>
          <DayBreakdownTable stats={dailyStats} />
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
  color?: string;
  description: string;
  comparison?: { changePercent: number; trend: string } | null;
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
  description,
  comparison,
}: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className={cn('h-4 w-4', color || 'text-muted-foreground')} />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className={cn('text-2xl font-bold', color)}>{value}</span>
          {comparison && (
            <span
              className={cn(
                'text-xs font-medium flex items-center',
                comparison.trend === 'up'
                  ? 'text-green-500'
                  : comparison.trend === 'down'
                    ? 'text-red-500'
                    : 'text-muted-foreground'
              )}
            >
              {comparison.trend === 'up' ? (
                <TrendingUp className="h-3 w-3 mr-0.5" />
              ) : comparison.trend === 'down' ? (
                <TrendingDown className="h-3 w-3 mr-0.5" />
              ) : (
                <Minus className="h-3 w-3 mr-0.5" />
              )}
              {Math.abs(comparison.changePercent).toFixed(0)}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Breakdown Chart (Donut)
// ============================================================================

interface BreakdownChartProps {
  breakdown: TimeBreakdown[];
}

function BreakdownChart({ breakdown }: BreakdownChartProps) {
  const total = breakdown.reduce((sum, b) => sum + b.hours, 0);
  if (total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        Aucune donn\ée
      </div>
    );
  }

  // Calculate SVG paths for donut chart
  const size = 160;
  const strokeWidth = 30;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const segments = breakdown
    .filter((b) => b.hours > 0)
    .map((b) => {
      const percent = b.hours / total;
      const dashLength = percent * circumference;
      const segment = {
        ...b,
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset: -currentOffset,
      };
      currentOffset += dashLength;
      return segment;
    });

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {segments.map((segment, i) => (
            <circle
              key={segment.category}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              className="transition-all duration-500"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold">{Math.round(total)}h</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {breakdown.filter((b) => b.hours > 0).map((b) => (
          <div key={b.category} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            <span className="text-muted-foreground">
              {CATEGORY_LABELS[b.category] || b.category}
            </span>
            <span className="font-medium ml-auto">{Math.round(b.hours)}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Daily Chart (Bar)
// ============================================================================

interface DailyChartProps {
  stats: DayStats[];
}

function DailyChart({ stats }: DailyChartProps) {
  const maxHours = Math.max(...stats.map((s) => s.hours), 8);

  return (
    <div className="h-48">
      <div className="flex items-end h-full gap-1">
        {stats.map((day, i) => {
          const heightPercent = (day.hours / maxHours) * 100;
          const isWeekend = getDay(day.date) === 0 || getDay(day.date) === 6;

          return (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full relative"
                      style={{ height: `${Math.max(heightPercent, 5)}%` }}
                    >
                      {/* Stacked bar */}
                      <div className="absolute inset-x-0 bottom-0 flex flex-col">
                        {day.meetings > 0 && (
                          <div
                            className={cn('w-full', CATEGORY_COLORS.meetings.bg)}
                            style={{
                              height: `${(day.meetings / day.hours) * 100}%`,
                              minHeight: '2px',
                            }}
                          />
                        )}
                        {day.focus > 0 && (
                          <div
                            className={cn('w-full', CATEGORY_COLORS.focus.bg)}
                            style={{
                              height: `${(day.focus / day.hours) * 100}%`,
                              minHeight: '2px',
                            }}
                          />
                        )}
                        {day.tasks > 0 && (
                          <div
                            className={cn('w-full', CATEGORY_COLORS.tasks.bg)}
                            style={{
                              height: `${(day.tasks / day.hours) * 100}%`,
                              minHeight: '2px',
                            }}
                          />
                        )}
                        {day.hours === 0 && (
                          <div className="w-full h-full bg-muted rounded-t" />
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-xs mt-2',
                        isWeekend ? 'text-muted-foreground/50' : 'text-muted-foreground'
                      )}
                    >
                      {format(day.date, 'EEE', { locale: fr })}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <div className="font-medium">{format(day.date, 'EEEE d MMMM', { locale: fr })}</div>
                    <div className="text-muted-foreground">
                      {day.hours > 0 ? `${day.hours.toFixed(1)}h total` : 'Aucune activit\é'}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Insight Card
// ============================================================================

interface InsightCardProps {
  insight: AnalyticsInsight;
}

function InsightCard({ insight }: InsightCardProps) {
  const IconComponent =
    insight.type === 'warning'
      ? AlertTriangle
      : insight.type === 'suggestion'
        ? Lightbulb
        : Info;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg',
        insight.type === 'warning'
          ? 'bg-destructive/10'
          : insight.type === 'suggestion'
            ? 'bg-yellow-500/10'
            : 'bg-muted/50'
      )}
    >
      <IconComponent
        className={cn(
          'h-5 w-5 mt-0.5',
          insight.type === 'warning'
            ? 'text-destructive'
            : insight.type === 'suggestion'
              ? 'text-yellow-500'
              : 'text-blue-500'
        )}
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm">{insight.title}</h4>
        <p className="text-sm text-muted-foreground mt-0.5">{insight.description}</p>
        {insight.metric && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {insight.metric.value} {insight.metric.unit}
              {insight.metric.trend && (
                <>
                  {insight.metric.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 ml-1 text-green-500" />
                  ) : insight.metric.trend === 'down' ? (
                    <TrendingDown className="h-3 w-3 ml-1 text-red-500" />
                  ) : null}
                </>
              )}
            </Badge>
          </div>
        )}
      </div>
      {insight.action && (
        <Button variant="ghost" size="sm" onClick={insight.action}>
          {insight.actionLabel || 'Agir'}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Day Breakdown Table
// ============================================================================

interface DayBreakdownTableProps {
  stats: DayStats[];
}

function DayBreakdownTable({ stats }: DayBreakdownTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium">Jour</th>
            <th className="text-right py-2 font-medium">Total</th>
            <th className="text-right py-2 font-medium text-blue-500">R\éunions</th>
            <th className="text-right py-2 font-medium text-green-500">Focus</th>
            <th className="text-right py-2 font-medium text-purple-500">T\âches</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((day, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2">{format(day.date, 'EEEE d MMM', { locale: fr })}</td>
              <td className="text-right py-2 font-medium">{day.hours.toFixed(1)}h</td>
              <td className="text-right py-2 text-blue-500">{day.meetings.toFixed(1)}h</td>
              <td className="text-right py-2 text-green-500">{day.focus.toFixed(1)}h</td>
              <td className="text-right py-2 text-purple-500">{day.tasks.toFixed(1)}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Analysis Functions
// ============================================================================

function analyzeTimeUsage(events: ScheduleBlock[], range: DateRange): TimeAnalytics {
  const periodEvents = events.filter(
    (e) => e.start >= range.start && e.start <= range.end
  );

  let meetingMinutes = 0;
  let focusMinutes = 0;
  let taskMinutes = 0;
  let otherMinutes = 0;

  periodEvents.forEach((event) => {
    const duration = event.end
      ? differenceInMinutes(event.end, event.start)
      : 60;

    if (event.type === 'task') {
      taskMinutes += duration;
    } else if (event.title.toLowerCase().includes('focus') || event.color === '#22c55e') {
      focusMinutes += duration;
    } else if (event.attendees && event.attendees.length > 0) {
      meetingMinutes += duration;
    } else {
      meetingMinutes += duration; // Default events to meetings
    }
  });

  const totalMinutes = meetingMinutes + focusMinutes + taskMinutes + otherMinutes;
  const totalHours = totalMinutes / 60;

  const breakdown: TimeBreakdown[] = [
    {
      category: 'meetings',
      hours: meetingMinutes / 60,
      percent: totalMinutes > 0 ? (meetingMinutes / totalMinutes) * 100 : 0,
      color: CATEGORY_COLORS.meetings.hex,
    },
    {
      category: 'focus',
      hours: focusMinutes / 60,
      percent: totalMinutes > 0 ? (focusMinutes / totalMinutes) * 100 : 0,
      color: CATEGORY_COLORS.focus.hex,
    },
    {
      category: 'tasks',
      hours: taskMinutes / 60,
      percent: totalMinutes > 0 ? (taskMinutes / totalMinutes) * 100 : 0,
      color: CATEGORY_COLORS.tasks.hex,
    },
  ];

  return {
    period: range,
    totalHours,
    breakdown,
    insights: [],
  };
}

function computeDailyStats(events: ScheduleBlock[], range: DateRange): DayStats[] {
  const days = eachDayOfInterval(range);

  return days.map((date) => {
    const dayEvents = events.filter(
      (e) =>
        format(e.start, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );

    let meetings = 0;
    let focus = 0;
    let tasks = 0;

    dayEvents.forEach((event) => {
      const hours = event.end
        ? differenceInMinutes(event.end, event.start) / 60
        : 1;

      if (event.type === 'task') {
        tasks += hours;
      } else if (event.title.toLowerCase().includes('focus')) {
        focus += hours;
      } else {
        meetings += hours;
      }
    });

    return {
      date,
      hours: meetings + focus + tasks,
      meetings,
      focus,
      tasks,
    };
  });
}

function generateInsights(
  current: TimeAnalytics,
  previous: TimeAnalytics,
  events: ScheduleBlock[]
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  // Check meeting ratio
  const meetingPercent = current.breakdown.find((b) => b.category === 'meetings')?.percent || 0;
  if (meetingPercent > 60) {
    insights.push({
      id: 'high-meetings',
      type: 'warning',
      title: 'Beaucoup de r\éunions',
      description: `Les r\éunions repr\ésentent ${meetingPercent.toFixed(0)}% de votre temps. Envisagez de bloquer des cr\éneaux de focus.`,
      metric: {
        value: meetingPercent,
        unit: '%',
      },
    });
  }

  // Check focus time
  const focusPercent = current.breakdown.find((b) => b.category === 'focus')?.percent || 0;
  if (focusPercent < 20 && current.totalHours > 20) {
    insights.push({
      id: 'low-focus',
      type: 'suggestion',
      title: 'Peu de temps de focus',
      description: 'Vous pourriez b\én\éficier de plus de blocs de temps pour le travail concentr\é.',
      metric: {
        value: focusPercent,
        unit: '%',
      },
    });
  }

  // Check trend
  if (previous.totalHours > 0) {
    const change = ((current.totalHours - previous.totalHours) / previous.totalHours) * 100;
    if (change > 20) {
      insights.push({
        id: 'increasing-load',
        type: 'warning',
        title: 'Charge en hausse',
        description: `Votre charge a augment\é de ${change.toFixed(0)}% par rapport \à la p\ériode pr\éc\édente.`,
        metric: {
          value: Math.round(change),
          unit: '%',
          trend: 'up',
        },
      });
    } else if (change < -20) {
      insights.push({
        id: 'decreasing-load',
        type: 'info',
        title: 'Charge en baisse',
        description: `Votre charge a diminu\é de ${Math.abs(change).toFixed(0)}% par rapport \à la p\ériode pr\éc\édente.`,
        metric: {
          value: Math.round(Math.abs(change)),
          unit: '%',
          trend: 'down',
        },
      });
    }
  }

  return insights;
}

// ============================================================================
// Exports
// ============================================================================

export { analyzeTimeUsage, computeDailyStats, generateInsights };
