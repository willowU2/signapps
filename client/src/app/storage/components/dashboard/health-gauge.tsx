'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HealthGaugeProps {
  value: number; // 0-100
  label: string;
  status?: 'healthy' | 'warning' | 'critical';
}

export function HealthGauge({ value, label, status = 'healthy' }: HealthGaugeProps) {
  const getColor = () => {
    if (status === 'critical' || value < 30) return '#ef4444'; // red
    if (status === 'warning' || value < 60) return '#eab308'; // yellow
    return '#22c55e'; // green
  };

  const color = getColor();
  const circumference = 2 * Math.PI * 16; // radius = 16
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center pb-6">
        <div className="relative h-32 w-32">
          <svg
            className="h-32 w-32 -rotate-90"
            viewBox="0 0 36 36"
          >
            {/* Background circle */}
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              className="text-muted"
              strokeWidth="2"
            />
            {/* Progress circle */}
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{value}</span>
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
