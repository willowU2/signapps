'use client';
/**
 * Media page — thin client-component shell.
 *
 * The heavy client bundle (OCR API calls, TTS audio synthesis with
 * URL.createObjectURL, STT file uploads, multiple useEffect/useRef hooks)
 * is split into media-content.tsx and loaded lazily via next/dynamic so
 * it is excluded from the initial JS payload.
 */
import { MediaContent } from './media-wrapper';

export default function MediaPage() {
  return <MediaContent />;
}
