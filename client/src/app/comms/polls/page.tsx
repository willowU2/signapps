'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Plus, Trash2, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  voted: string | null;
  createdAt: Date;
  closedAt?: Date;
  status: 'active' | 'closed';
  totalVotes: number;
}

const INITIAL_POLLS: Poll[] = [
  {
    id: '1', question: 'Which day works best for the team-building event?', status: 'active',
    options: [{ id: 'a', text: 'Friday April 11', votes: 23 }, { id: 'b', text: 'Saturday April 12', votes: 41 }, { id: 'c', text: 'Sunday April 13', votes: 12 }],
    voted: null, createdAt: new Date(Date.now() - 86400000), totalVotes: 76,
  },
  {
    id: '2', question: 'Should we switch to a 4-day work week?', status: 'active',
    options: [{ id: 'a', text: 'Yes, full 4-day week', votes: 67 }, { id: 'b', text: 'No, keep 5 days', votes: 18 }, { id: 'c', text: 'Try it for 3 months', votes: 45 }],
    voted: null, createdAt: new Date(Date.now() - 2 * 86400000), totalVotes: 130,
  },
  {
    id: '3', question: 'Preferred lunch option for the office?', status: 'closed',
    options: [{ id: 'a', text: 'Catered meals', votes: 55 }, { id: 'b', text: 'Food delivery allowance', votes: 89 }, { id: 'c', text: 'Company restaurant', votes: 34 }],
    voted: 'b', createdAt: new Date(Date.now() - 7 * 86400000), closedAt: new Date(Date.now() - 86400000), totalVotes: 178,
  },
];

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>(INITIAL_POLLS);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '']);

  const vote = (pollId: string, optionId: string) => {
    setPolls(prev => prev.map(p => {
      if (p.id !== pollId || p.voted || p.status === 'closed') return p;
      return { ...p, voted: optionId, totalVotes: p.totalVotes + 1, options: p.options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o) };
    }));
    toast.success('Vote recorded!');
  };

  const closePoll = (id: string) => { setPolls(prev => prev.map(p => p.id === id ? { ...p, status: 'closed', closedAt: new Date() } : p)); toast.success('Poll closed'); };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim());
    if (!question.trim() || validOptions.length < 2) { toast.error('Question and at least 2 options required'); return; }
    const poll: Poll = {
      id: Date.now().toString(), question, status: 'active', totalVotes: 0, voted: null, createdAt: new Date(),
      options: validOptions.map((text, i) => ({ id: String(i), text, votes: 0 })),
    };
    setPolls([poll, ...polls]);
    setQuestion(''); setOptions(['', '', '']); setOpen(false);
    toast.success('Poll created!');
  };

  const active = polls.filter(p => p.status === 'active');
  const closed = polls.filter(p => p.status === 'closed');

  const PollCard = ({ poll }: { poll: Poll }) => {
    const max = Math.max(...poll.options.map(o => o.votes), 1);
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant={poll.status === 'active' ? 'default' : 'secondary'} className="mb-2">
                {poll.status === 'active' ? 'Active' : 'Closed'}
              </Badge>
              <h3 className="font-semibold">{poll.question}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {poll.totalVotes} votes · {formatDistanceToNow(poll.createdAt, { addSuffix: true })}
              </p>
            </div>
            {poll.status === 'active' && !poll.voted && (
              <Button variant="outline" size="sm" onClick={() => closePoll(poll.id)} className="shrink-0"><X className="h-3 w-3 mr-1" />Close</Button>
            )}
          </div>
          <div className="space-y-2">
            {poll.options.map(opt => {
              const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
              const isVoted = poll.voted === opt.id;
              const isWinner = poll.status === 'closed' && opt.votes === Math.max(...poll.options.map(o => o.votes));
              return (
                <div key={opt.id}>
                  <div className="flex items-center justify-between mb-1">
                    <button
                      onClick={() => vote(poll.id, opt.id)}
                      disabled={!!poll.voted || poll.status === 'closed'}
                      className={`text-sm font-medium flex items-center gap-1 ${!!poll.voted || poll.status === 'closed' ? '' : 'hover:text-primary cursor-pointer'}`}
                    >
                      {(isVoted || isWinner) && <Check className="h-3.5 w-3.5 text-green-500" />}
                      {opt.text}
                    </button>
                    <span className="text-sm text-muted-foreground">{pct}% ({opt.votes})</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>
          {!poll.voted && poll.status === 'active' && (
            <p className="text-xs text-muted-foreground text-center">Click an option to vote</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Internal Polls</h1>
              <p className="text-sm text-muted-foreground">Quick polls with live results</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Create Poll</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a Poll</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <Input placeholder="Your question..." value={question} onChange={e => setQuestion(e.target.value)} />
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <Input key={i} placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const a = [...options]; a[i] = e.target.value; setOptions(a); }} />
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOptions([...options, ''])}><Plus className="h-3 w-3 mr-1" />Add Option</Button>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Poll</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="active">
          <TabsList><TabsTrigger value="active">Active ({active.length})</TabsTrigger><TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger></TabsList>
          <TabsContent value="active" className="space-y-4 mt-4">
            {active.map(p => <PollCard key={p.id} poll={p} />)}
            {active.length === 0 && <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-muted-foreground"><BarChart3 className="h-8 w-8 mb-2 opacity-30" /><p>No active polls</p></CardContent></Card>}
          </TabsContent>
          <TabsContent value="closed" className="space-y-4 mt-4">
            {closed.map(p => <PollCard key={p.id} poll={p} />)}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
