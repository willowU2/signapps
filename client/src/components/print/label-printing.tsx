'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tag, Printer, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const AVERY_FORMATS = [
  { id: '5160', label: 'Avery 5160 — 3×10 (30/page)', cols: 3, rows: 10, width: 190, height: 70 },
  { id: '5163', label: 'Avery 5163 — 2×5 (10/page)', cols: 2, rows: 5, width: 290, height: 130 },
  { id: '5164', label: 'Avery 5164 — 2×3 (6/page)', cols: 2, rows: 3, width: 290, height: 220 },
  { id: 'custom', label: 'Custom', cols: 2, rows: 4, width: 240, height: 120 },
];

interface LabelData {
  line1: string;
  line2: string;
  line3: string;
}

export function LabelPrinting() {
  const [format, setFormat] = useState(AVERY_FORMATS[0]);
  const [labels, setLabels] = useState<LabelData[]>([
    { line1: 'Jean Martin', line2: '12 Rue de la Paix', line3: '75001 Paris, France' },
  ]);
  const [copies, setCopies] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  const addLabel = () => setLabels(p => [...p, { line1: '', line2: '', line3: '' }]);
  const remove = (i: number) => setLabels(p => p.filter((_, j) => j !== i));
  const update = (i: number, field: keyof LabelData, val: string) =>
    setLabels(p => p.map((l, j) => j === i ? { ...l, [field]: val } : l));

  const print = () => {
    if (!printRef.current) return;
    const all = Array.from({ length: copies }, () => labels).flat();
    const labelHtml = all.map(l => `
      <div style="display:inline-block;width:${format.width}px;height:${format.height}px;padding:8px;box-sizing:border-box;vertical-align:top;border:1px dashed #ccc;overflow:hidden;">
        <p style="margin:0;font-size:13px;font-weight:bold;">${l.line1}</p>
        ${l.line2 ? `<p style="margin:2px 0 0;font-size:11px;">${l.line2}</p>` : ''}
        ${l.line3 ? `<p style="margin:2px 0 0;font-size:11px;">${l.line3}</p>` : ''}
      </div>
    `).join('');

    const win = window.open('', '_blank');
    win?.document.write(`<html><head><style>
      body{margin:0;padding:10px;font-family:Arial,sans-serif;}
      @media print{.no-print{display:none!important}div{border:none!important}}
    </style></head><body><div style="line-height:0;">${labelHtml}</div></body></html>`);
    win?.document.close();
    win?.print();
    toast.success('Labels sent to print');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-5 w-5 text-primary" />
            Label Printing (Avery)
          </CardTitle>
          <Button size="sm" onClick={print} className="gap-1.5">
            <Printer className="h-4 w-4" />Print Labels
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Avery Format</Label>
            <Select value={format.id} onValueChange={id => setFormat(AVERY_FORMATS.find(f => f.id === id) || AVERY_FORMATS[0])}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AVERY_FORMATS.map(f => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Copies per label</Label>
            <Input type="number" min={1} max={10} value={copies} onChange={e => setCopies(Number(e.target.value))} className="h-8 text-sm" />
          </div>
        </div>

        {/* Label preview */}
        <div ref={printRef} className="border rounded-lg p-3 bg-white overflow-auto max-h-40">
          <div className="flex flex-wrap gap-1">
            {labels.slice(0, 6).map((l, i) => (
              <div key={i} className="text-xs border border-dashed border-gray-300 rounded p-2"
                style={{ width: Math.min(format.width / 2, 160) }}>
                <p className="font-semibold truncate">{l.line1 || '—'}</p>
                {l.line2 && <p className="truncate text-gray-600">{l.line2}</p>}
                {l.line3 && <p className="truncate text-gray-600">{l.line3}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Label editor */}
        <div className="space-y-2">
          {labels.map((l, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Label {i + 1}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input value={l.line1} onChange={e => update(i, 'line1', e.target.value)} placeholder="Line 1 (Name)" className="h-7 text-xs" />
              <Input value={l.line2} onChange={e => update(i, 'line2', e.target.value)} placeholder="Line 2 (Address)" className="h-7 text-xs" />
              <Input value={l.line3} onChange={e => update(i, 'line3', e.target.value)} placeholder="Line 3 (City, Country)" className="h-7 text-xs" />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addLabel} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Add Label
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
