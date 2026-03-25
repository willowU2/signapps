/**
 * Media page — thin server-component shell.
 *
 * The heavy client bundle (OCR API calls, TTS audio synthesis with
 * URL.createObjectURL, STT file uploads, multiple useEffect/useRef hooks)
 * is split into media-content.tsx and loaded lazily via next/dynamic so
 * it is excluded from the initial JS payload.
 */
import dynamic from 'next/dynamic';

const MediaContent = dynamic(() => import('./media-content'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
      Loading Media Tools…
    </div>
  ),
});

export default function MediaPage() {
  return <MediaContent />;
}
