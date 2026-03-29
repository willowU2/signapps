'use client';

import React, { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPIData {
  id: string;
  title: string;
  value: string | number;
  unit?: string;
  trend: number; // positive or negative percentage
  sparkline: number[]; // array of values for mini chart
  period: 'week' | 'month' | 'quarter';
}

interface KPIDashboardProps {
  kpis?: KPIData[];
}

// Simple SVG sparkline component
const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
  if (data.length < 2) return null;

  const width = 100;
  const height = 40;
  const padding = 4;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = padding + (i / (data.length - 1)) * innerWidth;
      const y = padding + innerHeight - ((val - min) / range) * innerHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

// KPI Card component
const KPICard: React.FC<{ kpi: KPIData }> = ({ kpi }) => {
  const isPositive = kpi.trend >= 0;
  const trendColor = isPositive ? 'text-green-600' : 'text-red-600';
  const bgColor = isPositive ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className="bg-background rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header with title */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{kpi.title}</h3>
      </div>

      {/* Main value and unit */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">{kpi.value}</span>
          {kpi.unit && <span className="text-sm text-muted-foreground">{kpi.unit}</span>}
        </div>
      </div>

      {/* Sparkline chart */}
      <div className="mb-4 text-gray-400 h-10">
        <Sparkline data={kpi.sparkline} />
      </div>

      {/* Trend indicator */}
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${bgColor}`}>
        {isPositive ? (
          <TrendingUp className={`w-4 h-4 ${trendColor}`} />
        ) : (
          <TrendingDown className={`w-4 h-4 ${trendColor}`} />
        )}
        <span className={`text-sm font-semibold ${trendColor}`}>
          {isPositive ? '+' : ''}{kpi.trend}%
        </span>
      </div>
    </div>
  );
};

// Main dashboard component
export const KPIDashboard: React.FC<KPIDashboardProps> = ({
  kpis: customKpis,
}) => {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // Default sample KPIs
  const defaultKpis: KPIData[] = [
    {
      id: 'revenue',
      title: 'Revenue',
      value: '$48,250',
      unit: 'USD',
      trend: 12.5,
      sparkline: [42000, 45000, 43000, 47000, 49000, 48500, 48250],
      period: 'month',
    },
    {
      id: 'active-users',
      title: 'Active Users',
      value: '1,240',
      trend: 8.3,
      sparkline: [1100, 1150, 1180, 1200, 1220, 1235, 1240],
      period: 'month',
    },
    {
      id: 'tasks-completed',
      title: 'Tasks Completed',
      value: '3,480',
      trend: -2.1,
      sparkline: [3600, 3550, 3520, 3500, 3490, 3485, 3480],
      period: 'month',
    },
    {
      id: 'avg-response-time',
      title: 'Avg Response Time',
      value: '245',
      unit: 'ms',
      trend: -15.4,
      sparkline: [310, 295, 280, 265, 255, 250, 245],
      period: 'month',
    },
    {
      id: 'satisfaction',
      title: 'Satisfaction',
      value: '4.7',
      unit: 'out of 5',
      trend: 5.2,
      sparkline: [4.2, 4.3, 4.4, 4.5, 4.6, 4.65, 4.7],
      period: 'month',
    },
  ];

  const kpis = customKpis || defaultKpis;

  return (
    <div className="w-full space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">KPI Dashboard</h2>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-gray-200'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.id} kpi={kpi} />
        ))}
      </div>
    </div>
  );
};

export default KPIDashboard;
