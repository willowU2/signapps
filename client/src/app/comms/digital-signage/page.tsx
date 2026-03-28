'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Monitor, Plus, Trash2, MoveUp, MoveDown, Play, Pause, Eye, Image, Type, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type SlideType = 'text' | 'announcement' | 'image' | 'metrics';

interface Slide {
  id: string;
  type: SlideType;
  title: string;
  content: string;
  duration: number;
  bgColor: string;
  textColor: string;
  active: boolean;
  order: number;
}

const BG_COLORS = ['#1e40af', '#15803d', '#9333ea', '#b45309', '#be123c', '#0f766e'];
const TEXT_COLORS = ['#ffffff', '#f8fafc'];

const INITIAL_SLIDES: Slide[] = [
  { id: '1', type: 'announcement', title: 'Welcome to SignApps', content: 'Your all-in-one enterprise platform', duration: 10, bgColor: '#1e40af', textColor: '#ffffff', active: true, order: 0 },
  { id: '2', type: 'text', title: 'Q1 Highlights', content: '42% Revenue Growth\n1,200 Active Users\n99.9% Uptime', duration: 8, bgColor: '#15803d', textColor: '#ffffff', active: true, order: 1 },
  { id: '3', type: 'announcement', title: 'Team Event — April 15', content: 'Annual company picnic at Central Park\n2:00 PM — 6:00 PM', duration: 12, bgColor: '#9333ea', textColor: '#ffffff', active: true, order: 2 },
];

export default function DigitalSignagePage() {
  const [slides, setSlides] = useState<Slide[]>(INITIAL_SLIDES);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Slide | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [form, setForm] = useState({ type: 'text' as SlideType, title: '', content: '', duration: 10, bgColor: '#1e40af', textColor: '#ffffff' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) { toast.error('Please fill all fields'); return; }
    const slide: Slide = { id: Date.now().toString(), ...form, active: true, order: slides.length };
    setSlides([...slides, slide]);
    setForm({ type: 'text', title: '', content: '', duration: 10, bgColor: '#1e40af', textColor: '#ffffff' });
    setOpen(false);
    toast.success('Slide added');
  };

  const move = (id: string, dir: 'up' | 'down') => {
    const idx = slides.findIndex(s => s.id === id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === slides.length - 1)) return;
    const arr = [...slides];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    setSlides(arr);
  };

  const toggleActive = (id: string) => setSlides(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  const remove = (id: string) => { setSlides(prev => prev.filter(s => s.id !== id)); toast.success('Slide removed'); };

  const typeIcon = (t: SlideType) => t === 'text' ? Type : t === 'announcement' ? Monitor : t === 'image' ? Image : Clock;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Digital Signage</h1>
              <p className="text-sm text-muted-foreground">Manage display screen content and slides</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <><Pause className="h-4 w-4 mr-2" />Pause</>:<><Play className="h-4 w-4 mr-2" />Preview Play</>}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Slide</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>New Slide</DialogTitle></DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Type</Label>
                      <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as SlideType })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="text">Text</option><option value="announcement">Announcement</option><option value="metrics">Metrics</option>
                      </select>
                    </div>
                    <div><Label>Duration (sec)</Label><Input type="number" min={3} max={60} value={form.duration} onChange={e => setForm({ ...form, duration: +e.target.value })} className="mt-1" /></div>
                  </div>
                  <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
                  <div><Label>Content</Label><Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-1" rows={3} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Background</Label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {BG_COLORS.map(c => <button key={c} type="button" onClick={() => setForm({ ...form, bgColor: c })} className={cn('h-7 w-7 rounded-full border-2 transition-transform hover:scale-110', form.bgColor === c ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />)}
                      </div>
                    </div>
                    <div><Label>Text Color</Label>
                      <div className="flex gap-1 mt-1">
                        {TEXT_COLORS.map(c => <button key={c} type="button" onClick={() => setForm({ ...form, textColor: c })} className={cn('h-7 w-7 rounded-full border-2 transition-transform hover:scale-110', form.textColor === c ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: c === '#ffffff' ? '#fff' : '#0f172a', outline: '1px solid #ccc' }} />)}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit">Add Slide</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Preview panel */}
          <div className="lg:col-span-1">
            <Card><CardHeader><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
              <CardContent>
                {preview ? (
                  <div className="rounded-lg aspect-video flex flex-col items-center justify-center p-4 text-center" style={{ backgroundColor: preview.bgColor, color: preview.textColor }}>
                    <h2 className="font-bold text-lg">{preview.title}</h2>
                    <p className="text-sm mt-2 whitespace-pre-line opacity-90">{preview.content}</p>
                    <div className="mt-3 text-xs opacity-60 flex items-center gap-1"><Clock className="h-3 w-3" />{preview.duration}s</div>
                  </div>
                ) : (
                  <div className="rounded-lg aspect-video flex items-center justify-center bg-muted text-muted-foreground text-sm">
                    Click a slide to preview
                  </div>
                )}
                <div className="mt-3 text-xs text-muted-foreground text-center">
                  {slides.filter(s => s.active).length} active slides · Total {slides.filter(s => s.active).reduce((a, s) => a + s.duration, 0)}s loop
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Slides list */}
          <div className="lg:col-span-2 space-y-2">
            {slides.length === 0 && (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Monitor className="h-8 w-8 mb-2 opacity-30" /><p>No slides yet</p></CardContent></Card>
            )}
            {slides.map((slide, idx) => {
              const Icon = typeIcon(slide.type);
              return (
                <Card key={slide.id} className={cn('cursor-pointer transition-shadow hover:shadow-md', !slide.active && 'opacity-50', preview?.id === slide.id && 'ring-2 ring-primary')} onClick={() => setPreview(slide)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 rounded flex-shrink-0" style={{ backgroundColor: slide.bgColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm truncate">{slide.title}</span>
                          <Badge variant="outline" className="text-xs ml-auto shrink-0">{slide.duration}s</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{slide.content.split('\n')[0]}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); move(slide.id, 'up'); }} disabled={idx === 0}><MoveUp className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); move(slide.id, 'down'); }} disabled={idx === slides.length - 1}><MoveDown className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); toggleActive(slide.id); }} title={slide.active ? 'Disable' : 'Enable'}><Eye className={cn('h-3 w-3', !slide.active && 'opacity-30')} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); remove(slide.id); }}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
