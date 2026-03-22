'use client';

/**
 * Clock In Component
 *
 * Time tracking interface with check-in/check-out button,
 * current time display, status indicator, and work hours summary.
 */

import * as React from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  Check,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ClockInProps {
  isCheckedIn?: boolean;
  lastCheckIn?: Date;
  lastCheckOut?: Date;
  todayHours?: number;
  weeklyHours?: number;
  onCheckInOut?: (action: 'in' | 'out') => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}

export const ClockIn: React.FC<ClockInProps> = ({
  isCheckedIn = false,
  lastCheckIn,
  lastCheckOut,
  todayHours = 0,
  weeklyHours = 0,
  onCheckInOut,
  disabled = false,
  loading = false,
}) => {
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date());
  const [sessionHours, setSessionHours] = React.useState<number>(0);

  // Update current time every second
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate session hours when checked in
  React.useEffect(() => {
    if (isCheckedIn && lastCheckIn) {
      const checkInTime = new Date(lastCheckIn);
      const elapsed = currentTime.getTime() - checkInTime.getTime();
      const hours = elapsed / (1000 * 60 * 60);
      setSessionHours(hours);
    }
  }, [isCheckedIn, lastCheckIn, currentTime]);

  const handleCheckInOut = async () => {
    if (!onCheckInOut) return;

    try {
      await onCheckInOut(isCheckedIn ? 'out' : 'in');
    } catch (error) {
      console.error('Check in/out failed:', error);
    }
  };

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const todayHoursFormatted = formatHours(todayHours + sessionHours);
  const weeklyHoursFormatted = formatHours(weeklyHours + (isCheckedIn ? sessionHours : 0));

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Time Tracking
          </CardTitle>
          <Badge
            variant={isCheckedIn ? 'default' : 'secondary'}
            className={cn(
              'gap-1.5 px-3 py-1',
              isCheckedIn && 'bg-green-600 hover:bg-green-700',
              !isCheckedIn && 'bg-gray-400 hover:bg-gray-500'
            )}
          >
            {isCheckedIn ? (
              <>
                <Check className="size-3" />
                Checked In
              </>
            ) : (
              <>
                <AlertCircle className="size-3" />
                Checked Out
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Time Display */}
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold font-mono tracking-tight">
            {formattedTime}
          </div>
          <div className="text-sm text-muted-foreground">
            {formattedDate}
          </div>
        </div>

        {/* Last Action Info */}
        {(lastCheckIn || lastCheckOut) && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {lastCheckIn && (
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs uppercase tracking-wide">
                  Last Check-in
                </div>
                <div className="font-mono">
                  {new Date(lastCheckIn).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            )}
            {lastCheckOut && (
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs uppercase tracking-wide">
                  Last Check-out
                </div>
                <div className="font-mono">
                  {new Date(lastCheckOut).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Check-in/out Button */}
        <Button
          onClick={handleCheckInOut}
          disabled={disabled || loading}
          size="lg"
          className={cn(
            'w-full h-16 text-base font-semibold rounded-lg',
            isCheckedIn
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          )}
        >
          {loading ? (
            <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isCheckedIn ? (
            <>
              <LogOut className="size-5" />
              Check Out
            </>
          ) : (
            <>
              <LogIn className="size-5" />
              Check In
            </>
          )}
        </Button>

        {/* Hours Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-accent/50 p-4 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Today
            </div>
            <div className="text-2xl font-bold font-mono">
              {todayHoursFormatted}
            </div>
          </div>
          <div className="rounded-lg bg-accent/50 p-4 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              This Week
            </div>
            <div className="text-2xl font-bold font-mono">
              {weeklyHoursFormatted}
            </div>
          </div>
        </div>

        {/* Current Session Info */}
        {isCheckedIn && sessionHours > 0 && (
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            Current session: <span className="font-mono font-semibold text-foreground">{formatHours(sessionHours)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
