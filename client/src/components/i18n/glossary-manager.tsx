'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, BookMarked, Search } from 'lucide-react';

interface GlossaryTerm {
  id: string;
  term: string;
  locale: string;
  definition: string;
  translation: string;
  forbidden: boolean;
  domain: string;
}

const LOCALES = ['fr', 'en', 'de', 'es', 'ar', 'he'];
const DOMAINS = ['General', 'UI', 'Legal', 'Technical', 'Marketing'];

const SAMPLE: GlossaryTerm[] = [
  { id: '1', term: 'Workspace', locale: 'fr', definition: 'A collaborative space grouping users and resources', translation: 'Espace de travail', forbidden: false, domain: 'UI' },
  { id: '2', term: 'Dashboard', locale: 'fr', definition: 'Main overview screen', translation: 'Tableau de bord', forbidden: false, domain: 'UI' },
  { id: '3', term: 'Admin', locale: 'fr', definition: 'System administrator', translation: 'Administrateur', forbidden: false, domain: 'General' },
  { id: '4', term: 'Container', locale: 'fr', definition: 'Docker/Podman container instance', translation: 'Conteneur', forbidden: false, domain: 'Technical' },
];

export function GlossaryManager() {
  const [terms, setTerms] = useState<GlossaryTerm[]>(SAMPLE);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLocale, setFilterLocale] = useState('all');
  const [form, setForm] = useState<Partial<GlossaryTerm>>({ locale: 'fr', domain: 'General', forbidden: false });

  const filtered = terms.filter(t => {
    const matchSearch = !search || t.term.toLowerCase().includes(search.toLowerCase()) || t.translation.toLowerCase().includes(search.toLowerCase());
    const matchLocale = filterLocale === 'all' || t.locale === filterLocale;
    return matchSearch && matchLocale;
  });

  const save = () => {
    if (!form.term || !form.locale || !form.translation) { toast.error('Term, locale and translation required'); return; }
    const { id: _id, ...rest } = form as GlossaryTerm;
    setTerms(ts => [...ts, { id: Date.now().toString(), ...rest }]);
    setOpen(false);
    setForm({ locale: 'fr', domain: 'General', forbidden: false });
    toast.success('Term added to glossary');
  };

  const remove = (id: string) => { setTerms(ts => ts.filter(t => t.id !== id)); toast.success('Term removed'); };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><BookMarked className="h-5 w-5" /> Glossary Management</CardTitle>
              <CardDescription>Define approved terms and translations per language and domain</CardDescription>
            </div>
            <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Term</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search terms..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {['all', ...LOCALES].map(l => (
                <button key={l} onClick={() => setFilterLocale(l)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${filterLocale === l ? 'bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}>
                  {l === 'all' ? 'All' : l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="flex items-start justify-between border rounded-lg px-3 py-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex gap-1 shrink-0 mt-0.5">
                    <Badge variant="outline" className="text-xs">{t.locale.toUpperCase()}</Badge>
                    <Badge variant="secondary" className="text-xs">{t.domain}</Badge>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t.term}</span>
                      {t.forbidden && <Badge variant="destructive" className="text-xs">Forbidden</Badge>}
                    </div>
                    <p className={`text-xs text-muted-foreground ${t.locale === 'ar' || t.locale === 'he' ? 'text-right' : ''}`}
                      dir={t.locale === 'ar' || t.locale === 'he' ? 'rtl' : 'ltr'}>
                      {t.translation}
                    </p>
                    {t.definition && <p className="text-xs text-muted-foreground/70 italic mt-0.5">{t.definition}</p>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive h-7 w-7 shrink-0" onClick={() => remove(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center py-6 text-muted-foreground text-sm">No terms found</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Glossary Term</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Source Term (English)</Label>
                <Input value={form.term || ''} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} />
              </div>
              <div className="space-y-1"><Label>Locale</Label>
                <Select value={form.locale || 'fr'} onValueChange={v => setForm(f => ({ ...f, locale: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOCALES.map(l => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Approved Translation</Label>
              <Input value={form.translation || ''} onChange={e => setForm(f => ({ ...f, translation: e.target.value }))}
                dir={form.locale === 'ar' || form.locale === 'he' ? 'rtl' : 'ltr'} />
            </div>
            <div className="space-y-1"><Label>Definition (optional)</Label>
              <Textarea rows={2} value={form.definition || ''} onChange={e => setForm(f => ({ ...f, definition: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Domain</Label>
              <Select value={form.domain || 'General'} onValueChange={v => setForm(f => ({ ...f, domain: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOMAINS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save}>Add Term</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
