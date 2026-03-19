/**
 * ICS Export Service
 *
 * Generate iCalendar (ICS) files from scheduling blocks.
 * Supports single events, multiple events, and full calendar export.
 */

import { format, formatISO } from 'date-fns';
import type {
  ScheduleBlock,
  Attendee,
  ScheduleRecurrenceRule,
  EventLocation,
} from '../types/scheduling';

// ============================================================================
// Types
// ============================================================================

export interface ICSExportOptions {
  /** Calendar name for the export */
  calendarName?: string;
  /** Calendar description */
  calendarDescription?: string;
  /** Product identifier */
  productId?: string;
  /** Timezone */
  timezone?: string;
  /** Include attendees */
  includeAttendees?: boolean;
  /** Include alarms/reminders */
  includeReminders?: boolean;
}

export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend?: Date;
  allDay?: boolean;
  location?: string;
  geo?: { lat: number; lng: number };
  organizer?: { name: string; email: string };
  attendees?: Array<{ name: string; email: string; rsvp: string }>;
  rrule?: string;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  categories?: string[];
  priority?: number;
  url?: string;
  created?: Date;
  lastModified?: Date;
  sequence?: number;
  alarm?: { trigger: number; action: 'DISPLAY' | 'EMAIL'; description?: string };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: ICSExportOptions = {
  calendarName: 'Calendrier SignApps',
  productId: '-//SignApps//Scheduling//FR',
  timezone: 'Europe/Paris',
  includeAttendees: true,
  includeReminders: true,
};

const STATUS_MAP: Record<string, 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'> = {
  confirmed: 'CONFIRMED',
  tentative: 'TENTATIVE',
  cancelled: 'CANCELLED',
};

const RSVP_MAP: Record<string, string> = {
  accepted: 'ACCEPTED',
  declined: 'DECLINED',
  tentative: 'TENTATIVE',
  pending: 'NEEDS-ACTION',
};

const PRIORITY_MAP: Record<string, number> = {
  urgent: 1,
  high: 3,
  medium: 5,
  low: 9,
};

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Export a single event to ICS string
 */
export function exportEventToICS(
  block: ScheduleBlock,
  options: ICSExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const events = [blockToICSEvent(block, opts)];
  return generateICSContent(events, opts);
}

/**
 * Export multiple events to ICS string
 */
export function exportEventsToICS(
  blocks: ScheduleBlock[],
  options: ICSExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const events = blocks.map((b) => blockToICSEvent(b, opts));
  return generateICSContent(events, opts);
}

/**
 * Download ICS file
 */
export function downloadICS(
  icsContent: string,
  filename: string = 'calendar.ics'
): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download a single event
 */
export function downloadEventICS(
  block: ScheduleBlock,
  options: ICSExportOptions = {}
): void {
  const icsContent = exportEventToICS(block, options);
  const filename = sanitizeFilename(block.title);
  downloadICS(icsContent, filename);
}

/**
 * Export and download multiple events
 */
export function downloadEventsICS(
  blocks: ScheduleBlock[],
  filename: string = 'events',
  options: ICSExportOptions = {}
): void {
  const icsContent = exportEventsToICS(blocks, options);
  downloadICS(icsContent, filename);
}

// ============================================================================
// ICS Generation
// ============================================================================

function blockToICSEvent(
  block: ScheduleBlock,
  options: ICSExportOptions
): ICSEvent {
  const event: ICSEvent = {
    uid: `${block.id}@signapps.local`,
    summary: block.title,
    description: block.description,
    dtstart: block.start,
    dtend: block.end,
    allDay: block.allDay,
    status: block.status ? STATUS_MAP[block.status] : 'CONFIRMED',
    categories: block.tags,
    priority: block.priority ? PRIORITY_MAP[block.priority] : undefined,
    created: block.createdAt,
    lastModified: block.updatedAt,
  };

  // Location
  if (block.location) {
    event.location = formatLocation(block.location);
    if (block.location.coordinates) {
      event.geo = block.location.coordinates;
    }
    if (block.location.meetingUrl) {
      event.url = block.location.meetingUrl;
    }
  }

  // Attendees
  if (options.includeAttendees && block.attendees?.length) {
    event.attendees = block.attendees.map((a) => ({
      name: a.name,
      email: a.email,
      rsvp: RSVP_MAP[a.status || 'pending'],
    }));
  }

  // Recurrence
  if (block.recurrence) {
    event.rrule = formatRRule(block.recurrence);
  }

  // Reminder
  if (options.includeReminders && block.reminderMinutes) {
    event.alarm = {
      trigger: -block.reminderMinutes,
      action: 'DISPLAY',
      description: `Rappel: ${block.title}`,
    };
  }

  return event;
}

