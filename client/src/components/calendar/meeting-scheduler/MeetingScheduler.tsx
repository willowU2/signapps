'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * Meeting Scheduler Component
 *
 * Full-featured meeting scheduling interface combining participant selection,
 * availability calendar, and slot selection.
 */

import * as React from 'react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Users, Clock, Settings2, CalendarRange, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { SlotSelector, SlotSelectorCompact } from './SlotSelector';
import {
  useAvailabilityFinder,
  type UseAvailabilityFinderOptions,
} from '@/lib/scheduling/hooks/use-availability-finder';
import type { CommonSlot } from '@/lib/scheduling/utils/availability-finder';
import type { TeamMember } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface MeetingSchedulerProps {
  /** Whether the scheduler is open */
  open: boolean;
  /** Callback when the scheduler closes */
  onOpenChange: (open: boolean) => void;
  /** Available team members to select from */
  teamMembers: TeamMember[];
  /** Pre-selected participant IDs */
  initialParticipants?: string[];
  /** Default meeting duration in minutes */
  defaultDuration?: number;
  /** Callback when a slot is confirmed */
  onSlotConfirm: (slot: CommonSlot, participantIds: string[]) => void;
  /** Meeting title (optional) */
  meetingTitle?: string;
}

interface SchedulerSettings {
  duration: number;
  daysToSearch: number;
  includeWeekends: boolean;
  workingHoursStart: number;
  workingHoursEnd: number;
  preferredTimes: ('morning' | 'afternoon' | 'evening')[];
  bufferMinutes: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SETTINGS: SchedulerSettings = {
  duration: 30,
  daysToSearch: 14,
  includeWeekends: false,
  workingHoursStart: 9,
  workingHoursEnd: 18,
  preferredTimes: [],
  bufferMinutes: 0,
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const TIME_PREFERENCES = [
  { id: 'morning', label: 'Matinée (9h-12h)' },
  { id: 'afternoon', label: 'Après-midi (13h-17h)' },
  { id: 'evening', label: 'Soirée (17h-20h)' },
] as const;

// ============================================================================
// Component
// ============================================================================

export function MeetingScheduler({
  open,
  onOpenChange,
  teamMembers,
  initialParticipants = [],
  defaultDuration = 30,
  onSlotConfirm,
  meetingTitle,
}: MeetingSchedulerProps) {
  // State
  const [selectedParticipants, setSelectedParticipants] =
    React.useState<string[]>(initialParticipants);
  const [selectedSlot, setSelectedSlot] = React.useState<CommonSlot | undefined>();
  const [settings, setSettings] = React.useState<SchedulerSettings>({
    ...DEFAULT_SETTINGS,
    duration: defaultDuration,
  });
  const [activeTab, setActiveTab] = React.useState<'list' | 'calendar'>('list');

  // Reset when closing
  React.useEffect(() => {
    if (!open) {
      setSelectedSlot(undefined);
      setActiveTab('list');
    }
  }, [open]);

  // Availability finder
  const { availability, suggestions, isLoading } = useAvailabilityFinder({
    participantIds: selectedParticipants,
    duration: settings.duration,
    startDate: new Date(),
    daysToSearch: settings.daysToSearch,
    includeWeekends: settings.includeWeekends,
    workingHours: {
      start: settings.workingHoursStart,
      end: settings.workingHoursEnd,
    },
    preferredTimes: settings.preferredTimes,
    bufferMinutes: settings.bufferMinutes,
    enabled: open && selectedParticipants.length > 0,
  });

  // Handlers
  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
    setSelectedSlot(undefined);
  };

  const handleConfirm = () => {
    if (selectedSlot) {
      onSlotConfirm(selectedSlot, selectedParticipants);
      onOpenChange(false);
    }
  };

  const updateSetting = <K extends keyof SchedulerSettings>(
    key: K,
    value: SchedulerSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSelectedSlot(undefined);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Planifier une réunion
          </SheetTitle>
          <SheetDescription>
            {meetingTitle
              ? `Trouver un créneau pour "${meetingTitle}"`
              : 'Sélectionnez les participants et trouvez un créneau disponible'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Participants selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants ({selectedParticipants.length})
            </Label>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map((member) => {
                const isSelected = selectedParticipants.includes(member.id);
                return (
                  <Badge
                    key={member.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => toggleParticipant(member.id)}
                  >
                    {isSelected && <Check className="h-3 w-3 mr-1" />}
                    {member.name}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Durée: {settings.duration} min
              </Label>
              <div className="flex gap-1">
                {DURATION_OPTIONS.map((d) => (
                  <Button
                    key={d}
                    variant={settings.duration === d ? 'default' : 'outline'}
                    size="sm"
                    className="w-12"
                    onClick={() => updateSetting('duration', d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>

            {/* Advanced settings popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Paramètres avancés
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-4">
                {/* Date range */}
                <div className="space-y-2">
                  <Label className="text-sm">Rechercher sur {settings.daysToSearch} jours</Label>
                  <Slider
                    value={[settings.daysToSearch]}
                    onValueChange={([v]) => updateSetting('daysToSearch', v)}
                    min={7}
                    max={30}
                    step={1}
                  />
                </div>

                {/* Working hours */}
                <div className="space-y-2">
                  <Label className="text-sm">
                    Heures de travail: {settings.workingHoursStart}h - {settings.workingHoursEnd}h
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={settings.workingHoursStart}
                      onChange={(e) =>
                        updateSetting('workingHoursStart', parseInt(e.target.value) || 9)
                      }
                      min={0}
                      max={23}
                      className="w-20"
                    />
                    <span className="self-center">à</span>
                    <Input
                      type="number"
                      value={settings.workingHoursEnd}
                      onChange={(e) =>
                        updateSetting('workingHoursEnd', parseInt(e.target.value) || 18)
                      }
                      min={0}
                      max={23}
                      className="w-20"
                    />
                  </div>
                </div>

                {/* Include weekends */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-weekends"
                    checked={settings.includeWeekends}
                    onCheckedChange={(checked) =>
                      updateSetting('includeWeekends', checked === true)
                    }
                  />
                  <Label htmlFor="include-weekends" className="text-sm">
                    Inclure les weekends
                  </Label>
                </div>

                {/* Buffer time */}
                <div className="space-y-2">
                  <Label className="text-sm">Temps entre réunions: {settings.bufferMinutes} min</Label>
                  <Slider
                    value={[settings.bufferMinutes]}
                    onValueChange={([v]) => updateSetting('bufferMinutes', v)}
                    min={0}
                    max={30}
                    step={5}
                  />
                </div>

                {/* Preferred times */}
                <div className="space-y-2">
                  <Label className="text-sm">Préférences horaires</Label>
                  {TIME_PREFERENCES.map((pref) => (
                    <div key={pref.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`pref-${pref.id}`}
                        checked={settings.preferredTimes.includes(pref.id)}
                        onCheckedChange={(checked) => {
                          updateSetting(
                            'preferredTimes',
                            checked
                              ? [...settings.preferredTimes, pref.id]
                              : settings.preferredTimes.filter((p) => p !== pref.id)
                          );
                        }}
                      />
                      <Label htmlFor={`pref-${pref.id}`} className="text-sm">
                        {pref.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Availability results */}
          {selectedParticipants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" />
                  Créneaux disponibles
                </Label>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'list' | 'calendar')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="list" className="text-xs px-2 h-6">
                      Liste
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="text-xs px-2 h-6">
                      Calendrier
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-6 w-6  text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Recherche des disponibilités...
                  </span>
                </div>
              ) : (
                <Tabs value={activeTab} className="w-full">
                  <TabsContent value="list" className="mt-0">
                    <SlotSelector
                      slots={suggestions}
                      selectedSlot={selectedSlot}
                      onSlotSelect={setSelectedSlot}
                      totalParticipants={selectedParticipants.length}
                    />
                  </TabsContent>
                  <TabsContent value="calendar" className="mt-0">
                    {availability && (
                      <AvailabilityCalendar
                        availability={availability}
                        selectedSlot={selectedSlot}
                        onSlotSelect={setSelectedSlot}
                        workingHours={{
                          start: settings.workingHoursStart,
                          end: settings.workingHoursEnd,
                        }}
                        daysToShow={7}
                        className="h-[400px]"
                      />
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}

          {/* Selected slot summary */}
          {selectedSlot && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Créneau sélectionné</p>
                  <p className="text-sm text-muted-foreground">
                    {format(selectedSlot.start, "EEEE d MMMM 'à' HH:mm", { locale: fr })} -{' '}
                    {format(selectedSlot.end, 'HH:mm')}
                  </p>
                </div>
                {selectedSlot.allAvailable && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Tous disponibles
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedSlot}>
            Confirmer le créneau
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default MeetingScheduler;
