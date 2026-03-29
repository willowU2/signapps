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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Plus, Trash2, CheckCircle, XCircle, Clock, Send, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/hooks/use-page-title';

interface POItem { id: string; description: string; quantity: number; unitPrice: number; }
interface PO {
  id: string; number: string; supplier: string; status: 'draft' | 'pending' | 'approved' | 'rejected' | 'received';
  items: POItem[]; notes: string; createdAt: Date; updatedAt: Date; requestedBy: string; total: number;
}

const INITIAL_POS: PO[] = [
  { id: '1', number: 'PO-2026-041', supplier: 'TechSupply Corp', status: 'approved', items: [{ id: 'i1', description: 'USB-C Hub 7-in-1', quantity: 20, unitPrice: 79 }, { id: 'i2', description: 'HDMI Cable 2m', quantity: 30, unitPrice: 15 }], notes: 'Urgent — required for onboarding week', createdAt: new Date(Date.now() - 3 * 86400000), updatedAt: new Date(Date.now() - 86400000), requestedBy: 'Alice M.', total: 2030 },
  { id: '2', number: 'PO-2026-042', supplier: 'Office Essentials Ltd', status: 'pending', items: [{ id: 'i1', description: 'Standing Desk', quantity: 5, unitPrice: 599 }, { id: 'i2', description: 'Monitor Arm', quantity: 5, unitPrice: 89 }], notes: '', createdAt: new Date(Date.now() - 86400000), updatedAt: new Date(Date.now() - 86400000), requestedBy: 'Bob K.', total: 3440 },
  { id: '3', number: 'PO-2026-040', supplier: 'Paper & Co', status: 'received', items: [{ id: 'i1', description: 'A4 Paper 500-sheet reams', quantity: 100, unitPrice: 5 }], notes: '', createdAt: new Date(Date.now() - 7 * 86400000), updatedAt: new Date(Date.now() - 2 * 86400000), requestedBy: 'Carol P.', total: 500 },
];

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-muted text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', icon: FileText },
  pending: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  received: { label: 'Received', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: CheckCircle },
};

const nextPONumber = (pos: PO[]) => `PO-2026-0${(43 + pos.filter(p => !['PO-2026-041', 'PO-2026-042', 'PO-2026-040'].includes(p.number)).length).toString().padStart(2, '0')}`;

