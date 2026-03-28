'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Search, Plus, TrendingUp, TrendingDown, ArrowRight, ArrowLeft, Edit, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { usePageTitle } from '@/hooks/use-page-title';

interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minThreshold: number;
  maxThreshold: number;
  location: string;
  unit: string;
  lastMovement: Date;
  cost: number;
}

interface Movement {
  id: string;
  itemId: string;
  itemName: string;
  type: 'in' | 'out' | 'transfer';
  quantity: number;
  from?: string;
  to?: string;
  reason: string;
  date: Date;
  operator: string;
}

const ITEMS: StockItem[] = [
  { id: '1', sku: 'OFF-001', name: 'Office Chair', category: 'Furniture', quantity: 8, minThreshold: 5, maxThreshold: 30, location: 'Warehouse A', unit: 'pcs', lastMovement: new Date(Date.now() - 2 * 86400000), cost: 249 },
  { id: '2', sku: 'OFF-002', name: 'Standing Desk', category: 'Furniture', quantity: 3, minThreshold: 5, maxThreshold: 20, location: 'Warehouse A', unit: 'pcs', lastMovement: new Date(Date.now() - 86400000), cost: 599 },
  { id: '3', sku: 'IT-001', name: 'Laptop Stand', category: 'IT Equipment', quantity: 0, minThreshold: 3, maxThreshold: 15, location: 'Warehouse B', unit: 'pcs', lastMovement: new Date(Date.now() - 5 * 86400000), cost: 49 },
  { id: '4', sku: 'IT-002', name: 'USB-C Hub', category: 'IT Equipment', quantity: 45, minThreshold: 10, maxThreshold: 50, location: 'Warehouse B', unit: 'pcs', lastMovement: new Date(Date.now() - 3 * 86400000), cost: 79 },
  { id: '5', sku: 'SUP-001', name: 'A4 Paper (500 sheets)', category: 'Supplies', quantity: 220, minThreshold: 100, maxThreshold: 500, location: 'Storeroom 1', unit: 'reams', lastMovement: new Date(), cost: 5 },
  { id: '6', sku: 'SUP-002', name: 'Printer Ink Cartridge', category: 'Supplies', quantity: 2, minThreshold: 5, maxThreshold: 20, location: 'Storeroom 1', unit: 'pcs', lastMovement: new Date(Date.now() - 10 * 86400000), cost: 35 },
];

const MOVEMENTS: Movement[] = [
  { id: 'm1', itemId: '5', itemName: 'A4 Paper', type: 'in', quantity: 50, to: 'Storeroom 1', reason: 'Restocking', date: new Date(), operator: 'Alice M.' },
  { id: 'm2', itemId: '1', itemName: 'Office Chair', type: 'out', quantity: 2, from: 'Warehouse A', reason: 'Deployment — Office 3F', date: new Date(Date.now() - 2 * 86400000), operator: 'Bob K.' },
  { id: 'm3', itemId: '4', itemName: 'USB-C Hub', type: 'in', quantity: 20, to: 'Warehouse B', reason: 'PO-2026-041', date: new Date(Date.now() - 3 * 86400000), operator: 'Alice M.' },
];

const getStatus = (item: StockItem) => {
  if (item.quantity === 0) return 'out';
  if (item.quantity <= item.minThreshold) return 'low';
  if (item.quantity >= item.maxThreshold) return 'over';
  return 'ok';
};

