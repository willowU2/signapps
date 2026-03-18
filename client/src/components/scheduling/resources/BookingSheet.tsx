'use client';

/**
 * BookingSheet Component
 *
 * Side sheet for creating resource bookings.
 */

import * as React from 'react';
import { format, addHours, setHours, setMinutes, startOfHour } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Building2,
  Calendar as CalendarIcon,
  Clock,
  Users,
  FileText,
  Repeat,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import type { Resource, Booking } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface BookingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  resource?: Resource | null;
  booking?: Booking | null;
  onSave: (booking: Partial<Booking>) => void;
  onDelete?: () => void;
  availableResources?: Resource[];
}

// ============================================================================
// Time Slots
// ============================================================================

const timeSlots = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return {
    value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
  };
});

// ============================================================================
// Main Component
// ============================================================================

export function BookingSheet({
  isOpen,
  onClose,
  resource,
  booking,
  onSave,
  onDelete,
  availableResources = [],
}: BookingSheetProps) {
  const isEditing = !!booking;

  // Form state
  const [title, setTitle] = React.useState('');
  const [selectedResourceId, setSelectedResourceId] = React.useState<string>('');
  const [date, setDate] = React.useState<Date>(new Date());
  const [startTime, setStartTime] = React.useState('09:00');
  const [endTime, setEndTime] = React.useState('10:00');
  const [purpose, setPurpose] = React.useState('');
  const [attendeesCount, setAttendeesCount] = React.useState<string>('');
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [recurrenceType, setRecurrenceType] = React.useState<'daily' | 'weekly'>('weekly');

  // Initialize form
  React.useEffect(() => {
    if (booking) {
      setTitle(booking.title);
      setSelectedResourceId(booking.resourceId);
      setDate(new Date(booking.start));
      setStartTime(format(new Date(booking.start), 'HH:mm'));
      setEndTime(booking.end ? format(new Date(booking.end), 'HH:mm') : '10:00');
      setPurpose(booking.purpose ?? '');
      setAttendeesCount(booking.attendees?.length?.toString() ?? '');
    } else {
      // Set defaults for new booking
      const now = new Date();
      const nextHour = startOfHour(addHours(now, 1));
      setTitle('');
      setSelectedResourceId(resource?.id ?? '');
      setDate(now);
      setStartTime(format(nextHour, 'HH:mm'));
      setEndTime(format(addHours(nextHour, 1), 'HH:mm'));
      setPurpose('');
      setAttendeesCount('');
      setIsRecurring(false);
    }
  }, [booking, resource, isOpen]);

  // Get selected resource
  const selectedResource =
    resource ??
    availableResources.find((r) => r.id === selectedResourceId);

  // Build date-time from date and time strings
  const buildDateTime = (date: Date, timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  };

  const handleSave = () => {
    if (!title.trim() || !selectedResourceId) return;

    const startDateTime = buildDateTime(date, startTime);
    const endDateTime = buildDateTime(date, endTime);

    onSave({
      title: title.trim(),
      resourceId: selectedResourceId,
      start: startDateTime,
      end: endDateTime,
      purpose: purpose.trim() || undefined,
      recurrence: isRecurring
        ? { frequency: recurrenceType, interval: 1 }
        : undefined,
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Modifier la réservation' : 'Nouvelle réservation'}
          </SheetTitle>
          <SheetDescription>
            {selectedResource
              ? `Réserver ${selectedResource.name}`
              : 'Sélectionnez une ressource à réserver'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titre de la réservation *</Label>
            <Input
              id="title"
              placeholder="Réunion d'équipe, Formation, etc."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Resource Selection */}
          {!resource && availableResources.length > 0 && (
            <div className="space-y-2">
              <Label>Ressource *</Label>
              <Select
                value={selectedResourceId}
                onValueChange={setSelectedResourceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une ressource" />
                </SelectTrigger>
                <SelectContent>
                  {availableResources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {r.name}
                        {r.location && (
                          <span className="text-muted-foreground">
                            - {r.location}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selected Resource Info */}
          {selectedResource && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-background">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{selectedResource.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedResource.location}
                    {selectedResource.capacity &&
                      ` • ${selectedResource.capacity} pers. max`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date
                    ? format(date, 'EEEE d MMMM yyyy', { locale: fr })
                    : 'Sélectionner une date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  locale={fr}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Début *</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fin *</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger>
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots
                    .filter((slot) => slot.value > startTime)
                    .map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Attendees Count */}
          <div className="space-y-2">
            <Label htmlFor="attendees">Nombre de participants</Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="attendees"
                type="number"
                placeholder="Ex: 10"
                value={attendeesCount}
                onChange={(e) => setAttendeesCount(e.target.value)}
                className="pl-9"
                min={1}
                max={selectedResource?.capacity}
              />
            </div>
            {selectedResource?.capacity && (
              <p className="text-xs text-muted-foreground">
                Capacité max: {selectedResource.capacity} personnes
              </p>
            )}
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <Label htmlFor="purpose">Objet de la réservation</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="purpose"
                placeholder="Décrivez l'objet de cette réservation..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="pl-9 min-h-[80px]"
              />
            </div>
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Repeat className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Récurrence</p>
                <p className="text-xs text-muted-foreground">
                  Répéter cette réservation
                </p>
              </div>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {isRecurring && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <Label>Fréquence</Label>
              <Select
                value={recurrenceType}
                onValueChange={(v) => setRecurrenceType(v as 'daily' | 'weekly')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Tous les jours</SelectItem>
                  <SelectItem value="weekly">Toutes les semaines</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          {isEditing && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              className="mr-auto"
            >
              Annuler la réservation
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || !selectedResourceId}
          >
            {isEditing ? 'Modifier' : 'Réserver'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default BookingSheet;
