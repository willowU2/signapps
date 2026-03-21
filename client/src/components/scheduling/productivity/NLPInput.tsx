'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * NLPInput Component
 * Phase 3: Productivity Features
 *
 * Natural language input for creating events and tasks.
 * Parses input like "Réunion demain à 14h avec Jean" into structured data.
 */

import * as React from 'react';
import { format, parse, addDays, addWeeks, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, setHours, setMinutes, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, Calendar, Clock, User, MapPin, Tag, AlertCircle, Check, X } from 'lucide-react';
import { schedulingApi, type ParsedNaturalLanguage } from '@/lib/scheduling/api';
import type { CreateTimeItemInput, TimeItemType, Priority } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface NLPInputProps {
  className?: string;
  placeholder?: string;
  onParsed?: (result: ParsedResult) => void;
  onSubmit?: (input: CreateTimeItemInput) => void;
  autoFocus?: boolean;
}

interface ParsedResult {
  title: string;
  type?: TimeItemType;
  date?: Date;
  time?: string;
  duration?: number;
  priority?: Priority;
  participants?: string[];
  location?: string;
  tags?: string[];
  ambiguities?: { field: string; options: string[] }[];
  confidence: number;
}

interface ParsedToken {
  text: string;
  type: 'title' | 'date' | 'time' | 'duration' | 'participant' | 'location' | 'priority' | 'type' | 'tag';
  value?: any;
}

// ============================================================================
// Constants
// ============================================================================

const DATE_PATTERNS: { pattern: RegExp; handler: (match: RegExpMatchArray) => Date }[] = [
  // Relative days
  { pattern: /\baujourd'hui\b/i, handler: () => new Date() },
  { pattern: /\bdemain\b/i, handler: () => addDays(new Date(), 1) },
  { pattern: /\baprès[- ]demain\b/i, handler: () => addDays(new Date(), 2) },
  { pattern: /\bdans (\d+) jours?\b/i, handler: (m) => addDays(new Date(), parseInt(m[1])) },
  { pattern: /\bla semaine prochaine\b/i, handler: () => addWeeks(new Date(), 1) },
  // Day names
  { pattern: /\blundi\b/i, handler: () => nextMonday(new Date()) },
  { pattern: /\bmardi\b/i, handler: () => nextTuesday(new Date()) },
  { pattern: /\bmercredi\b/i, handler: () => nextWednesday(new Date()) },
  { pattern: /\bjeudi\b/i, handler: () => nextThursday(new Date()) },
  { pattern: /\bvendredi\b/i, handler: () => nextFriday(new Date()) },
  { pattern: /\bsamedi\b/i, handler: () => nextSaturday(new Date()) },
  { pattern: /\bdimanche\b/i, handler: () => nextSunday(new Date()) },
  // Specific dates
  { pattern: /\ble (\d{1,2})(?:\/| )(\d{1,2})(?:\/| )?(\d{2,4})?\b/i, handler: (m) => {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]) - 1;
    const year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : new Date().getFullYear();
    return new Date(year, month, day);
  }},
];

const TIME_PATTERNS: { pattern: RegExp; handler: (match: RegExpMatchArray) => string }[] = [
  { pattern: /\bà (\d{1,2})[h:](\d{2})?\b/i, handler: (m) => `${m[1].padStart(2, '0')}:${(m[2] || '00').padStart(2, '0')}` },
  { pattern: /\b(\d{1,2})[h:](\d{2})?\b/i, handler: (m) => `${m[1].padStart(2, '0')}:${(m[2] || '00').padStart(2, '0')}` },
  { pattern: /\bmatin\b/i, handler: () => '09:00' },
  { pattern: /\bmidi\b/i, handler: () => '12:00' },
  { pattern: /\baprès-midi\b/i, handler: () => '14:00' },
  { pattern: /\bsoir\b/i, handler: () => '19:00' },
];

const DURATION_PATTERNS: { pattern: RegExp; handler: (match: RegExpMatchArray) => number }[] = [
  { pattern: /\bpendant (\d+) ?h(?:eures?)?\b/i, handler: (m) => parseInt(m[1]) * 60 },
  { pattern: /\bpendant (\d+) ?min(?:utes?)?\b/i, handler: (m) => parseInt(m[1]) },
  { pattern: /\b(\d+) ?h(?:eures?)?\b/i, handler: (m) => parseInt(m[1]) * 60 },
  { pattern: /\b(\d+) ?min(?:utes?)?\b/i, handler: (m) => parseInt(m[1]) },
];

