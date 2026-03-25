/**
 * Office page — thin server-component shell.
 *
 * The heavy client bundle (file-drag-drop zones, PDF tools, spreadsheet I/O,
 * presentation export, multiple useRef/useState instances) is split into
 * office-content.tsx and loaded lazily via next/dynamic so it is excluded
 * from the initial JS payload.
 */
import dynamic from 'next/dynamic';

const OfficeContent = dynamic(() => import('./office-content'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
      Loading Office Tools…
    </div>
  ),
});

export default function OfficePage() {
  return <OfficeContent />;
}
