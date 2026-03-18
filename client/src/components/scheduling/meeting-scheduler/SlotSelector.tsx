'use client';

/**
 * Slot Selector Component
 *
 * Interface for selecting available meeting slots from suggestions.
 * Shows a list of recommended times with participant availability.
 */

import * as React from 'react';
import { format, differenceInMinutes, isToday, isTomorrow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Clock,
  Users,
  Check,
  Calendar,
  Star,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CommonSlot } from '@/lib/scheduling/utils/availability-finder';

// ============================================================================
// Types
// ============================================================================

interface SlotSelectorProps {
  /** Available slots to choose from */
  slots: CommonSlot[];
  /** Currently selected slot */
  selectedSlot?: CommonSlot;
  /** Callback when a slot is selected */
  onSlotSelect: (slot: CommonSlot) => void;
  /** Total number of participants */
  totalParticipants: number;
  /** Whether to show expanded details */
  showDetails?: boolean;
  /** Maximum slots to show initially */
  initialLimit?: number;
  /** Custom class name */
  className?: string;
}

interface SlotCardProps {
  slot: CommonSlot;
  isSelected: boolean;
  onSelect: () => void;
  totalParticipants: number;
  showDetails: boolean;
  index: number;
}

// ============================================================================
// Helpers
// ============================================================================

function formatSlotDate(date: Date): string {
  if (isToday(date)) return 'Aujourd\'hui';
  if (isTomorrow(date)) return 'Demain';
  return format(date, 'EEEE d MMMM', { locale: fr });
}

function formatSlotTime(start: Date, end: Date): string {
  return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
}

