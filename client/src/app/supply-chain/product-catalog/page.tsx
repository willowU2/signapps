'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag, Search, Plus, Edit, Trash2, Tag, Package, ImageIcon, Star } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  tags: string[];
  active: boolean;
  image?: string;
  featured: boolean;
}

const PRODUCTS: Product[] = [
  { id: '1', sku: 'OFF-001', name: 'Office Chair Ergonomic', description: 'Height-adjustable ergonomic chair with lumbar support and breathable mesh back.', category: 'Furniture', price: 299, cost: 180, stock: 8, unit: 'pcs', tags: ['chair', 'ergonomic', 'office'], active: true, featured: true },
  { id: '2', sku: 'OFF-002', name: 'Standing Desk Electric', description: 'Electric height-adjustable standing desk. 140x70cm surface. 2-motor system.', category: 'Furniture', price: 699, cost: 420, stock: 3, unit: 'pcs', tags: ['desk', 'standing', 'electric'], active: true, featured: true },
  { id: '3', sku: 'IT-001', name: 'Laptop Stand Aluminium', description: 'Premium aluminum laptop stand with adjustable height and angle.', category: 'IT Equipment', price: 59, cost: 25, stock: 0, unit: 'pcs', tags: ['laptop', 'stand', 'aluminium'], active: true, featured: false },
  { id: '4', sku: 'IT-002', name: 'USB-C Hub 7-in-1', description: 'USB-C hub with HDMI 4K, 3x USB-A, SD card reader, and PD charging.', category: 'IT Equipment', price: 89, cost: 45, stock: 45, unit: 'pcs', tags: ['usb', 'hub', 'dongle'], active: true, featured: false },
  { id: '5', sku: 'SUP-001', name: 'A4 Paper 500 sheets', description: 'Premium quality A4 office paper, 80g/m², bright white, ream of 500 sheets.', category: 'Supplies', price: 7, cost: 4, stock: 220, unit: 'reams', tags: ['paper', 'a4', 'printing'], active: true, featured: false },
  { id: '6', sku: 'IT-003', name: 'Wireless Keyboard + Mouse', description: 'Compact wireless keyboard and mouse combo. 2.4GHz receiver. 12-month battery.', category: 'IT Equipment', price: 79, cost: 35, stock: 12, unit: 'sets', tags: ['keyboard', 'mouse', 'wireless'], active: true, featured: true },
];

const CATEGORIES = ['All', 'Furniture', 'IT Equipment', 'Supplies'];

const categoryColors: Record<string, string> = {
  Furniture: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'IT Equipment': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Supplies: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export default function ProductCatalogPage() {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [form, setForm] = useState({ sku: '', name: '', description: '', category: 'Furniture', price: 0, cost: 0, unit: 'pcs', tags: '' });

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || p.tags.some(t => t.includes(search.toLowerCase()));
    const matchCat = category === 'All' || p.category === category;
    return matchSearch && matchCat;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) { toast.error('SKU and name required'); return; }
    const p: Product = { id: Date.now().toString(), ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), stock: 0, active: true, featured: false };
    setProducts([...products, p]);
    setForm({ sku: '', name: '', description: '', category: 'Furniture', price: 0, cost: 0, unit: 'pcs', tags: '' });
    setOpen(false);
    toast.success('Product added to catalog!');
  };

  const toggleFeatured = (id: string) => setProducts(prev => prev.map(p => p.id === id ? { ...p, featured: !p.featured } : p));
  const toggleActive = (id: string) => { setProducts(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p)); toast.success('Product status updated'); };
  const remove = (id: string) => { setProducts(prev => prev.filter(p => p.id !== id)); toast.success('Product removed'); };

  const margin = (p: Product) => p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Product Catalog</h1>
              <p className="text-sm text-muted-foreground">Manage SKUs, categories, and product information</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Product</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="OFF-001" className="mt-1" /></div>
                  <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs" className="mt-1" /></div>
                </div>
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1" /></div>
                <div><Label>Category</Label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price (€)</Label><Input type="number" min={0} step={0.01} value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} className="mt-1" /></div>
                  <div><Label>Cost (€)</Label><Input type="number" min={0} step={0.01} value={form.cost} onChange={e => setForm({ ...form, cost: +e.target.value })} className="mt-1" /></div>
                </div>
                <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="chair, ergonomic, office" className="mt-1" /></div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Add Product</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" /></div>
          <div className="flex gap-2">{CATEGORIES.map(c => <Button key={c} size="sm" variant={category === c ? 'default' : 'outline'} onClick={() => setCategory(c)}>{c}</Button>)}</div>
        </div>

        <div className={cn('grid gap-4', view === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1')}>
          {filtered.map(product => (
            <Card key={product.id} className={cn('hover:shadow-md transition-shadow', !product.active && 'opacity-60')}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
                        <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
                      </div>
                      <div className="flex gap-0.5">
                        <button onClick={() => toggleFeatured(product.id)} title="Toggle featured">
                          <Star className={cn('h-4 w-4', product.featured ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground')} />
                        </button>
                      </div>
                    </div>
                    <Badge className={cn('text-xs mt-1', categoryColors[product.category] || '')}>{product.category}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                <div className="flex flex-wrap gap-1">
                  {product.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/50 rounded p-2"><div className="text-muted-foreground">Price</div><div className="font-bold">€{product.price}</div></div>
                  <div className="bg-muted/50 rounded p-2"><div className="text-muted-foreground">Margin</div><div className={cn('font-bold', margin(product) >= 30 ? 'text-green-600' : 'text-orange-600')}>{margin(product)}%</div></div>
                  <div className="bg-muted/50 rounded p-2"><div className="text-muted-foreground">Stock</div><div className={cn('font-bold', product.stock === 0 ? 'text-red-600' : '')}>{product.stock} {product.unit}</div></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success('Edit mode (demo)')}><Edit className="h-3.5 w-3.5 mr-1" />Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(product.id)} className="px-2" title={product.active ? 'Deactivate' : 'Activate'}>{product.active ? <Package className="h-3.5 w-3.5 text-green-500" /> : <Package className="h-3.5 w-3.5 text-muted-foreground" />}</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(product.id)} className="px-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {filtered.length === 0 && <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-muted-foreground"><ShoppingBag className="h-8 w-8 mb-2 opacity-30" /><p>No products found</p></CardContent></Card>}
      </div>
    </AppLayout>
  );
}
