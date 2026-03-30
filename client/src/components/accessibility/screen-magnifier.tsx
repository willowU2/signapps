'use client';

import { useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** CSS zoom is non-standard but supported in Webkit/Blink — not in TS types */
type ZoomableStyle = CSSStyleDeclaration & { zoom: string };

interface MagnifierProps {
  zoom?: number;
}

export function ScreenMagnifier({ zoom = 1.25 }: MagnifierProps) {
  const [enabled, setEnabled] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(zoom);

  useEffect(() => {
    const style = document.body.style as ZoomableStyle;
    if (enabled) {
      // Use CSS zoom for Webkit/Blink browsers, which natively scales the entire interface
      // Since it's an accessibility feature, global zoom is much better than a broken fake lens.
      style.zoom = currentZoom.toString();
    } else {
      style.zoom = '1';
    }

    return () => {
      style.zoom = '1';
    };
  }, [enabled, currentZoom]);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={enabled ? 'default' : 'outline'}
        onClick={() => setEnabled(!enabled)}
        className="gap-2"
        aria-label="Toggle screen magnifier"
      >
        <ZoomIn className="h-4 w-4" />
        {enabled ? 'Magnifier Actif' : 'Activer Magnifier'}
      </Button>
      
      {enabled && (
        <div className="flex items-center gap-1 bg-muted p-1 rounded-md border">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-sm hover:bg-background"
            onClick={() => setCurrentZoom(z => Math.max(1.1, z - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-xs font-medium text-muted-foreground w-12 text-center">
            {Math.round(currentZoom * 100)}%
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-sm hover:bg-background"
            onClick={() => setCurrentZoom(z => Math.min(3, z + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-4 bg-border mx-1" />
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive" 
            onClick={() => setEnabled(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
