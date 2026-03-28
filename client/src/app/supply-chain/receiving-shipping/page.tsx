'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowDownToLine, ArrowUpFromLine, Plus, Package, CheckCircle, Clock, Truck, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type LogType = 'receiving' | 'shipping';
type LogStatus = 'pending' | 'in-progress' | 'completed' | 'issue';

interface GoodsLog {
  id: string;
  type: LogType;
  referenceNumber: string;
  poNumber?: string;
  carrier: string;
  items: string;
  quantity: number;
  unit: string;
  location: string;
  status: LogStatus;
  operator: string;
  notes: string;
  scheduledDate: Date;
  completedAt?: Date;
}

const LOGS: GoodsLog[] = [
  { id: '1', type: 'receiving', referenceNumber: 'RCV-2026-041', poNumber: 'PO-2026-041', carrier: 'DHL Express', items: 'USB-C Hub 7-in-1 x20, HDMI Cable x30', quantity: 50, unit: 'pcs', location: 'Zone B', status: 'in-progress', operator: 'Alice M.', notes: '', scheduledDate: new Date(Date.now() + 2 * 86400000) },
  { id: '2', type: 'receiving', referenceNumber: 'RCV-2026-040', poNumber: 'PO-2026-040', carrier: 'La Poste', items: 'A4 Paper 500-sheet reams x100', quantity: 100, unit: 'reams', location: 'Storeroom 1', status: 'completed', operator: 'Bob K.', notes: 'All items in good condition', scheduledDate: new Date(Date.now() - 2 * 86400000), completedAt: new Date(Date.now() - 2 * 86400000) },
  { id: '3', type: 'shipping', referenceNumber: 'SHP-2026-015', carrier: 'Chronopost', items: 'Surplus office chairs x3', quantity: 3, unit: 'pcs', location: 'Zone A', status: 'pending', operator: 'Carol P.', notes: 'Return to supplier', scheduledDate: new Date(Date.now() + 86400000) },
  { id: '4', type: 'shipping', referenceNumber: 'SHP-2026-014', carrier: 'DHL', items: 'Defective monitors x2', quantity: 2, unit: 'pcs', location: 'Shipping Dock', status: 'completed', operator: 'Dave L.', notes: 'RMA return — warranty claim', scheduledDate: new Date(Date.now() - 3 * 86400000), completedAt: new Date(Date.now() - 3 * 86400000) },
  { id: '5', type: 'receiving', referenceNumber: 'RCV-2026-039', poNumber: 'PO-2026-039', carrier: 'Geodis', items: 'Ergonomic chairs x5', quantity: 5, unit: 'pcs', location: 'Zone A', status: 'issue', operator: 'Alice M.', notes: 'Missing 2 units — contacting supplier', scheduledDate: new Date(Date.now() - 4 * 86400000) },
];

const statusConfig: Record<LogStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', icon: Clock },
  'in-progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Truck },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
  issue: { label: 'Issue', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: Package },
};

