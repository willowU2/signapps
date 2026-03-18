/**
 * ICS Import Service
 *
 * Parse iCalendar (ICS) files and convert to scheduling blocks.
 */

import { parse, parseISO } from 'date-fns';
import type {
  ScheduleBlock,
  Attendee,
  RecurrenceRule,
  EventLocation,
  RSVPStatus,
  BlockStatus,
  Priority,
} from '../types/scheduling';

// ============================================================================
// Types
// ============================================================================

export interface ICSImportOptions {
  /** Target calendar ID for imported events */
  calendarId?: string;
  /** Whether to import attendees */
  importAttendees?: boolean;
  /** Whether to import reminders */
  importReminders?: boolean;
  /** Whether to import recurrence rules */
  importRecurrence?: boolean;
  /** Default timezone if not specified */
  defaultTimezone?: string;
}

export interface ICSImportResult {
  /** Successfully imported events */
  events: Partial<ScheduleBlock>[];
  /** Parsing errors */
  errors: ICSParseError[];
  /** Import statistics */
  stats: {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  };
}

export interface ICSParseError {
  line?: number;
  component?: string;
  property?: string;
  message: string;
  raw?: string;
}

interface ParsedVEvent {
  uid?: string;
  summary?: string;
  description?: string;
  dtstart?: string;
  dtend?: string;
  dtstartAllDay?: boolean;
  location?: string;
  geo?: string;
  url?: string;
  status?: string;
  categories?: string[];
  priority?: number;
  rrule?: string;
  organizer?: { name: string; email: string };
  attendees?: Array<{ name: string; email: string; partstat: string }>;
  alarm?: { trigger: string; action: string; description?: string };
  created?: string;
  lastModified?: string;
  sequence?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: ICSImportOptions = {
  importAttendees: true,
  importReminders: true,
  importRecurrence: true,
  defaultTimezone: 'Europe/Paris',
};

const STATUS_MAP: Record<string, BlockStatus> = {
  CONFIRMED: 'confirmed',
  TENTATIVE: 'tentative',
  CANCELLED: 'cancelled',
};

const RSVP_MAP: Record<string, RSVPStatus> = {
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  TENTATIVE: 'tentative',
  'NEEDS-ACTION': 'pending',
};

const PRIORITY_MAP: Record<number, Priority> = {
  1: 'urgent',
  2: 'urgent',
  3: 'high',
  4: 'high',
  5: 'medium',
  6: 'medium',
  7: 'low',
  8: 'low',
  9: 'low',
};

// ============================================================================
// Main Import Functions
// ============================================================================

/**
 * Parse ICS content and return scheduling blocks
 */
export function parseICS(
  icsContent: string,
  options: ICSImportOptions = {}
): ICSImportResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const events: Partial<ScheduleBlock>[] = [];
  const errors: ICSParseError[] = [];
  let total = 0;
  let skipped = 0;

  try {
    // Normalize line endings and unfold lines
    const normalizedContent = unfoldLines(icsContent);
    const lines = normalizedContent.split(/\r\n|\n|\r/);

    // Find VCALENDAR section
    let inCalendar = false;
    let inEvent = false;
    let currentEvent: ParsedVEvent = {};
    let inAlarm = false;
    let currentAlarm: { trigger?: string; action?: string; description?: string } = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === 'BEGIN:VCALENDAR') {
        inCalendar = true;
        continue;
      }

      if (line === 'END:VCALENDAR') {
        inCalendar = false;
        continue;
      }

      if (!inCalendar) continue;

      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        total++;
        currentEvent = {};
        continue;
      }

      if (line === 'END:VEVENT') {
        inEvent = false;
        try {
          const block = parsedEventToBlock(currentEvent, opts);
          if (block) {
            events.push(block);
          } else {
            skipped++;
          }
        } catch (err) {
          errors.push({
            line: i,
            component: 'VEVENT',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
        currentEvent = {};
        continue;
      }

      if (line === 'BEGIN:VALARM') {
        inAlarm = true;
        currentAlarm = {};
        continue;
      }

      if (line === 'END:VALARM') {
        inAlarm = false;
        if (currentAlarm.trigger && currentAlarm.action) {
          currentEvent.alarm = {
            trigger: currentAlarm.trigger,
            action: currentAlarm.action,
            description: currentAlarm.description,
          };
        }
        continue;
      }

      if (inAlarm) {
        parseAlarmProperty(line, currentAlarm);
        continue;
      }

      if (inEvent) {
        parseEventProperty(line, currentEvent);
      }
    }
  } catch (err) {
    errors.push({
      message: err instanceof Error ? err.message : 'Failed to parse ICS content',
    });
  }

  return {
    events,
    errors,
    stats: {
      total,
      imported: events.length,
      skipped,
      errors: errors.length,
    },
  };
}

