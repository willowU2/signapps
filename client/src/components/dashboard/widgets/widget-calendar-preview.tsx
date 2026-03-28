'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface WidgetProps {
  widget: { config: Record<string, unknown> };
  isEditing: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  time: string;
  color: string;
}

function generateWeekEvents(weekStart: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const titles = [
    'Reunion equipe', 'Point projet', 'Sprint review', 'Formation',
    'Demo client', 'Comite pilotage', 'Retro', 'Stand-up',
    'Atelier design', 'Revue de code',
  ];
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
  const times = ['09:00', '10:30', '14:00', '15:30', '11:00', '16:00'];

  for (let d = 0; d < 7; d++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + d);
    // 0-2 events per day, more on weekdays
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
    const count = isWeekend ? Math.floor(Math.random() * 1.5) : Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      events.push({
        id: `evt-${d}-${i}`,
        title: titles[Math.floor(Math.random() * titles.length)],
        date: new Date(dayDate),
        time: times[Math.floor(Math.random() * times.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time));
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + 1); // Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

export function WidgetCalendarPreview({ widget, isEditing }: WidgetProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const d = getWeekStart(new Date());
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const events = useMemo(() => generateWeekEvents(weekStart), [weekStart]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Calendrier
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setWeekOffset((o) => o - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-1.5"
              onClick={() => setWeekOffset(0)}
            >
              Aujourd&apos;hui
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setWeekOffset((o) => o + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Mini day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((d, i) => {
            const isToday = d.getTime() === today.getTime();
            return (
              <div key={i} className="text-center">
                <p className="text-[10px] text-muted-foreground">{DAYS[(i + 1) % 7]}</p>
                <p className={`text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center mx-auto ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                  {d.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Events list */}
        <div className="space-y-1.5 mt-3 max-h-[160px] overflow-y-auto">
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Aucun evenement cette semaine</p>
          )}
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-2 text-xs"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${event.color} shrink-0`} />
              <span className="text-muted-foreground shrink-0">
                {DAYS[event.date.getDay()]} {event.time}
              </span>
              <span className="truncate">{event.title}</span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex justify-between items-center mt-3 pt-2 border-t">
          <span className="text-[10px] text-muted-foreground">
            Semaine du {weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
          <Badge variant="secondary" className="text-[10px]">{events.length} evenements</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