function generateICSContent(
  events: ICSEvent[],
  options: ICSExportOptions
): string {
  const lines: string[] = [];

  // Calendar header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push(`PRODID:${options.productId}`);
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  if (options.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeText(options.calendarName)}`);
  }
  if (options.timezone) {
    lines.push(`X-WR-TIMEZONE:${options.timezone}`);
  }

  // Events
  for (const event of events) {
    lines.push(...generateVEvent(event));
  }

  // Calendar footer
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

function generateVEvent(event: ICSEvent): string[] {
  const lines: string[] = [];

  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${event.uid}`);
  lines.push(`DTSTAMP:${formatICSDate(new Date())}`);

  // Start/End
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatICSDateOnly(event.dtstart)}`);
    if (event.dtend) {
      lines.push(`DTEND;VALUE=DATE:${formatICSDateOnly(event.dtend)}`);
    }
  } else {
    lines.push(`DTSTART:${formatICSDate(event.dtstart)}`);
    if (event.dtend) {
      lines.push(`DTEND:${formatICSDate(event.dtend)}`);
    }
  }

  // Summary (title)
  lines.push(`SUMMARY:${escapeText(event.summary)}`);

  // Description
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }

  // Location
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  // Geo coordinates
  if (event.geo) {
    lines.push(`GEO:${event.geo.lat};${event.geo.lng}`);
  }

  // URL
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  // Status
  if (event.status) {
    lines.push(`STATUS:${event.status}`);
  }

  // Priority
  if (event.priority) {
    lines.push(`PRIORITY:${event.priority}`);
  }

  // Categories (tags)
  if (event.categories?.length) {
    lines.push(`CATEGORIES:${event.categories.join(',')}`);
  }

  // Recurrence
  if (event.rrule) {
    lines.push(`RRULE:${event.rrule}`);
  }

  // Attendees
  if (event.attendees?.length) {
    for (const attendee of event.attendees) {
      lines.push(
        `ATTENDEE;CN=${escapeText(attendee.name)};PARTSTAT=${attendee.rsvp}:mailto:${attendee.email}`
      );
    }
  }

  // Organizer
  if (event.organizer) {
    lines.push(
      `ORGANIZER;CN=${escapeText(event.organizer.name)}:mailto:${event.organizer.email}`
    );
  }

  // Timestamps
  if (event.created) {
    lines.push(`CREATED:${formatICSDate(event.created)}`);
  }
  if (event.lastModified) {
    lines.push(`LAST-MODIFIED:${formatICSDate(event.lastModified)}`);
  }

  // Alarm
  if (event.alarm) {
    lines.push('BEGIN:VALARM');
    lines.push(`TRIGGER:${formatTrigger(event.alarm.trigger)}`);
    lines.push(`ACTION:${event.alarm.action}`);
    if (event.alarm.description) {
      lines.push(`DESCRIPTION:${escapeText(event.alarm.description)}`);
    }
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');

  return lines;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatICSDate(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

function formatICSDateOnly(date: Date): string {
  return format(date, 'yyyyMMdd');
}

function formatTrigger(minutes: number): string {
  const absMinutes = Math.abs(minutes);
  const sign = minutes < 0 ? '-' : '';

  if (absMinutes % (60 * 24) === 0) {
    return `${sign}P${absMinutes / (60 * 24)}D`;
  }
  if (absMinutes % 60 === 0) {
    return `${sign}PT${absMinutes / 60}H`;
  }
  return `${sign}PT${absMinutes}M`;
}

function formatRRule(recurrence: ScheduleRecurrenceRule): string {
  const parts: string[] = [];

  // Frequency
  parts.push(`FREQ=${recurrence.frequency.toUpperCase()}`);

  // Interval
  if (recurrence.interval > 1) {
    parts.push(`INTERVAL=${recurrence.interval}`);
  }

  // End conditions
  if (recurrence.count) {
    parts.push(`COUNT=${recurrence.count}`);
  } else if (recurrence.endDate) {
    parts.push(`UNTIL=${formatICSDate(recurrence.endDate)}`);
  }

  // By day
  if (recurrence.byDay?.length) {
    parts.push(`BYDAY=${recurrence.byDay.join(',')}`);
  }

  // By month
  if (recurrence.byMonth?.length) {
    parts.push(`BYMONTH=${recurrence.byMonth.join(',')}`);
  }

  // By month day
  if (recurrence.byMonthDay?.length) {
    parts.push(`BYMONTHDAY=${recurrence.byMonthDay.join(',')}`);
  }

  return parts.join(';');
}

function formatLocation(location: EventLocation): string {
  const parts: string[] = [location.name];
  if (location.address) {
    parts.push(location.address);
  }
  return parts.join(', ');
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a calendar subscription URL
 */
export function generateCalendarSubscriptionUrl(
  calendarId: string,
  baseUrl: string
): string {
  return `${baseUrl}/api/v1/calendars/${calendarId}/ics`;
}

/**
 * Get MIME type for ICS files
 */
export function getICSMimeType(): string {
  return 'text/calendar';
}
