'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Plus, Trash2, Send, Eye, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface NewsletterSection {
  id: string;
  type: 'heading' | 'text' | 'highlight' | 'link';
  content: string;
  url?: string;
}

interface Newsletter {
  id: string;
  subject: string;
  sections: NewsletterSection[];
  status: 'draft' | 'sent';
  createdAt: Date;
  sentAt?: Date;
  recipients: number;
}

const INITIAL: Newsletter[] = [
  {
    id: '1', subject: 'Weekly Digest — Week 13, 2026', status: 'sent', recipients: 145, createdAt: new Date(Date.now() - 7 * 86400000), sentAt: new Date(Date.now() - 6 * 86400000),
    sections: [{ id: 's1', type: 'heading', content: 'This Week at SignApps' }, { id: 's2', type: 'text', content: 'Q1 results exceeded all targets. Read the full CEO message in the news feed.' }, { id: 's3', type: 'highlight', content: '3 new team members joined Engineering this week. Welcome Alice, Bob, and Carol!' }],
  },
  {
    id: '2', subject: 'Weekly Digest — Week 12, 2026', status: 'sent', recipients: 142, createdAt: new Date(Date.now() - 14 * 86400000), sentAt: new Date(Date.now() - 13 * 86400000),
    sections: [{ id: 's1', type: 'heading', content: 'Company Updates' }, { id: 's2', type: 'text', content: 'Platform v3.0 launched with record user adoption across all departments.' }],
  },
];

const SECTION_TYPES = [
  { value: 'heading', label: 'Section Heading' },
  { value: 'text', label: 'Paragraph' },
  { value: 'highlight', label: 'Highlighted Block' },
  { value: 'link', label: 'Link' },
];

export default function NewsletterPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>(INITIAL);
  const [editing, setEditing] = useState<Newsletter | null>(null);
  const [subject, setSubject] = useState('');
  const [sections, setSections] = useState<NewsletterSection[]>([{ id: '1', type: 'heading', content: '' }]);
  const [previewMode, setPreviewMode] = useState(false);

  const startNew = () => {
    setEditing(null);
    setSubject(`Weekly Digest — ${format(new Date(), 'MMMM d, yyyy')}`);
    setSections([{ id: '1', type: 'heading', content: '' }, { id: '2', type: 'text', content: '' }]);
    setPreviewMode(false);
  };

  const openEdit = (n: Newsletter) => { setEditing(n); setSubject(n.subject); setSections([...n.sections]); setPreviewMode(false); };

  const addSection = () => setSections([...sections, { id: Date.now().toString(), type: 'text', content: '' }]);

  const updateSection = (id: string, field: keyof NewsletterSection, val: string) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));

  const removeSection = (id: string) => setSections(prev => prev.filter(s => s.id !== id));

  const saveDraft = () => {
    if (!subject.trim()) { toast.error('Objet requis'); return; }
    const n: Newsletter = { id: editing?.id || Date.now().toString(), subject, sections, status: 'draft', createdAt: editing?.createdAt || new Date(), recipients: 0 };
    setNewsletters(prev => editing ? prev.map(x => x.id === editing.id ? n : x) : [n, ...prev]);
    setEditing(n);
    toast.success('Brouillon enregistré');
  };

  const sendNow = () => {
    if (!subject.trim() || sections.every(s => !s.content.trim())) { toast.error('Ajoutez du contenu avant d\'envoyer'); return; }
    const n: Newsletter = { id: editing?.id || Date.now().toString(), subject, sections, status: 'sent', createdAt: editing?.createdAt || new Date(), sentAt: new Date(), recipients: 147 };
    setNewsletters(prev => editing ? prev.map(x => x.id === editing.id ? n : x) : [n, ...prev]);
    setEditing(null);
    toast.success('Newsletter envoyée à 147 abonnés !');
  };

  const sectionBg = (type: string) => type === 'highlight' ? 'bg-primary/5 border-l-4 border-primary' : type === 'heading' ? '' : '';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Newsletter Composer</h1>
              <p className="text-sm text-muted-foreground">Build and send weekly digests</p>
            </div>
          </div>
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" />New Newsletter</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor / Preview */}
          <div className="lg:col-span-2 space-y-4">
            {subject !== '' || sections.length > 0 ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{editing ? 'Edit Newsletter' : 'New Newsletter'}</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setPreviewMode(!previewMode)}>
                      <Eye className="h-3.5 w-3.5 mr-1" />{previewMode ? 'Edit' : 'Preview'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!previewMode ? (
                    <>
                      <div><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" placeholder="Newsletter subject..." /></div>
                      <div className="space-y-3">
                        {sections.map((s, i) => (
                          <div key={s.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <select value={s.type} onChange={e => updateSection(s.id, 'type', e.target.value)} className="text-xs rounded border border-input bg-background px-2 py-1">
                                {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                              <span className="text-xs text-muted-foreground ml-auto">Block {i + 1}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSection(s.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                            <Textarea value={s.content} onChange={e => updateSection(s.id, 'content', e.target.value)} placeholder={s.type === 'heading' ? 'Section title...' : s.type === 'link' ? 'Link text | URL' : 'Content...'} rows={s.type === 'heading' ? 1 : 3} className="resize-none" />
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={addSection}><Plus className="h-3.5 w-3.5 mr-1" />Add Section</Button>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" onClick={saveDraft}>Save Draft</Button>
                        <Button onClick={sendNow}><Send className="h-4 w-4 mr-2" />Send Now</Button>
                      </div>
                    </>
                  ) : (
                    <div className="border rounded-lg p-6 bg-background space-y-4">
                      <div className="border-b pb-3">
                        <div className="text-xs text-muted-foreground">Subject:</div>
                        <div className="font-bold text-lg">{subject}</div>
                      </div>
                      {sections.map(s => (
                        <div key={s.id} className={`${sectionBg(s.type)} ${s.type === 'highlight' ? 'p-3 rounded' : ''}`}>
                          {s.type === 'heading' && <h2 className="text-xl font-bold">{s.content}</h2>}
                          {s.type === 'text' && <p className="text-sm leading-relaxed">{s.content}</p>}
                          {s.type === 'highlight' && <p className="text-sm font-medium">{s.content}</p>}
                          {s.type === 'link' && <a href="#" className="text-primary underline text-sm">{s.content.split('|')[0].trim()}</a>}
                        </div>
                      ))}
                      <div className="border-t pt-3 text-xs text-muted-foreground">SignApps Platform · Unsubscribe</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-muted-foreground"><Mail className="h-10 w-10 mb-3 opacity-30" /><p className="font-medium">No newsletter in progress</p><p className="text-sm">Click "New Newsletter" to get started</p></CardContent></Card>
            )}
          </div>

          {/* History */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">History</h2>
            {newsletters.map(n => (
              <Card key={n.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(n)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={n.status === 'sent' ? 'default' : 'secondary'}>{n.status}</Badge>
                    {n.status === 'sent' && <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1"><User className="h-3 w-3" />{n.recipients}</span>}
                  </div>
                  <p className="text-sm font-medium truncate">{n.subject}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {n.sentAt ? `Sent ${formatDistanceToNow(n.sentAt, { addSuffix: true })}` : `Draft · ${formatDistanceToNow(n.createdAt, { addSuffix: true })}`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
