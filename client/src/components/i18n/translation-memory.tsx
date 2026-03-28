'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Download, Upload, BookOpen, CheckCircle2 } from 'lucide-react';

interface TranslationEntry {
  id: string;
  source: string;
  locale: string;
  translation: string;
  usage_count: number;
  last_used: string;
  approved: boolean;
}

const SAMPLE: TranslationEntry[] = [
  { id: '1', source: 'Save changes', locale: 'fr', translation: 'Enregistrer les modifications', usage_count: 42, last_used: new Date().toISOString(), approved: true },
  { id: '2', source: 'Delete', locale: 'fr', translation: 'Supprimer', usage_count: 38, last_used: new Date().toISOString(), approved: true },
  { id: '3', source: 'Save changes', locale: 'de', translation: 'Änderungen speichern', usage_count: 12, last_used: new Date(Date.now() - 86400000).toISOString(), approved: true },
  { id: '4', source: 'Upload file', locale: 'ar', translation: 'رفع ملف', usage_count: 5, last_used: new Date(Date.now() - 86400000 * 3).toISOString(), approved: false },
  { id: '5', source: 'Settings', locale: 'es', translation: 'Configuración', usage_count: 8, last_used: new Date(Date.now() - 86400000 * 2).toISOString(), approved: true },
];

export function TranslationMemory() {
  const [entries, setEntries] = useState<TranslationEntry[]>(SAMPLE);
  const [search, setSearch] = useState('');
  const [filterLocale, setFilterLocale] = useState('all');

  const locales = ['all', ...new Set(entries.map(e => e.locale))];
  const filtered = entries.filter(e => {
    const matchSearch = !search || e.source.toLowerCase().includes(search.toLowerCase()) || e.translation.toLowerCase().includes(search.toLowerCase());
    const matchLocale = filterLocale === 'all' || e.locale === filterLocale;
    return matchSearch && matchLocale;
  });

  const approve = (id: string) => {
    setEntries(es => es.map(e => e.id === id ? { ...e, approved: true } : e));
    toast.success('Translation approved');
  };

  const exportTMX = () => {
    const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <body>
${entries.map(e => `    <tu><tuv xml:lang="en"><seg>${e.source}</seg></tuv><tuv xml:lang="${e.locale}"><seg>${e.translation}</seg></tuv></tu>`).join('\n')}
  </body>
</tmx>`;
    const blob = new Blob([tmx], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'translation-memory.tmx'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported as TMX');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Translation Memory</CardTitle>
              <CardDescription>Stored translations are reused automatically to ensure consistency</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportTMX}><Download className="mr-2 h-4 w-4" /> Export TMX</Button>
              <Button size="sm" variant="outline"><Upload className="mr-2 h-4 w-4" /> Import</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search translations..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {locales.map(l => (
                <button key={l} onClick={() => setFilterLocale(l)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${filterLocale === l ? 'bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}>
                  {l === 'all' ? 'All' : l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filtered.map(e => (
              <div key={e.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className="text-xs w-8 justify-center shrink-0">{e.locale.toUpperCase()}</Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.source}</p>
                    <p className={`text-xs text-muted-foreground truncate ${e.locale === 'ar' || e.locale === 'he' ? 'text-right' : ''}`} dir={e.locale === 'ar' || e.locale === 'he' ? 'rtl' : 'ltr'}>
                      → {e.translation}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs">{e.usage_count}x</Badge>
                  {e.approved
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : <Button size="sm" variant="outline" onClick={() => approve(e.id)} className="h-6 text-xs">Approve</Button>}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center py-6 text-muted-foreground text-sm">No translations found</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