const statusConfig = {
  out: { label: 'Out of Stock', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: AlertTriangle },
  low: { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: TrendingDown },
  over: { label: 'Overstock', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: TrendingUp },
  ok: { label: 'OK', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
};

export default function InventoryPage() {
  usePageTitle('Inventaire');
  const [items, setItems] = useState<StockItem[]>(ITEMS);
  const [movements, setMovements] = useState<Movement[]>(MOVEMENTS);
  const [search, setSearch] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveForm, setMoveForm] = useState({ itemId: '', type: 'in' as 'in' | 'out', quantity: 1, reason: '', location: '' });

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()));

  const handleMove = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find(i => i.id === moveForm.itemId);
    if (!item) return;
    if (moveForm.type === 'out' && moveForm.quantity > item.quantity) { toast.error('Insufficient stock'); return; }
    setItems(prev => prev.map(i => i.id === moveForm.itemId ? { ...i, quantity: moveForm.type === 'in' ? i.quantity + moveForm.quantity : i.quantity - moveForm.quantity, lastMovement: new Date() } : i));
    setMovements(prev => [{ id: Date.now().toString(), itemId: moveForm.itemId, itemName: item.name, type: moveForm.type, quantity: moveForm.quantity, [moveForm.type === 'in' ? 'to' : 'from']: item.location, reason: moveForm.reason, date: new Date(), operator: 'You' }, ...prev]);
    setMoveOpen(false);
    toast.success(`Stock movement recorded: ${moveForm.type === 'in' ? '+' : '-'}${moveForm.quantity} ${item.name}`);
  };

  const alerts = items.filter(i => getStatus(i) !== 'ok');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Inventory Management</h1>
              <p className="text-sm text-muted-foreground">Stock levels, locations, and movements</p>
            </div>
          </div>
          <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Stock Movement</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle></DialogHeader>
              <form onSubmit={handleMove} className="space-y-4">
                <div><Label>Item</Label>
                  <select value={moveForm.itemId} onChange={e => setMoveForm({ ...moveForm, itemId: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select item...</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name} (Stock: {i.quantity})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <select value={moveForm.type} onChange={e => setMoveForm({ ...moveForm, type: e.target.value as 'in' | 'out' })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="in">Inbound</option><option value="out">Outbound</option>
                    </select>
                  </div>
                  <div><Label>Quantity</Label><Input type="number" min={1} value={moveForm.quantity} onChange={e => setMoveForm({ ...moveForm, quantity: +e.target.value })} className="mt-1" /></div>
                </div>
                <div><Label>Reason</Label><Input value={moveForm.reason} onChange={e => setMoveForm({ ...moveForm, reason: e.target.value })} placeholder="e.g. PO-001, Deployment, Disposal..." className="mt-1" /></div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setMoveOpen(false)}>Annuler</Button>
                  <Button type="submit">Record Movement</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {alerts.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-yellow-600" /><span className="font-medium text-sm">{alerts.length} stock alert{alerts.length > 1 ? 's' : ''}</span></div>
              <div className="flex flex-wrap gap-2">
                {alerts.map(a => { const sc = statusConfig[getStatus(a)]; return <Badge key={a.id} className={sc.color}>{a.name}: {getStatus(a) === 'out' ? 'Rupture de stock' : getStatus(a) === 'low' ? `Low (${a.quantity})` : `Overstock (${a.quantity})`}</Badge>; })}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="stock">
          <TabsList><TabsTrigger value="stock">Stock ({items.length})</TabsTrigger><TabsTrigger value="movements">Movements ({movements.length})</TabsTrigger></TabsList>

          <TabsContent value="stock" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU, or category..." className="pl-9" />
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Last Movement</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filtered.map(item => {
                        const status = getStatus(item);
                        const sc = statusConfig[status];
                        const Icon = sc.icon;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                            <TableCell className="text-right font-bold">{item.quantity} {item.unit}</TableCell>
                            <TableCell className="text-sm">{item.location}</TableCell>
                            <TableCell><Badge className={cn('text-xs', sc.color)}><Icon className="h-3 w-3 mr-1" />{sc.label}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(item.lastMovement, 'MMM d')}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Location</TableHead><TableHead>Reason</TableHead><TableHead>Operator</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {movements.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{format(m.date, 'MMM d, HH:mm')}</TableCell>
                        <TableCell className="font-medium text-sm">{m.itemName}</TableCell>
                        <TableCell><Badge variant={m.type === 'in' ? 'default' : 'secondary'} className="text-xs flex items-center gap-1 w-fit">{m.type === 'in' ? <ArrowRight className="h-3 w-3" /> : <ArrowLeft className="h-3 w-3" />}{m.type === 'in' ? 'Inbound' : 'Outbound'}</Badge></TableCell>
                        <TableCell className={cn('text-right font-bold', m.type === 'in' ? 'text-green-600' : 'text-red-600')}>{m.type === 'in' ? '+' : '-'}{m.quantity}</TableCell>
                        <TableCell className="text-sm">{m.from || m.to}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.reason}</TableCell>
                        <TableCell className="text-sm">{m.operator}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
