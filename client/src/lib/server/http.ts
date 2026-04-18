/**
 * Server-only HTTP helper for React Server Components.
 *
 * Reads the auth_token cookie via `next/headers`, calls the backend
 * via `fetch`, and returns JSON.  Use this from files under
 * `lib/server/` — never from `components/` or client files, which
 * could leak the cookie-read intent into the client bundle.
 *
 * The `"server-only"` import acts as a lint that aborts the build
 * if a client component accidentally imports this module.
 */

import "server-only";

import { cookies } from "next/headers";

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ?? "http://localhost:3099";

export interface FetchServerOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  cache?: RequestCache;
  revalidate?: number | false;
}

export async function fetchServer<T>(
  path: string,
  opts: FetchServerOptions = {},
): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const base = opts.baseUrl ?? BACKEND_BASE_URL;
  // Safety: avoid accidental double /api/v1 when baseUrl already contains it
  // and path starts with /api/v1 (common bug when lib/server callers follow
  // the same "/api/v1/..." convention as the browser axios clients).
  const normalizedPath =
    base.endsWith("/api/v1") && path.startsWith("/api/v1/")
      ? path.slice("/api/v1".length)
      : path;
  const url = path.startsWith("http") ? path : `${base}${normalizedPath}`;

  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/json",
      ...opts.headers,
    },
    cache: opts.cache ?? "no-store",
    next:
      opts.revalidate !== undefined
        ? { revalidate: opts.revalidate }
        : undefined,
  });

  if (!res.ok) {
    throw new Error(
      `server fetch failed: ${res.status} ${res.statusText} for ${url}`,
    );
  }

  return (await res.json()) as T;
}