export default function ReceivingShippingPage() {
  const [logs, setLogs] = useState<GoodsLog[]>(LOGS);
  const [activeTab, setActiveTab] = useState<'all' | LogType>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'receiving' as LogType, referenceNumber: '', poNumber: '', carrier: '', items: '', quantity: 1, unit: 'pcs', location: '', notes: '' });

  const filtered = activeTab === 'all' ? logs : logs.filter(l => l.type === activeTab);
  const receiving = logs.filter(l => l.type === 'receiving');
  const shipping = logs.filter(l => l.type === 'shipping');

  const updateStatus = (id: string, status: LogStatus) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status, completedAt: status === 'completed' ? new Date() : undefined } : l));
    toast.success(`Status updated to ${status}`);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.referenceNumber.trim() || !form.items.trim()) { toast.error('Reference and items required'); return; }
    const log: GoodsLog = { id: Date.now().toString(), ...form, status: 'pending', operator: 'You', scheduledDate: new Date() };
    setLogs([log, ...logs]);
    setForm({ type: 'receiving', referenceNumber: '', poNumber: '', carrier: '', items: '', quantity: 1, unit: 'pcs', location: '', notes: '' });
    setOpen(false);
    toast.success('Log entry created!');
  };

  const stats = [
    { label: 'Pending Receiving', value: receiving.filter(l => l.status === 'pending').length, icon: ArrowDownToLine, color: 'text-green-600' },
    { label: 'Pending Shipping', value: shipping.filter(l => l.status === 'pending').length, icon: ArrowUpFromLine, color: 'text-blue-600' },
    { label: 'In Progress', value: logs.filter(l => l.status === 'in-progress').length, icon: Truck, color: 'text-yellow-600' },
    { label: 'Issues', value: logs.filter(l => l.status === 'issue').length, icon: Package, color: 'text-red-600' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ArrowDownToLine className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Receiving & Shipping Logs</h1>
              <p className="text-sm text-muted-foreground">Log and track all inbound and outbound goods</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Log Entry</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Goods Log</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as LogType })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="receiving">Receiving</option><option value="shipping">Shipping</option>
                    </select>
                  </div>
                  <div><Label>Reference #</Label><Input value={form.referenceNumber} onChange={e => setForm({ ...form, referenceNumber: e.target.value })} placeholder="RCV-2026-042" className="mt-1" /></div>
                  {form.type === 'receiving' && <div><Label>PO Number</Label><Input value={form.poNumber} onChange={e => setForm({ ...form, poNumber: e.target.value })} placeholder="PO-2026-..." className="mt-1" /></div>}
                  <div><Label>Carrier</Label><Input value={form.carrier} onChange={e => setForm({ ...form, carrier: e.target.value })} className="mt-1" /></div>
                </div>
                <div><Label>Items Description</Label><Textarea value={form.items} onChange={e => setForm({ ...form, items: e.target.value })} placeholder="List items..." rows={2} className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Quantity</Label><Input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: +e.target.value })} className="mt-1" /></div>
                  <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Zone A, Dock 2..." className="mt-1" /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1" /></div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Entry</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}><CardContent className="p-4 flex items-center gap-3"><Icon className={cn('h-6 w-6', color)} /><div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div></CardContent></Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all">All ({logs.length})</TabsTrigger>
            <TabsTrigger value="receiving">Receiving ({receiving.length})</TabsTrigger>
            <TabsTrigger value="shipping">Shipping ({shipping.length})</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4">
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Ref</TableHead><TableHead>Type</TableHead><TableHead>Items</TableHead>
                    <TableHead>Carrier</TableHead><TableHead>Location</TableHead><TableHead>Operator</TableHead>
                    <TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.map(log => {
                      const sc = statusConfig[log.status];
                      const Icon = sc.icon;
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="font-mono text-xs font-bold">{log.referenceNumber}</div>
                            {log.poNumber && <div className="text-xs text-muted-foreground">{log.poNumber}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs', log.type === 'receiving' ? 'text-green-600' : 'text-blue-600')}>
                              {log.type === 'receiving' ? <ArrowDownToLine className="h-3 w-3 mr-1" /> : <ArrowUpFromLine className="h-3 w-3 mr-1" />}
                              {log.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px]"><p className="text-sm truncate" title={log.items}>{log.items}</p><p className="text-xs text-muted-foreground">{log.quantity} {log.unit}</p></TableCell>
                          <TableCell className="text-sm">{log.carrier}</TableCell>
                          <TableCell className="text-sm"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{log.location}</span></TableCell>
                          <TableCell className="text-sm"><span className="flex items-center gap-1"><User className="h-3 w-3" />{log.operator}</span></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(log.scheduledDate, 'MMM d')}</TableCell>
                          <TableCell><Badge className={cn('text-xs', sc.color)}><Icon className="h-3 w-3 mr-1" />{sc.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {log.status === 'pending' && <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => updateStatus(log.id, 'in-progress')}>Start</Button>}
                              {log.status === 'in-progress' && <Button size="sm" className="h-6 text-xs px-2" onClick={() => updateStatus(log.id, 'completed')}>Complete</Button>}
                              {log.status === 'in-progress' && <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={() => updateStatus(log.id, 'issue')}>Issue</Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