/**
 * Import ICS from file
 */
export async function importICSFile(
  file: File,
  options: ICSImportOptions = {}
): Promise<ICSImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        resolve(parseICS(content, options));
      } else {
        reject(new Error('Failed to read file content'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Import ICS from URL
 */
export async function importICSFromUrl(
  url: string,
  options: ICSImportOptions = {}
): Promise<ICSImportResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ICS: ${response.statusText}`);
  }
  const content = await response.text();
  return parseICS(content, options);
}

// ============================================================================
// Parsing Helpers
// ============================================================================

function unfoldLines(content: string): string {
  // ICS allows line folding - lines starting with space/tab are continuations
  return content.replace(/\r?\n[ \t]/g, '');
}

function parseEventProperty(line: string, event: ParsedVEvent): void {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return;

  let key = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);

  // Handle parameters (e.g., DTSTART;VALUE=DATE:20240101)
  const semicolonIndex = key.indexOf(';');
  let params: Record<string, string> = {};
  if (semicolonIndex !== -1) {
    const paramStr = key.slice(semicolonIndex + 1);
    key = key.slice(0, semicolonIndex);
    params = parseParams(paramStr);
  }

  switch (key.toUpperCase()) {
    case 'UID':
      event.uid = value;
      break;
    case 'SUMMARY':
      event.summary = unescapeText(value);
      break;
    case 'DESCRIPTION':
      event.description = unescapeText(value);
      break;
    case 'DTSTART':
      event.dtstart = value;
      event.dtstartAllDay = params['VALUE'] === 'DATE';
      break;
    case 'DTEND':
      event.dtend = value;
      break;
    case 'LOCATION':
      event.location = unescapeText(value);
      break;
    case 'GEO':
      event.geo = value;
      break;
    case 'URL':
      event.url = value;
      break;
    case 'STATUS':
      event.status = value;
      break;
    case 'CATEGORIES':
      event.categories = value.split(',').map((c) => c.trim());
      break;
    case 'PRIORITY':
      event.priority = parseInt(value, 10);
      break;
    case 'RRULE':
      event.rrule = value;
      break;
    case 'ORGANIZER':
      event.organizer = parseAttendeeValue(value, params);
      break;
    case 'ATTENDEE':
      if (!event.attendees) event.attendees = [];
      const attendee = parseAttendeeValue(value, params);
      if (attendee) {
        event.attendees.push({
          ...attendee,
          partstat: params['PARTSTAT'] || 'NEEDS-ACTION',
        });
      }
      break;
    case 'CREATED':
      event.created = value;
      break;
    case 'LAST-MODIFIED':
      event.lastModified = value;
      break;
    case 'SEQUENCE':
      event.sequence = parseInt(value, 10);
      break;
  }
}

function parseAlarmProperty(
  line: string,
  alarm: { trigger?: string; action?: string; description?: string }
): void {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return;

  const key = line.slice(0, colonIndex).split(';')[0].toUpperCase();
  const value = line.slice(colonIndex + 1);

  switch (key) {
    case 'TRIGGER':
      alarm.trigger = value;
      break;
    case 'ACTION':
      alarm.action = value;
      break;
    case 'DESCRIPTION':
      alarm.description = unescapeText(value);
      break;
  }
}

function parseParams(paramStr: string): Record<string, string> {
  const params: Record<string, string> = {};
  const parts = paramStr.split(';');
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex !== -1) {
      const key = part.slice(0, eqIndex);
      const val = part.slice(eqIndex + 1).replace(/^"|"$/g, '');
      params[key] = val;
    }
  }
  return params;
}

function parseAttendeeValue(
  value: string,
  params: Record<string, string>
): { name: string; email: string } | null {
  const email = value.replace('mailto:', '').toLowerCase();
  const name = params['CN'] || email.split('@')[0];
  return { name, email };
}

function unescapeText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// ============================================================================
// Conversion to ScheduleBlock
// ============================================================================

function parsedEventToBlock(
  event: ParsedVEvent,
  options: ICSImportOptions
): Partial<ScheduleBlock> | null {
  if (!event.summary || !event.dtstart) {
    return null;
  }

  const block: Partial<ScheduleBlock> = {
    type: 'event',
    title: event.summary,
    description: event.description,
    allDay: event.dtstartAllDay || false,
    calendarId: options.calendarId,
    metadata: {
      icsUid: event.uid,
    },
  };

  // Parse dates
  block.start = parseICSDate(event.dtstart, event.dtstartAllDay);
  if (event.dtend) {
    block.end = parseICSDate(event.dtend, event.dtstartAllDay);
  }

  // Status
  if (event.status && STATUS_MAP[event.status]) {
    block.status = STATUS_MAP[event.status];
  }

  // Priority
  if (event.priority && PRIORITY_MAP[event.priority]) {
    block.priority = PRIORITY_MAP[event.priority];
  }

  // Categories as tags
  if (event.categories?.length) {
    block.tags = event.categories;
  }

  // Location
  if (event.location) {
    const location: EventLocation = {
      name: event.location,
    };
    if (event.geo) {
      const [lat, lng] = event.geo.split(';').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        location.coordinates = { lat, lng };
      }
    }
    if (event.url) {
      location.meetingUrl = event.url;
    }
    block.location = location;
  }

  // Attendees
  if (options.importAttendees && event.attendees?.length) {
    block.attendees = event.attendees.map((a, i) => ({
      id: `attendee-${i}`,
      name: a.name,
      email: a.email,
      status: RSVP_MAP[a.partstat] || 'pending',
      required: true,
    }));
  }

  // Recurrence
  if (options.importRecurrence && event.rrule) {
    block.recurrence = parseRRule(event.rrule);
  }

  // Reminder
  if (options.importReminders && event.alarm?.trigger) {
    block.reminderMinutes = parseTrigger(event.alarm.trigger);
  }

  // Timestamps
  if (event.created) {
    block.createdAt = parseICSDate(event.created, false);
  }
  if (event.lastModified) {
    block.updatedAt = parseICSDate(event.lastModified, false);
  }

  return block;
}

function parseICSDate(dateStr: string, isDateOnly?: boolean): Date {
  // Remove any timezone suffix for parsing
  const cleanStr = dateStr.replace(/Z$/, '');

  if (isDateOnly || cleanStr.length === 8) {
    // Format: YYYYMMDD
    return parse(cleanStr, 'yyyyMMdd', new Date());
  }

  // Format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  return parse(cleanStr, "yyyyMMdd'T'HHmmss", new Date());
}

function parseRRule(rruleStr: string): RecurrenceRule {
  const parts = rruleStr.split(';');
  const rule: RecurrenceRule = {
    frequency: 'weekly',
    interval: 1,
  };

  for (const part of parts) {
    const [key, value] = part.split('=');
    switch (key.toUpperCase()) {
      case 'FREQ':
        rule.frequency = value.toLowerCase() as RecurrenceRule['frequency'];
        break;
      case 'INTERVAL':
        rule.interval = parseInt(value, 10);
        break;
      case 'COUNT':
        rule.count = parseInt(value, 10);
        break;
      case 'UNTIL':
        rule.endDate = parseICSDate(value, false);
        break;
      case 'BYDAY':
        rule.byDay = value.split(',');
        break;
      case 'BYMONTH':
        rule.byMonth = value.split(',').map(Number);
        break;
      case 'BYMONTHDAY':
        rule.byMonthDay = value.split(',').map(Number);
        break;
    }
  }

  return rule;
}

function parseTrigger(triggerStr: string): number {
  // Parse ISO 8601 duration format: -P1D, -PT15M, -PT1H, etc.
  const match = triggerStr.match(/^(-)?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!match) return 15; // Default 15 minutes

  const [, negative, days, hours, minutes] = match;
  let totalMinutes = 0;
  if (days) totalMinutes += parseInt(days, 10) * 24 * 60;
  if (hours) totalMinutes += parseInt(hours, 10) * 60;
  if (minutes) totalMinutes += parseInt(minutes, 10);

  return negative ? totalMinutes : -totalMinutes;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate ICS content
 */
export function validateICS(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!content.includes('BEGIN:VCALENDAR')) {
    errors.push('Missing VCALENDAR component');
  }
  if (!content.includes('END:VCALENDAR')) {
    errors.push('Unclosed VCALENDAR component');
  }
  if (!content.includes('VERSION:2.0')) {
    errors.push('Missing or invalid VERSION property');
  }

  const eventStarts = (content.match(/BEGIN:VEVENT/g) || []).length;
  const eventEnds = (content.match(/END:VEVENT/g) || []).length;
  if (eventStarts !== eventEnds) {
    errors.push('Mismatched VEVENT start/end tags');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
