'use client';

import { cn } from '@/lib/utils';

interface ResourceGaugeProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  className?: string;
}

export function ResourceGauge({
  label,
  value,
  max = 100,
  unit = '%',
  className,
}: ResourceGaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const getColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full transition-all duration-500', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
