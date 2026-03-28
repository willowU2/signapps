'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Award, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface CertData {
  title: string;
  recipient: string;
  achievement: string;
  description: string;
  date: string;
  issuer: string;
  issuerTitle: string;
  borderColor: string;
}

export function CertificateGenerator() {
  const [cert, setCert] = useState<CertData>({
    title: 'Certificate of Achievement',
    recipient: 'Jean-Pierre Martin',
    achievement: 'Completion of SignApps Platform Training',
    description: 'Has successfully completed all required modules and demonstrated proficiency in using the SignApps Platform for business operations.',
    date: new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }),
    issuer: 'Etienne Dupont',
    issuerTitle: 'CEO, SignApps',
    borderColor: '#6366f1',
  });
  const certRef = useRef<HTMLDivElement>(null);

  const BORDER_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4'];

  const print = () => {
    if (!certRef.current) return;
    const win = window.open('', '_blank', 'width=900,height=650');
    win?.document.write(`<html><head><style>
      body { margin: 0; padding: 20px; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
      @media print { body { background: white; padding: 0; } }
    </style></head><body>${certRef.current.outerHTML}</body></html>`);
    win?.document.close();
    win?.print();
    toast.success('Print dialog opened');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-5 w-5 text-primary" />
            Certificate Generator
          </CardTitle>
          <Button size="sm" onClick={print} className="gap-1.5">
            <Printer className="h-4 w-4" />Print
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Certificate Preview */}
        <div className="overflow-x-auto">
          <div
            ref={certRef}
            className="bg-white shadow-xl mx-auto text-center relative"
            style={{
              width: 700, minHeight: 500, padding: '40px 60px',
              border: `12px solid ${cert.borderColor}`,
              outline: `3px solid ${cert.borderColor}`,
              outlineOffset: '6px',
              fontFamily: 'Georgia, serif',
            }}
          >
            {/* Corner decorations */}
            {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
              <div key={i} className={`absolute ${pos} w-8 h-8 opacity-30`}
                style={{ border: `3px solid ${cert.borderColor}`, borderRadius: i < 2 ? '0 0 8px 0' : '8px 0 0 0' }} />
            ))}

            <div className="mb-4">
              <Award className="h-14 w-14 mx-auto mb-2" style={{ color: cert.borderColor }} />
              <h1 className="text-3xl font-bold" style={{ color: '#1e293b', letterSpacing: '0.05em' }}>{cert.title}</h1>
            </div>

            <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">This is to certify that</p>
            <p className="text-4xl font-bold italic mb-2" style={{ color: cert.borderColor }}>{cert.recipient}</p>
            <p className="text-sm text-gray-500 mb-3">has successfully completed</p>
            <p className="text-xl font-semibold text-gray-800 mb-4">{cert.achievement}</p>
            <p className="text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">{cert.description}</p>

            <div className="mt-10 flex justify-between items-end px-8">
              <div className="text-center">
                <div className="border-t-2 border-gray-400 w-40 pt-2">
                  <p className="text-sm font-semibold text-gray-700">{cert.issuer}</p>
                  <p className="text-xs text-gray-500">{cert.issuerTitle}</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">{cert.date}</p>
                <p className="text-xs text-gray-400 mt-1">Date of Issue</p>
              </div>
            </div>
          </div>
        </div>

        {/* Border color selector */}
        <div className="flex gap-2 justify-center">
          {BORDER_COLORS.map(c => (
            <button key={c} onClick={() => setCert(p => ({ ...p, borderColor: c }))}
              className={`w-7 h-7 rounded-full ${cert.borderColor === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>

        {/* Edit fields */}
        <div className="grid grid-cols-2 gap-3">
          {([
            ['title', 'Certificate Title'],
            ['recipient', 'Recipient Name'],
            ['achievement', 'Achievement'],
            ['date', 'Date'],
            ['issuer', 'Issuer Name'],
            ['issuerTitle', 'Issuer Title'],
          ] as [keyof CertData, string][]).map(([field, label]) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input value={cert[field] as string} onChange={e => setCert(p => ({ ...p, [field]: e.target.value }))} className="h-8 text-sm" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
