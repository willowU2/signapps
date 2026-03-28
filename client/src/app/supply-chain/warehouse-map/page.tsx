'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Map, Plus, Edit, Package, AlertTriangle, CheckCircle, Warehouse, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/hooks/use-page-title';

interface Zone {
  id: string;
  code: string;
  name: string;
  type: 'storage' | 'receiving' | 'shipping' | 'cold' | 'office' | 'empty';
  capacity: number;
  used: number;
  items: string[];
  row: number;
  col: number;
  width: number;
  height: number;
}

const GRID_ROWS = 6;
const GRID_COLS = 8;

const INITIAL_ZONES: Zone[] = [
  { id: 'z1', code: 'A', name: 'Zone A — General Storage', type: 'storage', capacity: 500, used: 380, items: ['Office Chairs', 'Standing Desks', 'Monitors'], row: 0, col: 0, width: 3, height: 2 },
  { id: 'z2', code: 'B', name: 'Zone B — IT Equipment', type: 'storage', capacity: 300, used: 120, items: ['USB Hubs', 'Keyboards', 'Mice', 'Cables'], row: 0, col: 3, width: 3, height: 2 },
  { id: 'z3', code: 'RECV', name: 'Receiving Dock', type: 'receiving', capacity: 100, used: 15, items: [], row: 0, col: 6, width: 2, height: 1 },
  { id: 'z4', code: 'SHIP', name: 'Shipping Dock', type: 'shipping', capacity: 100, used: 5, items: [], row: 1, col: 6, width: 2, height: 1 },
  { id: 'z5', code: 'C', name: 'Storeroom 1 — Supplies', type: 'storage', capacity: 200, used: 180, items: ['A4 Paper', 'Printer Ink', 'Stationery'], row: 2, col: 0, width: 2, height: 2 },
  { id: 'z6', code: 'COLD', name: 'Cold Storage', type: 'cold', capacity: 50, used: 10, items: ['Temperature-sensitive items'], row: 2, col: 2, width: 2, height: 2 },
  { id: 'z7', code: 'D', name: 'Zone D — Overflow', type: 'storage', capacity: 150, used: 0, items: [], row: 2, col: 4, width: 2, height: 2 },
  { id: 'z8', code: 'OFF', name: 'Office / Admin', type: 'office', capacity: 0, used: 0, items: [], row: 4, col: 0, width: 8, height: 2 },
];

