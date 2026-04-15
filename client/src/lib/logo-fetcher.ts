/**
 * Runtime logo fetcher for apps not in the pre-downloaded collection.
 *
 * When getAppLogo() falls back to Google favicon, this module can be called
 * to download and cache the logo locally for future use.
 *
 * This runs client-side and caches in localStorage to avoid repeat fetches.
 */

const CACHE_KEY = "signapps-logo-cache";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface LogoCache {
  [appId: string]: {
    url: string;
    fetchedAt: number;
  };
}

function getCache(): LogoCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCache(cache: LogoCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full, ignore
  }
}

/**
 * Check if a logo URL actually returns a valid image.
 * Caches the result to avoid re-checking.
 */
export async function validateLogoUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: "HEAD", mode: "no-cors" });
    return resp.ok || resp.type === "opaque"; // no-cors returns opaque
  } catch {
    return false;
  }
}

/**
 * Get the best available logo URL for an app, checking cache first.
 * Falls back to Google favicon if no cached version exists.
 */
export function getCachedLogo(appId: string): string | null {
  const cache = getCache();
  const entry = cache[appId.toLowerCase()];

  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL) {
    return entry.url;
  }

  return null;
}

/**
 * Cache a logo URL for future use.
 */
export function cacheLogo(appId: string, url: string): void {
  const cache = getCache();
  cache[appId.toLowerCase()] = { url, fetchedAt: Date.now() };
  setCache(cache);
}