const PARTICIPANT_PATTERN = /\bavec ([^,]+(?:,\s*[^,]+)*)\b/i;
const LOCATION_PATTERN = /\b(?:à|au|chez|dans|en) ([^,]+?)(?:$|,|\s+(?:à|pendant|avec))/i;

const PRIORITY_MAP: Record<string, Priority> = {
  'urgent': 'urgent',
  'très important': 'urgent',
  'important': 'high',
  'haute priorité': 'high',
  'prioritaire': 'high',
  'normal': 'medium',
  'basse priorité': 'low',
  'pas urgent': 'low',
};

const TYPE_MAP: Record<string, TimeItemType> = {
  'réunion': 'event',
  'meeting': 'event',
  'rdv': 'event',
  'rendez-vous': 'event',
  'appel': 'event',
  'call': 'event',
  'tâche': 'task',
  'task': 'task',
  'todo': 'task',
  'faire': 'task',
  'rappel': 'reminder',
  'reminder': 'reminder',
  'rappeler': 'reminder',
  'bloquer': 'blocker',
  'réservation': 'booking',
  'réserver': 'booking',
};

// ============================================================================
// Parser
// ============================================================================

function parseNaturalLanguage(text: string): ParsedResult {
  const tokens: ParsedToken[] = [];
  let workingText = text;
  let confidence = 1.0;

  // Extract date
  let date: Date | undefined;
  for (const { pattern, handler } of DATE_PATTERNS) {
    const match = workingText.match(pattern);
    if (match) {
      date = handler(match);
      tokens.push({ text: match[0], type: 'date', value: date });
      workingText = workingText.replace(match[0], '');
      break;
    }
  }

  // Extract time
  let time: string | undefined;
  for (const { pattern, handler } of TIME_PATTERNS) {
    const match = workingText.match(pattern);
    if (match) {
      time = handler(match);
      tokens.push({ text: match[0], type: 'time', value: time });
      workingText = workingText.replace(match[0], '');
      break;
    }
  }

  // Extract duration
  let duration: number | undefined;
  for (const { pattern, handler } of DURATION_PATTERNS) {
    const match = workingText.match(pattern);
    if (match) {
      duration = handler(match);
      tokens.push({ text: match[0], type: 'duration', value: duration });
      workingText = workingText.replace(match[0], '');
      break;
    }
  }

  // Extract participants
  let participants: string[] | undefined;
  const participantMatch = workingText.match(PARTICIPANT_PATTERN);
  if (participantMatch) {
    participants = participantMatch[1].split(/,\s*/).map(p => p.trim());
    tokens.push({ text: participantMatch[0], type: 'participant', value: participants });
    workingText = workingText.replace(participantMatch[0], '');
  }

  // Extract location
  let location: string | undefined;
  const locationMatch = workingText.match(LOCATION_PATTERN);
  if (locationMatch) {
    location = locationMatch[1].trim();
    tokens.push({ text: locationMatch[0], type: 'location', value: location });
    workingText = workingText.replace(locationMatch[0], '');
  }

  // Extract priority
  let priority: Priority | undefined;
  for (const [keyword, value] of Object.entries(PRIORITY_MAP)) {
    if (workingText.toLowerCase().includes(keyword)) {
      priority = value;
      tokens.push({ text: keyword, type: 'priority', value });
      workingText = workingText.replace(new RegExp(keyword, 'i'), '');
      break;
    }
  }

  // Extract type
  let type: TimeItemType | undefined;
  for (const [keyword, value] of Object.entries(TYPE_MAP)) {
    if (workingText.toLowerCase().includes(keyword)) {
      type = value;
      tokens.push({ text: keyword, type: 'type', value });
      // Don't remove type keywords from title
      break;
    }
  }

  // Extract tags (#tag format)
  const tags: string[] = [];
  const tagMatches = workingText.matchAll(/#(\w+)/g);
  for (const match of tagMatches) {
    tags.push(match[1]);
    tokens.push({ text: match[0], type: 'tag', value: match[1] });
    workingText = workingText.replace(match[0], '');
  }

  // Clean up remaining text as title
  const title = workingText
    .replace(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();

  // Calculate confidence
  if (!date && !time) confidence *= 0.7;
  if (!title || title.length < 3) confidence *= 0.5;

  return {
    title: title || text,
    type,
    date,
    time,
    duration,
    priority,
    participants,
    location,
    tags: tags.length > 0 ? tags : undefined,
    confidence,
  };
}

// ============================================================================
// Component
// ============================================================================

export function NLPInput({
  className,
  placeholder = "Ex: Réunion demain à 14h avec Jean pendant 1h",
  onParsed,
  onSubmit,
  autoFocus = false,
}: NLPInputProps) {
  const [input, setInput] = React.useState('');
  const [parsed, setParsed] = React.useState<ParsedResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Parse on input change (debounced)
  React.useEffect(() => {
    if (!input.trim()) {
      setParsed(null);
      setShowPreview(false);
      return;
    }

    const timer = setTimeout(() => {
      const result = parseNaturalLanguage(input);
      setParsed(result);
      setShowPreview(true);
      onParsed?.(result);
    }, 300);

    return () => clearTimeout(timer);
  }, [input, onParsed]);

  // Try server-side parsing for better results
  const handleServerParse = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      const serverResult = await schedulingApi.parseNaturalLanguage(input);

      // Merge with local parsing
      const localResult = parseNaturalLanguage(input);
      const merged: ParsedResult = {
        title: serverResult.title || localResult.title,
        type: (serverResult.type as TimeItemType) || localResult.type,
        date: serverResult.date ? new Date(serverResult.date) : localResult.date,
        time: serverResult.time || localResult.time,
        duration: serverResult.duration || localResult.duration,
        priority: (serverResult.priority as Priority) || localResult.priority,
        participants: serverResult.participants || localResult.participants,
        location: serverResult.location || localResult.location,
        ambiguities: serverResult.ambiguities,
        confidence: 0.95,
      };

      setParsed(merged);
      onParsed?.(merged);
    } catch (error) {
      console.error('Server parsing failed, using local:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle submit
  const handleSubmit = () => {
    if (!parsed) return;

    // Build CreateTimeItemInput
    const startDate = parsed.date || new Date();
    let startTime = startDate;

    if (parsed.time) {
      const [hours, minutes] = parsed.time.split(':').map(Number);
      startTime = setMinutes(setHours(startDate, hours), minutes);
    }

    const input: CreateTimeItemInput = {
      title: parsed.title,
      type: parsed.type || 'event',
      startTime: startTime.toISOString(),
      endTime: parsed.duration
        ? new Date(startTime.getTime() + parsed.duration * 60000).toISOString()
        : undefined,
      priority: parsed.priority || 'medium',
      location: parsed.location ? { type: 'text' as const, value: parsed.location } : undefined,
      tags: parsed.tags,
      scope: 'moi',
    };

    onSubmit?.(input);
    setInput('');
    setParsed(null);
    setShowPreview(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setShowPreview(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => parsed && setShowPreview(true)}
          placeholder={placeholder}
          className="pl-10 pr-24"
          autoFocus={autoFocus}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4  text-muted-foreground" />}
          {parsed && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={handleServerParse}
              disabled={isLoading}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              IA
            </Button>
          )}
          {parsed && (
            <Button
              size="sm"
              className="h-7"
              onClick={handleSubmit}
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Preview popup */}
      {showPreview && parsed && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{parsed.title}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowPreview(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {parsed.type && (
                <Badge variant="secondary" className="text-xs">
                  {parsed.type}
                </Badge>
              )}

              {parsed.date && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(parsed.date, 'EEE d MMM', { locale: fr })}
                </Badge>
              )}

              {parsed.time && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {parsed.time}
                </Badge>
              )}

              {parsed.duration && (
                <Badge variant="outline" className="text-xs">
                  {parsed.duration >= 60
                    ? `${Math.floor(parsed.duration / 60)}h${parsed.duration % 60 > 0 ? parsed.duration % 60 : ''}`
                    : `${parsed.duration}min`}
                </Badge>
              )}

              {parsed.participants?.map((p, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  {p}
                </Badge>
              ))}

              {parsed.location && (
                <Badge variant="outline" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  {parsed.location}
                </Badge>
              )}

              {parsed.tags?.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}

              {parsed.priority && parsed.priority !== 'medium' && (
                <Badge
                  variant={parsed.priority === 'urgent' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {parsed.priority}
                </Badge>
              )}
            </div>

            {/* Ambiguities */}
            {parsed.ambiguities && parsed.ambiguities.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>Clarification nécessaire:</span>
                </div>
                {parsed.ambiguities.map((amb, i) => (
                  <div key={i} className="text-xs text-muted-foreground mt-1">
                    {amb.field}: {amb.options.join(' ou ')}?
                  </div>
                ))}
              </div>
            )}

            {/* Confidence indicator */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    parsed.confidence >= 0.8 ? 'bg-green-500' :
                    parsed.confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                  style={{ width: `${parsed.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(parsed.confidence * 100)}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default NLPInput;
