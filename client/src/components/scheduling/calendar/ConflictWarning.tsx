"use client";

/**
 * ConflictWarning Component
 *
 * Displays scheduling conflict warnings with details and alternative suggestions.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  XCircle,
  Clock,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  Conflict,
  AvailableSlot,
} from "@/lib/scheduling/utils/conflict-detection";

// ============================================================================
// Types
// ============================================================================

interface ConflictWarningProps {
  conflicts: Conflict[];
  suggestions?: AvailableSlot[];
  onSelectSuggestion?: (slot: AvailableSlot) => void;
  onDismiss?: () => void;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getConflictIcon(type: Conflict["type"]) {
  switch (type) {
    case "resource":
      return Calendar;
    case "attendee":
      return Users;
    default:
      return Clock;
  }
}

function getConflictLabel(type: Conflict["type"]): string {
  switch (type) {
    case "resource":
      return "Ressource";
    case "attendee":
      return "Participant";
    default:
      return "Horaire";
  }
}

function formatTimeRange(start: Date, end: Date): string {
  const startStr = format(start, "HH:mm", { locale: fr });
  const endStr = format(end, "HH:mm", { locale: fr });
  return `${startStr} - ${endStr}`;
}

// ============================================================================
// ConflictItem
// ============================================================================

interface ConflictItemProps {
  conflict: Conflict;
}

function ConflictItem({ conflict }: ConflictItemProps) {
  const Icon = getConflictIcon(conflict.type);
  const isError = conflict.severity === "error";

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        isError
          ? "border-destructive/50 bg-destructive/5"
          : "border-yellow-500/50 bg-yellow-500/5",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 mt-0.5 shrink-0",
          isError ? "text-destructive" : "text-yellow-600",
        )}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">
            {conflict.event.title}
          </span>
          <Badge
            variant={isError ? "destructive" : "secondary"}
            className="shrink-0 text-xs"
          >
            {getConflictLabel(conflict.type)}
          </Badge>
        </div>

        <div className="text-xs text-muted-foreground space-y-0.5">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(conflict.event.start, "EEEE d MMMM", { locale: fr })}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeRange(conflict.overlapStart, conflict.overlapEnd)}
            <span className="text-muted-foreground/70">
              ({conflict.overlapMinutes} min de chevauchement)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SuggestionItem
// ============================================================================

interface SuggestionItemProps {
  slot: AvailableSlot;
  index: number;
  onSelect?: (slot: AvailableSlot) => void;
}

function SuggestionItem({ slot, index, onSelect }: SuggestionItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(slot)}
      className={cn(
        "w-full text-left p-3 rounded-lg border",
        "hover:border-primary hover:bg-primary/5",
        "transition-colors",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
          {index + 1}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">
            {format(slot.start, "EEEE d MMMM", { locale: fr })}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(slot.start, "HH:mm", { locale: fr })} -{" "}
            {format(slot.end, "HH:mm", { locale: fr })}
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">
          {slot.durationMinutes >= 60
            ? `${Math.floor(slot.durationMinutes / 60)}h${slot.durationMinutes % 60 > 0 ? slot.durationMinutes % 60 : ""}`
            : `${slot.durationMinutes}min`}
        </Badge>
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ConflictWarning({
  conflicts,
  suggestions = [],
  onSelectSuggestion,
  onDismiss,
  className,
}: ConflictWarningProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const errorCount = conflicts.filter((c) => c.severity === "error").length;
  const warningCount = conflicts.filter((c) => c.severity === "warning").length;
  const hasErrors = errorCount > 0;

  if (conflicts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={className}
    >
      <Alert
        variant={hasErrors ? "destructive" : "default"}
        className="relative"
      >
        {/* Close button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-2 right-2 p-1 rounded hover:bg-background/80"
          >
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-start gap-2">
          <AlertTriangle
            className={cn(
              "h-5 w-5",
              hasErrors ? "text-destructive" : "text-yellow-600",
            )}
          />
          <div className="flex-1">
            <AlertTitle className="mb-1">
              {hasErrors ? "Conflits détectés" : "Attention"}
            </AlertTitle>
            <AlertDescription>
              {errorCount > 0 && (
                <span className="text-destructive mr-2">
                  {errorCount} conflit{errorCount > 1 ? "s" : ""} bloquant
                  {errorCount > 1 ? "s" : ""}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-yellow-600">
                  {warningCount} avertissement{warningCount > 1 ? "s" : ""}
                </span>
              )}
            </AlertDescription>
          </div>
        </div>

        {/* Conflict List */}
        <Collapsible
          open={isExpanded}
          onOpenChange={setIsExpanded}
          className="mt-4"
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
            >
              <span>Voir les détails</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-2">
            <div className="space-y-2">
              <AnimatePresence>
                {conflicts.map((conflict, index) => (
                  <motion.div
                    key={`${conflict.event.id}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ConflictItem conflict={conflict} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Lightbulb className="h-4 w-4" />
              <span>
                {showSuggestions ? "Masquer" : "Afficher"} {suggestions.length}{" "}
                créneau{suggestions.length > 1 ? "x" : ""} suggéré
                {suggestions.length > 1 ? "s" : ""}
              </span>
            </button>

            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-2"
                >
                  {suggestions.map((slot, index) => (
                    <SuggestionItem
                      key={slot.start.toISOString()}
                      slot={slot}
                      index={index}
                      onSelect={onSelectSuggestion}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </Alert>
    </motion.div>
  );
}

// ============================================================================
// Compact Version
// ============================================================================

interface ConflictBadgeProps {
  conflicts: Conflict[];
  onClick?: () => void;
}

export function ConflictBadge({ conflicts, onClick }: ConflictBadgeProps) {
  const errorCount = conflicts.filter((c) => c.severity === "error").length;
  const hasErrors = errorCount > 0;

  if (conflicts.length === 0) return null;

  return (
    <Badge
      variant={hasErrors ? "destructive" : "secondary"}
      className="cursor-pointer"
      onClick={onClick}
    >
      <AlertTriangle className="h-3 w-3 mr-1" />
      {conflicts.length} conflit{conflicts.length > 1 ? "s" : ""}
    </Badge>
  );
}

export default ConflictWarning;
