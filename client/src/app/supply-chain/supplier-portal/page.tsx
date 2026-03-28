'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Search, Star, Mail, Phone, Globe, Package, FileText, CheckCircle, Clock, XCircle, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/hooks/use-page-title';

interface Supplier {
  id: string;
  name: string;
  category: string;
  email: string;
  phone: string;
  website: string;
  status: 'active' | 'inactive' | 'pending';
  rating: number;
  ordersTotal: number;
  lastOrder?: Date;
  onTimeRate: number;
  contactPerson: string;
}

interface SupplierOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  poNumber: string;
  amount: number;
  status: 'sent' | 'confirmed' | 'shipped' | 'delivered' | 'invoiced';
  date: Date;
  expectedDelivery: Date;
}

const SUPPLIERS: Supplier[] = [
  { id: '1', name: 'TechSupply Corp', category: 'IT Equipment', email: 'orders@techsupply.com', phone: '+33 1 23 45 67 89', website: 'techsupply.com', status: 'active', rating: 4.8, ordersTotal: 24500, lastOrder: new Date(Date.now() - 3 * 86400000), onTimeRate: 96, contactPerson: 'Marc Durand' },
  { id: '2', name: 'Office Essentials Ltd', category: 'Furniture & Supplies', email: 'b2b@officeessentials.fr', phone: '+33 4 56 78 90 12', website: 'officeessentials.fr', status: 'active', rating: 4.5, ordersTotal: 18200, lastOrder: new Date(Date.now() - 86400000), onTimeRate: 89, contactPerson: 'Sophie Martin' },
  { id: '3', name: 'Paper & Co', category: 'Office Supplies', email: 'commercial@papersco.fr', phone: '+33 2 34 56 78 90', website: 'papersco.fr', status: 'active', rating: 4.2, ordersTotal: 3400, lastOrder: new Date(Date.now() - 7 * 86400000), onTimeRate: 92, contactPerson: 'Jean Bernard' },
  { id: '4', name: 'CleanPro Services', category: 'Cleaning & Maintenance', email: 'contact@cleanpro.fr', phone: '+33 5 67 89 01 23', website: 'cleanpro.fr', status: 'pending', rating: 0, ordersTotal: 0, onTimeRate: 0, contactPerson: 'Isabelle Leroy' },
];

const ORDERS: SupplierOrder[] = [
  { id: 'o1', supplierId: '1', supplierName: 'TechSupply Corp', poNumber: 'PO-2026-041', amount: 2030, status: 'shipped', date: new Date(Date.now() - 3 * 86400000), expectedDelivery: new Date(Date.now() + 2 * 86400000) },
  { id: 'o2', supplierId: '2', supplierName: 'Office Essentials Ltd', poNumber: 'PO-2026-042', amount: 3440, status: 'confirmed', date: new Date(Date.now() - 86400000), expectedDelivery: new Date(Date.now() + 5 * 86400000) },
  { id: 'o3', supplierId: '3', supplierName: 'Paper & Co', poNumber: 'PO-2026-040', amount: 500, status: 'delivered', date: new Date(Date.now() - 7 * 86400000), expectedDelivery: new Date(Date.now() - 2 * 86400000) },
];

const orderStatusConfig = {
  sent: { label: 'Sent', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  shipped: { label: 'Shipped', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  invoiced: { label: 'Invoiced', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
};

const supplierStatusConfig = {
  active: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  inactive: { color: 'bg-gray-100 text-gray-800' },
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => <Star key={n} className={cn('h-3.5 w-3.5', n <= value ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground')} />)}
    </div>
  );
}

export default function SupplierPortalPage() {
  usePageTitle('Portail fournisseurs');
  const [suppliers, setSuppliers] = useState<Supplier[]>(SUPPLIERS);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', email: '', phone: '', website: '', contactPerson: '' });

  const filtered = suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email required'); return; }
    const s: Supplier = { id: Date.now().toString(), ...form, status: 'pending', rating: 0, ordersTotal: 0, onTimeRate: 0 };
    setSuppliers([...suppliers, s]);
    setForm({ name: '', category: '', email: '', phone: '', website: '', contactPerson: '' });
    setOpen(false);
    toast.success('Supplier added and invitation sent!');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Supplier Portal</h1>
              <p className="text-sm text-muted-foreground">Self-service portal for suppliers — orders, invoices, and catalog</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Supplier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Supplier</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Company Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
                  <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. IT Equipment" className="mt-1" /></div>
                  <div><Label>Contact Person</Label><Input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} className="mt-1" /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
                  <div className="col-span-2"><Label>Website</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="mt-1" /></div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button type="submit">Add & Send Invite</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="suppliers">
          <TabsList><TabsTrigger value="suppliers">Suppliers ({suppliers.length})</TabsTrigger><TabsTrigger value="orders">Active Orders ({ORDERS.length})</TabsTrigger></TabsList>

          <TabsContent value="suppliers" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." className="pl-9" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(s => (
                <Card key={s.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 rounded-lg"><AvatarFallback className="rounded-lg text-xs font-bold">{s.name.slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-semibold text-sm leading-tight">{s.name}</h3>
                          <Badge className={cn('text-xs shrink-0 capitalize', supplierStatusConfig[s.status].color)}>{s.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.category}</p>
                        {s.rating > 0 && <StarRating value={s.rating} />}
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" /><span className="truncate">{s.email}</span></div>
                      <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{s.phone}</div>
                      {s.contactPerson && <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{s.contactPerson}</div>}
                    </div>
                    {s.ordersTotal > 0 && (
                      <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
                        <div><span className="text-muted-foreground">Total Orders</span><div className="font-bold">€{s.ordersTotal.toLocaleString()}</div></div>
                        <div><span className="text-muted-foreground">On-Time Rate</span><div className="font-bold text-green-600">{s.onTimeRate}%</div></div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success(`Email envoyé to ${s.name}`)}><Mail className="h-3.5 w-3.5 mr-1" />Contact</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success('Portal link copied')}><Globe className="h-3.5 w-3.5 mr-1" />Portal</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-4 space-y-3">
            {ORDERS.map(order => {
              const sc = orderStatusConfig[order.status];
              return (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="flex items-center gap-2"><span className="font-mono font-bold text-sm">{order.poNumber}</span><Badge className={cn('text-xs', sc.color)}>{sc.label}</Badge></div>
                        <p className="text-sm font-medium mt-0.5">{order.supplierName}</p>
                        <p className="text-xs text-muted-foreground">Ordered {format(order.date, 'MMM d')} · Expected {format(order.expectedDelivery, 'MMM d')}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">€{order.amount.toLocaleString()}</div>
                        <Button size="sm" variant="outline" className="mt-1" onClick={() => { const newStatus = order.status === 'confirmed' ? 'shipped' : order.status === 'shipped' ? 'delivered' : 'invoiced'; toast.success(`Status updated to ${newStatus}`); }}>Update Status</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
