'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Truck, CheckCircle2, Circle, Package, MapPin, Clock, Search, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/hooks/use-page-title';

interface TrackingEvent {
  id: string;
  status: string;
  location: string;
  timestamp: Date;
  note?: string;
}

interface Shipment {
  id: string;
  trackingNumber: string;
  poNumber: string;
  supplier: string;
  carrier: string;
  origin: string;
  destination: string;
  status: 'processing' | 'picked-up' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'delayed';
  estimatedDelivery: Date;
  weight: string;
  items: number;
  events: TrackingEvent[];
}

const SHIPMENTS: Shipment[] = [
  {
    id: '1', trackingNumber: 'SP-2026-00841', poNumber: 'PO-2026-041', supplier: 'TechSupply Corp', carrier: 'DHL Express', origin: 'Lyon, FR', destination: 'Paris, FR', status: 'in-transit', estimatedDelivery: new Date(Date.now() + 2 * 86400000), weight: '8.5 kg', items: 50,
    events: [
      { id: 'e1', status: 'Order Confirmed', location: 'Lyon, FR', timestamp: new Date(Date.now() - 3 * 86400000) },
      { id: 'e2', status: 'Picked Up', location: 'Lyon DHL Hub', timestamp: new Date(Date.now() - 2 * 86400000), note: 'Package collected by DHL' },
      { id: 'e3', status: 'In Transit', location: 'Paris CDG Hub', timestamp: new Date(Date.now() - 86400000), note: 'Arrived at Paris sorting facility' },
      { id: 'e4', status: 'Out for Delivery', location: 'Paris 75001', timestamp: new Date(Date.now() + 2 * 86400000), note: 'Scheduled for delivery' },
    ],
  },
  {
    id: '2', trackingNumber: 'SP-2026-00839', poNumber: 'PO-2026-042', supplier: 'Office Essentials Ltd', carrier: 'Chronopost', origin: 'Bordeaux, FR', destination: 'Paris, FR', status: 'processing', estimatedDelivery: new Date(Date.now() + 5 * 86400000), weight: '45 kg', items: 10,
    events: [
      { id: 'e1', status: 'Order Confirmed', location: 'Bordeaux, FR', timestamp: new Date(Date.now() - 86400000) },
      { id: 'e2', status: 'Preparing Shipment', location: 'Bordeaux Warehouse', timestamp: new Date(Date.now() - 12 * 3600000) },
    ],
  },
  {
    id: '3', trackingNumber: 'SP-2026-00825', poNumber: 'PO-2026-040', supplier: 'Paper & Co', carrier: 'La Poste', origin: 'Marseille, FR', destination: 'Paris, FR', status: 'delivered', estimatedDelivery: new Date(Date.now() - 2 * 86400000), weight: '25 kg', items: 100,
    events: [
      { id: 'e1', status: 'Order Confirmed', location: 'Marseille, FR', timestamp: new Date(Date.now() - 7 * 86400000) },
      { id: 'e2', status: 'Picked Up', location: 'Marseille Hub', timestamp: new Date(Date.now() - 6 * 86400000) },
      { id: 'e3', status: 'In Transit', location: 'Lyon Sorting Center', timestamp: new Date(Date.now() - 5 * 86400000) },
      { id: 'e4', status: 'Out for Delivery', location: 'Paris 75001', timestamp: new Date(Date.now() - 3 * 86400000) },
      { id: 'e5', status: 'Delivered', location: 'Paris Office - Reception', timestamp: new Date(Date.now() - 2 * 86400000), note: 'Signed by: Reception Team' },
    ],
  },
];

const statusConfig = {
  processing: { label: 'Processing', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', step: 0 },
  'picked-up': { label: 'Picked Up', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', step: 1 },
  'in-transit': { label: 'In Transit', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', step: 2 },
  'out-for-delivery': { label: 'Out for Delivery', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', step: 3 },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', step: 4 },
  delayed: { label: 'Delayed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', step: 2 },
};

const STEPS = ['Processing', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'];

export default function DeliveryTrackingPage() {
  usePageTitle('Suivi livraisons');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Shipment>(SHIPMENTS[0]);

  const filtered = SHIPMENTS.filter(s => !search || s.trackingNumber.toLowerCase().includes(search.toLowerCase()) || s.poNumber.toLowerCase().includes(search.toLowerCase()) || s.supplier.toLowerCase().includes(search.toLowerCase()));

  const sc = statusConfig[selected.status];
  const currentStep = sc.step;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Delivery Tracking</h1>
            <p className="text-sm text-muted-foreground">Real-time shipment status and timeline</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shipment list */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
            </div>
            {filtered.map(s => {
              const ssc = statusConfig[s.status];
              return (
                <Card key={s.id} className={cn('cursor-pointer hover:shadow-md transition-shadow', selected.id === s.id && 'border-primary')} onClick={() => setSelected(s)}>
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">{s.trackingNumber}</span>
                      <Badge className={cn('text-xs', ssc.color)}>{ssc.label}</Badge>
                    </div>
                    <p className="text-sm font-medium">{s.supplier}</p>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>{s.carrier}</span>
                      <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{format(s.estimatedDelivery, 'MMM d')}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tracking detail */}
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold">{selected.trackingNumber}</span>
                      <Badge className={cn('text-xs', sc.color)}>{sc.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{selected.poNumber} · {selected.supplier} · {selected.carrier}</p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="flex items-center gap-1 justify-end"><Clock className="h-3.5 w-3.5" />ETA: <span className="font-bold">{format(selected.estimatedDelivery, 'MMM d, yyyy')}</span></div>
                    <p className="text-muted-foreground">{selected.items} items · {selected.weight}</p>
                  </div>
                </div>

                {/* Progress steps */}
                <div className="flex items-center justify-between mb-8">
                  {STEPS.map((step, i) => {
                    const done = i < currentStep;
                    const active = i === currentStep;
                    return (
                      <div key={step} className="flex flex-col items-center flex-1">
                        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors', done || selected.status === 'delivered' ? 'bg-green-500 border-green-500 text-white' : active ? 'border-primary text-primary bg-primary/10' : 'border-muted-foreground/30 text-muted-foreground/30')}>
                          {done || selected.status === 'delivered' ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                        </div>
                        <span className={cn('text-xs mt-1 text-center hidden sm:block', active ? 'font-bold text-primary' : done ? 'text-muted-foreground' : 'text-muted-foreground/50')}>{step}</span>
                        {i < STEPS.length - 1 && <div className="absolute" />}
                      </div>
                    );
                  })}
                </div>

                {/* Route */}
                <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg p-3 mb-6">
                  <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-blue-500" /><span>{selected.origin}</span></div>
                  <div className="flex-1 h-px bg-border relative"><Truck className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" /></div>
                  <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-green-500" /><span>{selected.destination}</span></div>
                </div>

                {/* Timeline */}
                <h3 className="font-semibold text-sm mb-4">Tracking History</h3>
                <div className="space-y-4">
                  {[...selected.events].reverse().map((event, i, arr) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center border-2', i === 0 ? 'bg-primary border-primary text-primary-foreground' : 'border-muted bg-muted')}>
                          {i === 0 ? <Truck className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        {i < arr.length - 1 && <div className="w-0.5 bg-border flex-1 mt-1" />}
                      </div>
                      <div className="pb-4 flex-1">
                        <p className={cn('text-sm font-medium', i === 0 && 'text-primary')}>{event.status}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>
                          <span>{format(event.timestamp, 'MMM d, HH:mm')}</span>
                        </div>
                        {event.note && <p className="text-xs text-muted-foreground mt-0.5">{event.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
