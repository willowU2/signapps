'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface LetterheadConfig {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  accentColor: string;
  bodyText: string;
}

export function LetterheadTemplate() {
  const [cfg, setCfg] = useState<LetterheadConfig>({
    companyName: 'SignApps',
    tagline: 'La suite bureautique libre pour les TPE/PME',
    address: '12 Rue de la Innovation, 75001 Paris',
    phone: '+33 1 23 45 67 89',
    email: 'contact@signapps.fr',
    website: 'www.signapps.fr',
    accentColor: '#6366f1',
    bodyText: 'Objet : [Sujet de la lettre]\n\nMadame, Monsieur,\n\n[Corps de la lettre...]\n\nVeuillez agréer, Madame, Monsieur, l\'expression de mes salutations distinguées.\n\n[Signature]',
  });
  const previewRef = useRef<HTMLDivElement>(null);

  const COLORS = ['#6366f1', '#1e40af', '#065f46', '#991b1b', '#374151'];

  const print = () => {
    if (!previewRef.current) return;
    const win = window.open('', '_blank');
    win?.document.write(`<html><head><style>
      body{margin:0;padding:30px;font-family:Arial,sans-serif;max-width:794px;margin:0 auto;}
      @media print{body{padding:0;}}
    </style></head><body>${previewRef.current.innerHTML}</body></html>`);
    win?.document.close();
    win?.print();
    toast.success('Letterhead sent to printer');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Letterhead Template
          </CardTitle>
          <Button size="sm" onClick={print} className="gap-1.5">
            <Printer className="h-4 w-4" />Print
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div ref={previewRef} className="bg-white border rounded-lg overflow-hidden" style={{ minHeight: 400 }}>
          {/* Header */}
          <div className="px-8 py-5 border-b-4" style={{ borderColor: cfg.accentColor }}>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: cfg.accentColor }}>{cfg.companyName}</h1>
                <p className="text-xs text-gray-500 mt-0.5">{cfg.tagline}</p>
              </div>
              <div className="text-right text-xs text-gray-600 space-y-0.5">
                <p>{cfg.address}</p>
                <p>{cfg.phone}</p>
                <p>{cfg.email}</p>
                <p>{cfg.website}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6">
            <p className="text-xs text-right text-gray-500 mb-6">Paris, le {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{cfg.bodyText}</pre>
          </div>

          {/* Footer */}
          <div className="px-8 py-3 mt-auto border-t" style={{ borderColor: cfg.accentColor }}>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{cfg.companyName} — {cfg.address}</span>
              <span>{cfg.website}</span>
            </div>
          </div>
        </div>

        {/* Color selector */}
        <div className="flex gap-2">
          <span className="text-xs text-muted-foreground self-center">Color:</span>
          {COLORS.map(c => (
            <button key={c} onClick={() => setCfg(p => ({ ...p, accentColor: c }))}
              className={`w-6 h-6 rounded-full ${cfg.accentColor === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>

        {/* Edit fields */}
        <div className="grid grid-cols-2 gap-3">
          {([
            ['companyName', 'Company Name'], ['tagline', 'Tagline'],
            ['address', 'Address'], ['phone', 'Phone'],
            ['email', 'Email'], ['website', 'Website'],
          ] as [keyof LetterheadConfig, string][]).map(([f, l]) => (
            <div key={f} className="space-y-1">
              <Label className="text-xs">{l}</Label>
              <Input value={cfg[f] as string} onChange={e => setCfg(p => ({ ...p, [f]: e.target.value }))} className="h-8 text-sm" />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Body Text</Label>
          <Textarea value={cfg.bodyText} onChange={e => setCfg(p => ({ ...p, bodyText: e.target.value }))} rows={6} className="text-sm font-mono" />
        </div>
      </CardContent>
    </Card>
  );
}
