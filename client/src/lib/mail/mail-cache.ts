/**
 * PW2: Offline mail cache backed by idb-keyval (IndexedDB).
 *
 * Stores the last-fetched email list per folder so the mail page can
 * render data when the API is unreachable (offline or server down).
 */

import { get, set } from 'idb-keyval';
import type { Mail } from '@/lib/data/mail';

type MailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'snoozed';

const PREFIX = 'mail-cache:';
const MAX_CACHED = 100;

function cacheKey(folder: MailFolder): string {
  return `${PREFIX}${folder}`;
}

/**
 * Persist up to MAX_CACHED emails for a given folder.
 */
export async function setMailCache(
  folder: MailFolder,
  mails: Mail[],
): Promise<void> {
  try {
    const sliced = mails.slice(0, MAX_CACHED);
    await set(cacheKey(folder), sliced);
  } catch {
    // IDB not available — silently ignore
  }
}

/**
 * Retrieve cached emails for a folder. Returns null if nothing is cached.
 */
export async function getMailCache(folder: MailFolder): Promise<Mail[] | null> {
  try {
    const cached = await get<Mail[]>(cacheKey(folder));
    return cached ?? null;
  } catch {
    return null;
  }
}