export default function PurchaseOrdersPage() {
  usePageTitle('Bons de commande');
  const [pos, setPos] = useState<PO[]>(INITIAL_POS);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<PO | null>(null);
  const [form, setForm] = useState({ supplier: '', notes: '' });
  const [items, setItems] = useState<POItem[]>([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
  const [activeTab, setActiveTab] = useState('all');

  const addItem = () => setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof POItem, val: string | number) => setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));

  const total = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);

  const handleCreate = (status: 'draft' | 'pending') => {
    if (!form.supplier.trim() || items.every(i => !i.description.trim())) { toast.error('Supplier and items required'); return; }
    const po: PO = { id: Date.now().toString(), number: nextPONumber(pos), supplier: form.supplier, status, items, notes: form.notes, createdAt: new Date(), updatedAt: new Date(), requestedBy: 'You', total };
    setPos([po, ...pos]);
    setForm({ supplier: '', notes: '' }); setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
    setOpen(false);
    toast.success(`PO ${po.number} ${status === 'draft' ? 'saved as draft' : 'submitted for approval'}!`);
  };

  const approve = (id: string) => { setPos(prev => prev.map(p => p.id === id ? { ...p, status: 'approved', updatedAt: new Date() } : p)); toast.success('PO approved!'); };
  const reject = (id: string) => { setPos(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected', updatedAt: new Date() } : p)); toast.success('PO rejected'); };
  const markReceived = (id: string) => { setPos(prev => prev.map(p => p.id === id ? { ...p, status: 'received', updatedAt: new Date() } : p)); toast.success('PO marked as received'); };

  const filtered = activeTab === 'all' ? pos : pos.filter(p => p.status === activeTab);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Purchase Orders</h1>
              <p className="text-sm text-muted-foreground">Create and manage POs with approval workflow</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New PO</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Supplier</Label><Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name..." className="mt-1" /></div>
                </div>
                <div>
                  <Label className="mb-2 block">Items</Label>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                        <Input className="col-span-5" placeholder="Description" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                        <Input className="col-span-2" type="number" min={1} placeholder="Qty" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', +e.target.value)} />
                        <Input className="col-span-3" type="number" min={0} step={0.01} placeholder="Unit €" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', +e.target.value)} />
                        <div className="col-span-1 text-xs text-muted-foreground text-right">€{(item.quantity * item.unitPrice).toFixed(0)}</div>
                        <Button variant="ghost" size="icon" className="col-span-1 h-7 w-7" onClick={() => removeItem(item.id)} disabled={items.length === 1}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add Item</Button>
                  </div>
                  <div className="flex justify-end mt-2 text-sm font-bold">Total: €{total.toFixed(2)}</div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={2} className="mt-1" /></div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleCreate('draft')}>Save Draft</Button>
                  <Button className="flex-1" onClick={() => handleCreate('pending')}><Send className="h-4 w-4 mr-2" />Submit for Approval</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            {['all', 'draft', 'pending', 'approved', 'rejected', 'received'].map(t => (
              <TabsTrigger key={t} value={t} className="capitalize">{t} {t !== 'all' && <span className="ml-1 text-xs">({pos.filter(p => p.status === t).length})</span>}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="space-y-3">
              {filtered.map(po => {
                const sc = statusConfig[po.status];
                const Icon = sc.icon;
                return (
                  <Card key={po.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm">{po.number}</span>
                            <Badge className={cn('text-xs', sc.color)}><Icon className="h-3 w-3 mr-1" />{sc.label}</Badge>
                          </div>
                          <p className="font-medium">{po.supplier}</p>
                          <p className="text-xs text-muted-foreground">{po.items.length} item{po.items.length > 1 ? 's' : ''} · Requested by {po.requestedBy} · {format(po.createdAt, 'MMM d, yyyy')}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">€{po.total.toLocaleString()}</div>
                          <div className="flex gap-2 mt-2 flex-wrap justify-end">
                            <Button size="sm" variant="outline" onClick={() => setViewing(po)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                            {po.status === 'pending' && <>
                              <Button size="sm" onClick={() => approve(po.id)} className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-3.5 w-3.5 mr-1" />Approve</Button>
                              <Button size="sm" variant="destructive" onClick={() => reject(po.id)}><XCircle className="h-3.5 w-3.5 mr-1" />Reject</Button>
                            </>}
                            {po.status === 'approved' && <Button size="sm" variant="outline" onClick={() => markReceived(po.id)}>Mark Received</Button>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filtered.length === 0 && <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-muted-foreground"><FileText className="h-8 w-8 mb-2 opacity-30" /><p>No purchase orders</p></CardContent></Card>}
            </div>
          </TabsContent>
        </Tabs>

        {/* PO Detail Dialog */}
        <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{viewing?.number} — {viewing?.supplier}</DialogTitle></DialogHeader>
            {viewing && (
              <div className="space-y-4">
                <Table>
                  <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {viewing.items.map(i => (
                      <TableRow key={i.id}>
                        <TableCell>{i.description}</TableCell>
                        <TableCell className="text-right">{i.quantity}</TableCell>
                        <TableCell className="text-right">€{i.unitPrice}</TableCell>
                        <TableCell className="text-right font-bold">€{(i.quantity * i.unitPrice).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow><TableCell colSpan={3} className="font-bold">Total</TableCell><TableCell className="text-right font-bold text-lg">€{viewing.total.toLocaleString()}</TableCell></TableRow>
                  </TableBody>
                </Table>
                {viewing.notes && <div className="bg-muted p-3 rounded text-sm"><span className="font-medium">Notes:</span> {viewing.notes}</div>}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