const typeConfig = {
  storage: { color: 'bg-blue-200 dark:bg-blue-800/50 border-blue-400 dark:border-blue-600', label: 'Storage', icon: Package },
  receiving: { color: 'bg-green-200 dark:bg-green-800/50 border-green-400 dark:border-green-600', label: 'Receiving', icon: Package },
  shipping: { color: 'bg-yellow-200 dark:bg-yellow-800/50 border-yellow-400 dark:border-yellow-600', label: 'Shipping', icon: Package },
  cold: { color: 'bg-cyan-200 dark:bg-cyan-800/50 border-cyan-400 dark:border-cyan-600', label: 'Cold', icon: Package },
  office: { color: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700', label: 'Office', icon: Package },
  empty: { color: 'bg-muted border-border', label: 'Empty', icon: Package },
};

const getOccupancy = (zone: Zone) => zone.capacity > 0 ? Math.round((zone.used / zone.capacity) * 100) : 0;

export default function WarehouseMapPage() {
  usePageTitle('Plan entrepot');
  const [zones, setZones] = useState<Zone[]>(INITIAL_ZONES);
  const [selected, setSelected] = useState<Zone | null>(null);
  const [search, setSearch] = useState('');

  const gridCells: Record<string, Zone> = {};
  zones.forEach(z => {
    for (let r = z.row; r < z.row + z.height; r++) {
      for (let c = z.col; c < z.col + z.width; c++) {
        gridCells[`${r}-${c}`] = z;
      }
    }
  });

  const renderedZones: Record<string, boolean> = {};
  const cells: React.ReactNode[] = [];

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const key = `${r}-${c}`;
      const zone = gridCells[key];
      if (!zone) {
        cells.push(<div key={key} className="border border-dashed border-muted-foreground/20 rounded aspect-square flex items-center justify-center text-xs text-muted-foreground/30">{r},{c}</div>);
        continue;
      }
      if (renderedZones[zone.id]) continue;
      renderedZones[zone.id] = true;
      const occ = getOccupancy(zone);
      const tc = typeConfig[zone.type as keyof typeof typeConfig];
      cells.push(
        <div key={zone.id} className={cn('border-2 rounded-lg p-2 cursor-pointer transition-all hover:shadow-md col-span-1 row-span-1 flex flex-col justify-between', tc.color, selected?.id === zone.id && 'ring-2 ring-primary')}
          style={{ gridColumn: `${c + 1} / span ${zone.width}`, gridRow: `${r + 1} / span ${zone.height}` }}
          onClick={() => setSelected(zone)}>
          <div>
            <div className="font-bold text-xs">{zone.code}</div>
            <div className="text-xs truncate leading-tight">{zone.name.split('—')[0].trim()}</div>
          </div>
          {zone.capacity > 0 && (
            <div className="mt-1">
              <div className="h-1 rounded-full bg-black/10 dark:bg-white/10">
                <div className={cn('h-1 rounded-full', occ >= 90 ? 'bg-red-500' : occ >= 70 ? 'bg-yellow-500' : 'bg-green-500')} style={{ width: `${occ}%` }} />
              </div>
              <div className="text-xs mt-0.5">{occ}%</div>
            </div>
          )}
        </div>
      );
    }
  }

  const filteredZones = zones.filter(z => !search || z.name.toLowerCase().includes(search.toLowerCase()) || z.items.some(i => i.toLowerCase().includes(search.toLowerCase())));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Map className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Warehouse Location Map</h1>
              <p className="text-sm text-muted-foreground">Visual layout editor for warehouse zones</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Warehouse className="h-4 w-4" />Warehouse Floor Plan</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-1 overflow-x-auto" style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridTemplateRows: `repeat(${GRID_ROWS}, 60px)` }}>
                  {cells}
                </div>
                <div className="flex flex-wrap gap-3 mt-4 text-xs">
                  {Object.entries(typeConfig).filter(([k]) => k !== 'empty').map(([type, { color, label }]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div className={cn('h-3 w-5 rounded border', color)} />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5"><div className="h-1 w-8 rounded-full" style={{ background: 'linear-gradient(to right, #22c55e, #eab308, #ef4444)' }} /><span className="text-muted-foreground">Occupancy</span></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Zone detail */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search zones..." className="pl-9 text-sm" />
            </div>
            {selected && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{selected.code} — Detail</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium text-sm">{selected.name}</p>
                    <Badge variant="secondary" className="text-xs mt-1 capitalize">{selected.type}</Badge>
                  </div>
                  {selected.capacity > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs"><span>Occupancy</span><span className="font-bold">{getOccupancy(selected)}%</span></div>
                      <div className="h-2 rounded-full bg-muted"><div className={cn('h-2 rounded-full', getOccupancy(selected) >= 90 ? 'bg-red-500' : getOccupancy(selected) >= 70 ? 'bg-yellow-500' : 'bg-green-500')} style={{ width: `${getOccupancy(selected)}%` }} /></div>
                      <div className="flex justify-between text-xs text-muted-foreground"><span>{selected.used} units used</span><span>{selected.capacity} capacity</span></div>
                    </div>
                  )}
                  {selected.items.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Contents</p>
                      <div className="space-y-1">
                        {selected.items.map(item => <div key={item} className="text-xs flex items-center gap-1.5"><Package className="h-3 w-3 text-muted-foreground" />{item}</div>)}
                      </div>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full" onClick={() => toast.success('Edit mode — location mapping updated')}><Edit className="h-3.5 w-3.5 mr-1" />Edit Zone</Button>
                </CardContent>
              </Card>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All Zones</p>
              {filteredZones.filter(z => z.type !== 'empty').map(z => {
                const occ = getOccupancy(z);
                return (
                  <button key={z.id} onClick={() => setSelected(z)} className={cn('w-full text-left p-2.5 rounded-lg border text-sm hover:bg-muted/50 transition-colors', selected?.id === z.id && 'border-primary bg-primary/5')}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{z.code}</span>
                      {occ >= 90 ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> : <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{z.name.split('—').pop()?.trim()}</p>
                    {z.capacity > 0 && <div className="text-xs text-muted-foreground">{occ}% full</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
