'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BookOpen, Plus, Search, Tag } from 'lucide-react';

interface Decision {
  id: string;
  title: string;
  date: string;
  category: 'architecture' | 'business' | 'technical' | 'process';
  status: 'active' | 'superseded' | 'deprecated';
  context: string;
  decision: string;
  consequences: string;
  author: string;
}

const CATEGORY_COLORS = {
  architecture: 'bg-purple-100 text-purple-700',
  business: 'bg-blue-100 text-blue-700',
  technical: 'bg-green-100 text-green-700',
  process: 'bg-orange-100 text-orange-700',
};

const SAMPLE: Decision[] = [
  {
    id: '1',
    title: 'Use Rust for backend services',
    date: '2025-01-15',
    category: 'architecture',
    status: 'active',
    context: 'Need high performance, memory safety, and concurrency for microservices.',
    decision: 'Adopt Axum + Tokio for all backend services.',
    consequences: 'Steep learning curve, excellent runtime performance, memory safety guarantees.',
    author: 'Etienne',
  },
];

export function DecisionLog() {
  const [decisions, setDecisions] = useState<Decision[]>(SAMPLE);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Decision, 'id'>>({
    title: '', date: new Date().toISOString().slice(0, 10), category: 'technical',
    status: 'active', context: '', decision: '', consequences: '', author: '',
  });

  const save = () => {
    if (!form.title) return;
    setDecisions(prev => [...prev, { ...form, id: Date.now().toString() }]);
    setOpen(false);
    setForm({ title: '', date: new Date().toISOString().slice(0, 10), category: 'technical', status: 'active', context: '', decision: '', consequences: '', author: '' });
  };

  const filtered = decisions.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.category.includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-primary" />
            Decision Log
            <Badge variant="secondary">{decisions.length}</Badge>
          </CardTitle>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />New Decision
          </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search decisions..." className="pl-8 h-8 text-sm" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filtered.map(d => (
            <div key={d.id} className="p-4 rounded-lg border space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{d.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[d.category]}`}>{d.category}</span>
                    <Badge variant={d.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {d.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{d.date}</span>
                    <span className="text-xs text-muted-foreground">by {d.author}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div><span className="font-medium text-muted-foreground">Context: </span>{d.context}</div>
                <div><span className="font-medium text-muted-foreground">Decision: </span>{d.decision}</div>
                <div><span className="font-medium text-muted-foreground">Consequences: </span>{d.consequences}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No decisions found</p>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Decision</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Title</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Decision title" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as Decision['category'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['architecture', 'business', 'technical', 'process'] as const).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Author</Label>
                <Input value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} placeholder="Your name" />
              </div>
            </div>
            {(['context', 'decision', 'consequences'] as const).map(field => (
              <div key={field} className="space-y-1">
                <Label className="text-xs capitalize">{field}</Label>
                <Textarea value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} rows={2} placeholder={`Describe the ${field}...`} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save}>Save Decision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
