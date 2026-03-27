'use client';

// IDEA-125: Dashboard PDF export — capture current dashboard layout as PDF

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileDown, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

type ExportStatus = 'idle' | 'capturing' | 'generating' | 'done' | 'error';

async function captureDashboardAsPdf(): Promise<void> {
  // Use browser's native print to PDF — no dependencies needed
  // We inject a print stylesheet to format the dashboard nicely
  const styleEl = document.createElement('style');
  styleEl.id = 'dashboard-print-styles';
  styleEl.textContent = `
    @media print {
      body * { visibility: hidden; }
      #dashboard-print-area, #dashboard-print-area * { visibility: visible; }
      #dashboard-print-area {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
      }
      .widget-drag-handle, button[aria-label="delete"], .no-print { display: none !important; }
      .react-grid-item { break-inside: avoid; }
      @page { size: A4 landscape; margin: 1cm; }
    }
  `;
  document.head.appendChild(styleEl);

  // Add print area wrapper to widget grid
  const gridEl = document.querySelector('.layout');
  if (gridEl) {
    gridEl.id = 'dashboard-print-area';
  }

  // Trigger print dialog (browser handles PDF export)
  window.print();

  // Cleanup
  setTimeout(() => {
    document.head.removeChild(styleEl);
    if (gridEl) gridEl.removeAttribute('id');
  }, 1000);
}

interface DashboardPdfExportProps {
  className?: string;
}

export function DashboardPdfExportButton({ className }: DashboardPdfExportProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ExportStatus>('idle');

  const handleExport = async () => {
    setStatus('capturing');
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      setStatus('generating');
      await captureDashboardAsPdf();
      setStatus('done');
      setTimeout(() => {
        setStatus('idle');
        setOpen(false);
      }, 1500);
    } catch {
      setStatus('error');
      toast.error('Erreur lors de l\'export PDF');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const statusMessages: Record<ExportStatus, string> = {
    idle: 'Exporter en PDF',
    capturing: 'Capture du dashboard…',
    generating: 'Ouverture du dialog d\'impression…',
    done: 'Export lancé !',
    error: 'Erreur lors de l\'export',
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        <FileDown className="h-4 w-4 mr-1.5" />
        Export PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Exporter le dashboard en PDF</DialogTitle>
            <DialogDescription>
              Votre dashboard sera capturé dans son état actuel et exporté via la boîte de dialogue d&apos;impression du navigateur. Sélectionnez &ldquo;Enregistrer en PDF&rdquo; comme destination.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                Tous les widgets visibles seront inclus
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                Format A4 paysage recommandé
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                Aucune donnée n&apos;est transmise à l&apos;extérieur
              </li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleExport}
              disabled={status !== 'idle'}
              className="gap-2"
            >
              {status === 'idle' ? (
                <>
                  <FileDown className="h-4 w-4" />
                  Exporter
                </>
              ) : status === 'done' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {statusMessages[status]}
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {statusMessages[status]}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