function getSlotDuration(start: Date, end: Date): string {
  const minutes = differenceInMinutes(end, start);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h${remainingMinutes}`;
}

// ============================================================================
// SlotSelector Component
// ============================================================================

export function SlotSelector({
  slots,
  selectedSlot,
  onSlotSelect,
  totalParticipants,
  showDetails = true,
  initialLimit = 5,
  className,
}: SlotSelectorProps) {
  const [showAll, setShowAll] = React.useState(false);

  // Separate slots into perfect matches and partial matches
  const perfectSlots = slots.filter((s) => s.allAvailable);
  const partialSlots = slots.filter((s) => !s.allAvailable);

  // Limit displayed slots
  const displayedPerfectSlots = showAll
    ? perfectSlots
    : perfectSlots.slice(0, initialLimit);
  const displayedPartialSlots = showAll
    ? partialSlots
    : partialSlots.slice(0, Math.max(0, initialLimit - perfectSlots.length));

  const hasMore =
    perfectSlots.length + partialSlots.length >
    displayedPerfectSlots.length + displayedPartialSlots.length;

  if (slots.length === 0) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Aucun créneau disponible trouvé pour les participants sélectionnés.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Essayez d'élargir la plage de dates ou de modifier les participants.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Perfect matches section */}
      {perfectSlots.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <Check className="h-4 w-4" />
            <span>Tous disponibles ({perfectSlots.length})</span>
          </div>
          <RadioGroup
            value={selectedSlot?.start.toISOString()}
            onValueChange={(value) => {
              const slot = slots.find((s) => s.start.toISOString() === value);
              if (slot) onSlotSelect(slot);
            }}
          >
            <div className="space-y-2">
              {displayedPerfectSlots.map((slot, index) => (
                <SlotCard
                  key={slot.start.toISOString()}
                  slot={slot}
                  isSelected={
                    selectedSlot?.start.toISOString() === slot.start.toISOString()
                  }
                  onSelect={() => onSlotSelect(slot)}
                  totalParticipants={totalParticipants}
                  showDetails={showDetails}
                  index={index}
                />
              ))}
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Partial matches section */}
      {partialSlots.length > 0 && (
        <Collapsible defaultOpen={perfectSlots.length === 0}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-yellow-600"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>Disponibilité partielle ({partialSlots.length})</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <RadioGroup
              value={selectedSlot?.start.toISOString()}
              onValueChange={(value) => {
                const slot = slots.find((s) => s.start.toISOString() === value);
                if (slot) onSlotSelect(slot);
              }}
            >
              <div className="space-y-2">
                {displayedPartialSlots.map((slot, index) => (
                  <SlotCard
                    key={slot.start.toISOString()}
                    slot={slot}
                    isSelected={
                      selectedSlot?.start.toISOString() === slot.start.toISOString()
                    }
                    onSelect={() => onSlotSelect(slot)}
                    totalParticipants={totalParticipants}
                    showDetails={showDetails}
                    index={index + perfectSlots.length}
                  />
                ))}
              </div>
            </RadioGroup>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Show more/less button */}
      {(hasMore || showAll) && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              Voir moins
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              Voir plus de créneaux
            </>
          )}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// SlotCard Component
// ============================================================================

function SlotCard({
  slot,
  isSelected,
  onSelect,
  totalParticipants,
  showDetails,
  index,
}: SlotCardProps) {
  const isTopRecommendation = index === 0 && slot.allAvailable;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        slot.allAvailable
          ? 'border-green-200 hover:border-green-300'
          : 'border-yellow-200 hover:border-yellow-300'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <RadioGroupItem
            value={slot.start.toISOString()}
            id={`slot-${slot.start.toISOString()}`}
            className="mt-1"
          />

          <Label
            htmlFor={`slot-${slot.start.toISOString()}`}
            className="flex-1 cursor-pointer"
          >
            <div className="space-y-2">
              {/* Main slot info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium capitalize">
                    {formatSlotDate(slot.start)}
                  </span>
                  {isTopRecommendation && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="h-3 w-3" />
                      Recommandé
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {getSlotDuration(slot.start, slot.end)}
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatSlotTime(slot.start, slot.end)}</span>
              </div>

              {/* Participants */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {slot.availableParticipants.length}/{totalParticipants} disponibles
                  </span>
                </div>
                {slot.allAvailable ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Parfait
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Partiel
                  </Badge>
                )}
              </div>

              {/* Score reasons */}
              {showDetails && slot.scoreReasons.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
                  {slot.scoreReasons.slice(0, 2).map((reason, i) => (
                    <p key={i}>{reason}</p>
                  ))}
                </div>
              )}
            </div>
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SlotSelectorCompact (for inline use)
// ============================================================================

interface SlotSelectorCompactProps {
  slots: CommonSlot[];
  selectedSlot?: CommonSlot;
  onSlotSelect: (slot: CommonSlot) => void;
  totalParticipants: number;
  className?: string;
}

export function SlotSelectorCompact({
  slots,
  selectedSlot,
  onSlotSelect,
  totalParticipants,
  className,
}: SlotSelectorCompactProps) {
  if (slots.length === 0) return null;

  // Show only top 3 perfect slots or top 3 overall
  const topSlots = slots.filter((s) => s.allAvailable).slice(0, 3);
  const displaySlots = topSlots.length > 0 ? topSlots : slots.slice(0, 3);

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {displaySlots.map((slot) => {
        const isSelected =
          selectedSlot?.start.toISOString() === slot.start.toISOString();

        return (
          <Button
            key={slot.start.toISOString()}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSlotSelect(slot)}
            className={cn(
              'h-auto py-1.5 px-3',
              !isSelected && slot.allAvailable && 'border-green-300 hover:bg-green-50',
              !isSelected && !slot.allAvailable && 'border-yellow-300 hover:bg-yellow-50'
            )}
          >
            <div className="flex flex-col items-start text-xs">
              <span className="font-medium">
                {isToday(slot.start) ? 'Auj.' : isTomorrow(slot.start) ? 'Dem.' : format(slot.start, 'EEE d', { locale: fr })}
              </span>
              <span className="text-muted-foreground">
                {format(slot.start, 'HH:mm')}
              </span>
            </div>
          </Button>
        );
      })}
    </div>
  );
}

export default SlotSelector;
