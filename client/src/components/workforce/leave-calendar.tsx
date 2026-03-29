'use client';

/**
 * Leave Calendar Component
 *
 * Monthly calendar view showing employee absence with colored bars per person.
 * Each employee appears as a row, with days as columns. Absences are highlighted
 * by leave type with distinct colors.
 */

import * as React from 'react';
import { format, getDaysInMonth, startOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type LeaveType = 'CP' | 'RTT' | 'Maladie' | 'Sans solde';

export interface LeaveEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string; // ISO date
  endDate: string;
}

export interface LeaveCalendarProps {
  leaves?: LeaveEntry[];
  month?: Date;
  onMonthChange?: (date: Date) => void;
  className?: string;
}

const LEAVE_COLORS: Record<LeaveType, { bg: string; text: string; label: string }> = {
  'CP': {
    bg: 'bg-green-100 dark:bg-green-950',
    text: 'text-green-700 dark:text-green-200',
    label: 'CP',
  },
  'RTT': {
    bg: 'bg-blue-100 dark:bg-blue-950',
    text: 'text-blue-700 dark:text-blue-200',
    label: 'RTT',
  },
  'Maladie': {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-700 dark:text-red-200',
    label: 'Sick',
  },
  'Sans solde': {
    bg: 'bg-muted dark:bg-gray-800',
    text: 'text-muted-foreground dark:text-gray-200',
    label: 'Unpaid',
  },
};

export function LeaveCalendar({
  leaves = [],
  month = new Date(),
  onMonthChange,
  className,
}: LeaveCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(month);

  const handlePrevMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentMonth(prev);
    onMonthChange?.(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonth(next);
    onMonthChange?.(next);
  };

  // Get month info
  const monthStart = startOfMonth(currentMonth);
  const daysInMonth = getDaysInMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Get unique employees from leaves (sorted)
  const employees = Array.from(
    new Map(
      leaves.map((l) => [l.employeeId, { id: l.employeeId, name: l.employeeName }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Check if employee has leave on a specific day
  const getLeaveOnDay = (employeeId: string, day: number): LeaveEntry | undefined => {
    const dateStr = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day), 'yyyy-MM-dd');
    return leaves.find(
      (l) =>
        l.employeeId === employeeId &&
        isWithinInterval(parseISO(dateStr), {
          start: parseISO(l.startDate),
          end: parseISO(l.endDate),
        })
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with month navigation */}
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy', { locale: undefined })}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(LEAVE_COLORS).map(([type, config]) => (
          <div key={type} className="flex items-center gap-2">
            <div className={cn('h-4 w-4 rounded', config.bg)} />
            <span className="text-sm font-medium">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full border rounded-lg">
          {/* Days header */}
          <div className="grid gap-px bg-gray-200 dark:bg-gray-700">
            <div className="grid grid-cols-[120px_repeat(31,_1fr)] gap-px">
              <div className="bg-muted p-2 dark:bg-gray-800">
                <span className="text-xs font-semibold">Employee</span>
              </div>
              {days.map((day) => (
                <div
                  key={day}
                  className="bg-muted p-1 text-center dark:bg-gray-800"
                >
                  <div className="text-xs font-semibold">{day}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day),
                      'EEE'
                    ).substring(0, 1)}
                  </div>
                </div>
              ))}
            </div>

            {/* Employee rows */}
            {employees.length === 0 ? (
              <div className="grid grid-cols-[120px_repeat(31,_1fr)] gap-px">
                <div className="col-span-full bg-card p-4 text-center text-sm text-muted-foreground dark:bg-gray-900">
                  No leave records
                </div>
              </div>
            ) : (
              employees.map((emp) => (
                <div key={emp.id} className="grid grid-cols-[120px_repeat(31,_1fr)] gap-px">
                  <div className="bg-card p-2 dark:bg-gray-900">
                    <span className="truncate text-xs font-medium">{emp.name}</span>
                  </div>
                  {days.map((day) => {
                    const leave = getLeaveOnDay(emp.id, day);
                    const config = leave ? LEAVE_COLORS[leave.leaveType] : null;

                    return (
                      <div
                        key={`${emp.id}-${day}`}
                        className={cn(
                          'min-h-12 p-0.5 flex items-center justify-center border-r border-b bg-card dark:bg-gray-900',
                          config && cn(config.bg, config.text)
                        )}
                        title={leave ? `${leave.leaveType}` : undefined}
                      >
                        {leave && (
                          <span className="text-xs font-bold">
                            {config?.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="rounded-lg bg-muted p-4 dark:bg-gray-900">
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Showing <span className="font-semibold">{employees.length}</span> employee(s) with{' '}
          <span className="font-semibold">{leaves.length}</span> leave request(s)
        </p>
      </div>
    </div>
  );
}
