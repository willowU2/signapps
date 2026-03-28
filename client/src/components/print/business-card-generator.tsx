'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Printer, Download } from 'lucide-react';
import { toast } from 'sonner';

interface CardData {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  bgColor: string;
  textColor: string;
}

const TEMPLATES = [
  { bg: '#1a1a2e', text: '#e2e8f0', label: 'Dark Pro' },
  { bg: '#ffffff', text: '#1e293b', label: 'Clean White' },
  { bg: '#6366f1', text: '#ffffff', label: 'Indigo' },
  { bg: '#0f172a', text: '#f8fafc', label: 'Midnight' },
  { bg: '#10b981', text: '#ffffff', label: 'Emerald' },
];

export function BusinessCardGenerator() {
  const [data, setData] = useState<CardData>({
    name: 'Etienne Dupont',
    title: 'CEO & Founder',
    company: 'SignApps',
    email: 'etienne@signapps.fr',
    phone: '+33 6 12 34 56 78',
    website: 'www.signapps.fr',
    address: 'Paris, France',
    bgColor: '#1a1a2e',
    textColor: '#e2e8f0',
  });
  const cardRef = useRef<HTMLDivElement>(null);

  const setTemplate = (t: typeof TEMPLATES[0]) => {
    setData(p => ({ ...p, bgColor: t.bg, textColor: t.text }));
  };

  const print = () => {
    if (!cardRef.current) return;
    const content = cardRef.current.outerHTML;
    const win = window.open('', '_blank', 'width=400,height=300');
    win?.document.write(`<html><head><style>
      body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
      @media print { body { background: white; } }
    </style></head><body>${content}</body></html>`);
    win?.document.close();
    win?.print();
    toast.success('Print dialog opened');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5 text-primary" />
            Business Card Generator
          </CardTitle>
          <Button size="sm" onClick={print} className="gap-1.5">
            <Printer className="h-4 w-4" />Print
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="flex justify-center py-4">
          <div
            ref={cardRef}
            className="rounded-xl shadow-2xl p-6 flex flex-col justify-between"
            style={{
              width: 340, height: 190,
              backgroundColor: data.bgColor, color: data.textColor,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div>
              <p className="text-xl font-bold">{data.name || 'Your Name'}</p>
              <p className="text-sm opacity-80 mt-0.5">{data.title}</p>
              {data.company && <p className="text-xs opacity-60 mt-0.5">{data.company}</p>}
            </div>
            <div className="space-y-0.5 text-xs opacity-80">
              {data.email && <p>✉ {data.email}</p>}
              {data.phone && <p>✆ {data.phone}</p>}
              {data.website && <p>🌐 {data.website}</p>}
              {data.address && <p>📍 {data.address}</p>}
            </div>
          </div>
        </div>

        {/* Templates */}
        <div className="flex gap-2 justify-center">
          {TEMPLATES.map(t => (
            <button key={t.label}
              onClick={() => setTemplate(t)}
              className="w-8 h-8 rounded-full border-2 border-transparent hover:border-primary transition-all"
              style={{ backgroundColor: t.bg }}
              title={t.label}
            />
          ))}
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3">
          {([
            ['name', 'Full Name'], ['title', 'Job Title'],
            ['company', 'Company'], ['email', 'Email'],
            ['phone', 'Phone'], ['website', 'Website'],
          ] as [keyof CardData, string][]).map(([field, label]) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                value={data[field] as string}
                onChange={e => setData(p => ({ ...p, [field]: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          ))}
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Address</Label>
            <Input value={data.address} onChange={e => setData(p => ({ ...p, address: e.target.value }))} className="h-8 text-sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
