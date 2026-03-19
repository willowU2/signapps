'use client';

/**
 * EventSheet Component
 *
 * Side sheet for creating and editing calendar events.
 * Full form with all event fields including recurrence.
 */

import * as React from 'react';
import { format, addHours, startOfHour, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Repeat,
  Bell,
  Palette,
  Link2,
  FileText,
  Trash2,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type {
  ScheduleBlock,
  CreateEventInput,
  RecurrenceRule,
  Attendee,
  EventTemplate,
} from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface EventSheetProps {
  isOpen: boolean;
  onClose: () => void;
  event?: ScheduleBlock | null;
  defaultDate?: Date;
  defaultTime?: string;
  templates?: EventTemplate[];
  onSave: (event: CreateEventInput) => void;
  onDelete?: () => void;
}

// ============================================================================
// Time Slots
// ============================================================================

const timeSlots = Array.from({ length: 24 * 4 }, (_, i) => {
  const hour = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  return {
    value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
  };
});

// ============================================================================
// Duration Options
// ============================================================================

const durationOptions = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 heure' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2 heures' },
  { value: 180, label: '3 heures' },
  { value: 240, label: '4 heures' },
  { value: 480, label: 'Journée entière' },
];

// ============================================================================
// Color Options
// ============================================================================

const colorOptions = [
  { value: 'blue', label: 'Bleu', class: 'bg-blue-500' },
  { value: 'green', label: 'Vert', class: 'bg-green-500' },
  { value: 'red', label: 'Rouge', class: 'bg-red-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'purple', label: 'Violet', class: 'bg-purple-500' },
  { value: 'pink', label: 'Rose', class: 'bg-pink-500' },
  { value: 'yellow', label: 'Jaune', class: 'bg-yellow-500' },
  { value: 'teal', label: 'Turquoise', class: 'bg-teal-500' },
];

// ============================================================================
// Reminder Options
// ============================================================================

const reminderOptions = [
  { value: 0, label: 'Au moment de l\'événement' },
  { value: 5, label: '5 minutes avant' },
  { value: 10, label: '10 minutes avant' },
  { value: 15, label: '15 minutes avant' },
  { value: 30, label: '30 minutes avant' },
  { value: 60, label: '1 heure avant' },
  { value: 1440, label: '1 jour avant' },
];

// ============================================================================
// Recurrence Options
// ============================================================================

const recurrenceOptions: { value: RecurrenceRule['frequency'] | 'none'; label: string }[] = [
  { value: 'none', label: 'Ne pas répéter' },
  { value: 'daily', label: 'Tous les jours' },
  { value: 'weekly', label: 'Toutes les semaines' },
  { value: 'monthly', label: 'Tous les mois' },
  { value: 'yearly', label: 'Tous les ans' },
];

// ============================================================================
// Main Component
// ============================================================================

export function EventSheet({
  isOpen,
  onClose,
  event,
  defaultDate,
  defaultTime,
  templates = [],
  onSave,
  onDelete,
}: EventSheetProps) {
  const isEditing = !!event;

  // Form state
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [date, setDate] = React.useState<Date>(new Date());
  const [startTime, setStartTime] = React.useState('09:00');
  const [duration, setDuration] = React.useState(60);
  const [isAllDay, setIsAllDay] = React.useState(false);
  const [color, setColor] = React.useState('blue');
  const [reminder, setReminder] = React.useState(15);
  const [recurrence, setRecurrence] = React.useState<RecurrenceRule['frequency'] | 'none'>('none');
  const [attendeeEmails, setAttendeeEmails] = React.useState<string[]>([]);
  const [newAttendee, setNewAttendee] = React.useState('');
  const [meetingUrl, setMeetingUrl] = React.useState('');
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');

  // Apply template to form
  const applyTemplate = React.useCallback((template: EventTemplate) => {
    const defaults = template.eventDefaults;
    if (defaults.title) setTitle(defaults.title);
    if (defaults.description) setDescription(defaults.description);
    if (defaults.location) setLocation(defaults.location);
    if (defaults.duration) setDuration(defaults.duration);
    if (defaults.allDay !== undefined) setIsAllDay(defaults.allDay);
    if (defaults.color) setColor(defaults.color);
    if (defaults.reminderMinutes !== undefined) setReminder(defaults.reminderMinutes);
    if (defaults.recurrence) setRecurrence(defaults.recurrence.frequency);
    if (defaults.attendees) setAttendeeEmails(defaults.attendees);
  }, []);

  // Handle template selection
  const handleTemplateChange = React.useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId && templateId !== 'none') {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        applyTemplate(template);
      }
    }
  }, [templates, applyTemplate]);

  // Initialize form when event changes
  React.useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? '');
      setLocation(event.location?.name ?? '');
      setMeetingUrl(event.location?.meetingUrl ?? '');
      setDate(new Date(event.start));
      setStartTime(format(new Date(event.start), 'HH:mm'));
      if (event.end) {
        const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime();
        setDuration(Math.round(durationMs / 60000));
      }
      setIsAllDay(event.allDay);
      setColor(event.color ?? 'blue');
      setReminder(event.reminderMinutes ?? 15);
      setAttendeeEmails(event.attendees?.map((a) => a.email) ?? []);
      setSelectedTemplateId(event.templateId ?? '');
    } else {
      // Reset form for new event
      const now = new Date();
      const nextHour = startOfHour(addHours(now, 1));
      setTitle('');
      setDescription('');
      setLocation('');
      setDate(defaultDate ?? now);
      setStartTime(defaultTime ?? format(nextHour, 'HH:mm'));
      setDuration(60);
      setIsAllDay(false);
      setColor('blue');
      setReminder(15);
      setRecurrence('none');
      setAttendeeEmails([]);
      setNewAttendee('');
      setMeetingUrl('');
      setShowAdvanced(false);
      setSelectedTemplateId('');
    }
  }, [event, defaultDate, defaultTime, isOpen]);

  // Build date-time from date and time strings
  const buildDateTime = (dateVal: Date, timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const result = new Date(dateVal);
    result.setHours(hours, minutes, 0, 0);
    return result;
  };

  // Add attendee
  const handleAddAttendee = () => {
    const email = newAttendee.trim().toLowerCase();
    if (email && !attendeeEmails.includes(email) && email.includes('@')) {
      setAttendeeEmails([...attendeeEmails, email]);
      setNewAttendee('');
    }
  };

  // Remove attendee
  const handleRemoveAttendee = (email: string) => {
    setAttendeeEmails(attendeeEmails.filter((e) => e !== email));
  };

  // Handle save
  const handleSave = () => {
    if (!title.trim()) return;

    const startDateTime = isAllDay
      ? new Date(date.setHours(0, 0, 0, 0))
      : buildDateTime(date, startTime);
    const endDateTime = isAllDay
      ? new Date(date.setHours(23, 59, 59, 999))
      : new Date(startDateTime.getTime() + duration * 60000);

    const eventData: CreateEventInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      start: startDateTime,
      end: endDateTime,
      allDay: isAllDay,
      // calendarId will be set by the parent component with a valid value
      attendees: attendeeEmails,
      color,
      recurrence:
        recurrence !== 'none'
          ? { frequency: recurrence, interval: 1 }
          : undefined,
      location: location.trim() ? { name: location.trim(), meetingUrl: meetingUrl.trim() || undefined } : undefined,
      reminderMinutes: reminder > 0 ? reminder : undefined,
      templateId: selectedTemplateId && selectedTemplateId !== 'none' ? selectedTemplateId : undefined,
    };

    onSave(eventData);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Modifier l\'événement' : 'Nouvel événement'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Modifiez les détails de cet événement.'
              : 'Créez un nouvel événement dans votre calendrier.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Template Selector (only for new events) */}
          {!isEditing && templates.length > 0 && (
            <div className="space-y-2">
              <Label>Utiliser un modèle</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un modèle (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun modèle</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        {template.eventDefaults.color && (
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: template.eventDefaults.color }}
                          />
                        )}
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              placeholder="Ajouter un titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="text-lg font-medium"
            />
          </div>

          {/* Date & Time */}
          <div className="space-y-4">
            {/* All Day Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="all-day" className="flex items-center gap-2 cursor-pointer">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Journée entière
              </Label>
              <Switch
                id="all-day"
                checked={isAllDay}
                onCheckedChange={setIsAllDay}
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Date</Label>
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
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time & Duration (if not all day) */}
            {!isAllDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Heure de début</Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="h-[300px]">
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot.value} value={slot.value}>
                          {slot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Durée</Label>
                  <Select
                    value={duration.toString()}
                    onValueChange={(v) => setDuration(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Lieu</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                placeholder="Ajouter un lieu ou un lien de visio"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label>Participants</Label>
            {attendeeEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attendeeEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ajouter un participant (email)"
                  value={newAttendee}
                  onChange={(e) => setNewAttendee(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && (e.preventDefault(), handleAddAttendee())
                  }
                  className="pl-9"
                />
              </div>
              <Button type="button" variant="outline" size="icon" onClick={handleAddAttendee}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="description"
                placeholder="Ajouter une description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="pl-9 min-h-[100px]"
              />
            </div>
          </div>

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start">
                {showAdvanced ? 'Masquer' : 'Afficher'} les options avancées
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* Color */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  Couleur
                </Label>
                <div className="flex gap-2">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={cn(
                        'w-8 h-8 rounded-full transition-all',
                        opt.class,
                        color === opt.value
                          ? 'ring-2 ring-offset-2 ring-primary'
                          : 'hover:scale-110'
                      )}
                      onClick={() => setColor(opt.value)}
                      title={opt.label}
                    />
                  ))}
                </div>
              </div>

              {/* Reminder */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Rappel
                </Label>
                <Select
                  value={reminder.toString()}
                  onValueChange={(v) => setReminder(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recurrence */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  Récurrence
                </Label>
                <Select
                  value={recurrence}
                  onValueChange={(v) =>
                    setRecurrence(v as RecurrenceRule['frequency'] | 'none')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {recurrenceOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Meeting URL */}
              <div className="space-y-2">
                <Label htmlFor="meeting-url" className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  Lien de visioconférence
                </Label>
                <Input
                  id="meeting-url"
                  placeholder="https://meet.example.com/..."
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <SheetFooter className="gap-2">
          {isEditing && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSave} disabled={!title.trim()}>
            {isEditing ? 'Enregistrer' : 'Créer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default EventSheet;
