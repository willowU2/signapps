'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Newspaper, ThumbsUp, MessageSquare, Share2, Plus, Heart, Smile, Star } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const REACTIONS = [
  { emoji: '👍', label: 'Like', icon: ThumbsUp },
  { emoji: '❤️', label: 'Love', icon: Heart },
  { emoji: '🎉', label: 'Celebrate', icon: Star },
  { emoji: '😄', label: 'Funny', icon: Smile },
];

interface NewsItem {
  id: string;
  title: string;
  content: string;
  author: string;
  authorInitials: string;
  date: Date;
  category: string;
  reactions: Record<string, number>;
  userReaction: string | null;
  comments: number;
  image?: string;
}

const INITIAL_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Q1 2026 Results — Record Growth',
    content: 'We are thrilled to announce our best quarter ever with 42% revenue growth year-over-year. This achievement reflects the dedication of every team member across all departments.',
    author: 'CEO Office',
    authorInitials: 'CE',
    date: new Date(Date.now() - 2 * 3600000),
    category: 'Business',
    reactions: { '👍': 24, '❤️': 12, '🎉': 31, '😄': 3 },
    userReaction: null,
    comments: 8,
  },
  {
    id: '2',
    title: 'New Wellness Program Launching April 1st',
    content: 'HR is excited to announce our new employee wellness program including gym subsidies, mental health support, and flexible working arrangements starting next month.',
    author: 'HR Team',
    authorInitials: 'HR',
    date: new Date(Date.now() - 24 * 3600000),
    category: 'HR',
    reactions: { '👍': 45, '❤️': 18, '🎉': 22, '😄': 0 },
    userReaction: null,
    comments: 15,
  },
  {
    id: '3',
    title: 'SignApps v3.0 Platform Release',
    content: 'The engineering team has shipped SignApps v3.0 with 50+ new features, major performance improvements, and enterprise SSO support. Full release notes available in the wiki.',
    author: 'Engineering',
    authorInitials: 'ENG',
    date: new Date(Date.now() - 3 * 24 * 3600000),
    category: 'Tech',
    reactions: { '👍': 67, '❤️': 8, '🎉': 54, '😄': 7 },
    userReaction: null,
    comments: 23,
  },
];

const categoryColors: Record<string, string> = {
  Business: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  HR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Tech: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  General: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export default function NewsFeedPage() {
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'General' });

  const handleReact = (id: string, emoji: string) => {
    setNews(prev => prev.map(item => {
      if (item.id !== id) return item;
      const isActive = item.userReaction === emoji;
      const newReactions = { ...item.reactions };
      if (item.userReaction) newReactions[item.userReaction] = (newReactions[item.userReaction] || 1) - 1;
      if (!isActive) newReactions[emoji] = (newReactions[emoji] || 0) + 1;
      return { ...item, reactions: newReactions, userReaction: isActive ? null : emoji };
    }));
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) { toast.error('Veuillez remplir tous les champs'); return; }
    const item: NewsItem = {
      id: Date.now().toString(), title: form.title, content: form.content,
      author: 'You', authorInitials: 'ME', date: new Date(), category: form.category,
      reactions: { '👍': 0, '❤️': 0, '🎉': 0, '😄': 0 }, userReaction: null, comments: 0,
    };
    setNews([item, ...news]);
    setForm({ title: '', content: '', category: 'General' });
    setOpen(false);
    toast.success('Actualité publiée !');
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Newspaper className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Company News</h1>
              <p className="text-sm text-muted-foreground">Stay up to date with company news</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Post News</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Post Company News</DialogTitle></DialogHeader>
              <form onSubmit={handlePost} className="space-y-4">
                <Input placeholder="News title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <Textarea placeholder="News content..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4} />
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option>General</option><option>Business</option><option>HR</option><option>Tech</option>
                </select>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button type="submit">Publish</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {news.map(item => (
            <Card key={item.id}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback className="text-xs">{item.authorInitials}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{item.author}</span>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(item.date, { addSuffix: true })}</span>
                      <Badge className={cn('text-xs', categoryColors[item.category] || categoryColors.General)}>{item.category}</Badge>
                    </div>
                    <h3 className="font-bold mt-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{item.content}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {REACTIONS.map(r => {
                    const count = item.reactions[r.emoji] || 0;
                    const active = item.userReaction === r.emoji;
                    return count > 0 || active ? (
                      <Button key={r.emoji} variant={active ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs gap-1"
                        onClick={() => handleReact(item.id, r.emoji)}>
                        <span>{r.emoji}</span><span>{count}</span>
                      </Button>
                    ) : null;
                  })}
                  <div className="ml-auto flex gap-1">
                    {REACTIONS.map(r => (
                      <Button key={r.emoji} variant="ghost" size="sm" className="h-7 w-7 p-0 text-base"
                        onClick={() => handleReact(item.id, r.emoji)} title={r.label}>{r.emoji}</Button>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <MessageSquare className="h-4 w-4" />{item.comments} comments
                  </button>
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto">
                    <Share2 className="h-4 w-4" />Share
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
