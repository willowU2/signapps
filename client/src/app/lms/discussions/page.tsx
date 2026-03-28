'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, ThumbsUp, Reply, Pin, Search, Plus, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  author: string;
  initials: string;
  content: string;
  likes: number;
  liked: boolean;
  createdAt: Date;
  replies: Comment[];
  isPinned: boolean;
}

interface LessonThread {
  id: string;
  courseTitle: string;
  lessonTitle: string;
  lessonNumber: number;
  comments: Comment[];
}

const INITIAL_THREADS: LessonThread[] = [
  {
    id: '1', courseTitle: 'Introduction to SignApps', lessonTitle: 'Getting Started', lessonNumber: 1,
    comments: [
      { id: 'c1', author: 'Alice M.', initials: 'AM', content: 'Great introduction! One question — is there a way to sync the calendar with Outlook?', likes: 5, liked: false, createdAt: new Date(Date.now() - 3600000), isPinned: true, replies: [{ id: 'r1', author: 'Bob K. (Instructor)', initials: 'BK', content: 'Yes! Go to Settings > Integrations > Calendar. There is a native Outlook/Exchange sync option. It syncs both ways in real time.', likes: 8, liked: false, createdAt: new Date(Date.now() - 2400000), isPinned: false, replies: [] }] },
      { id: 'c2', author: 'Carol P.', initials: 'CP', content: 'The dashboard overview is very intuitive. Found the keyboard shortcuts at 5:32 super helpful!', likes: 3, liked: false, createdAt: new Date(Date.now() - 7200000), isPinned: false, replies: [] },
    ],
  },
  {
    id: '2', courseTitle: 'Introduction to SignApps', lessonTitle: 'User Management Basics', lessonNumber: 3,
    comments: [
      { id: 'c3', author: 'Dave L.', initials: 'DL', content: 'How do we handle bulk user imports from CSV? Is there a template available?', likes: 12, liked: false, createdAt: new Date(Date.now() - 86400000), isPinned: true, replies: [] },
    ],
  },
];

export default function LMSDiscussionsPage() {
  const [threads, setThreads] = useState<LessonThread[]>(INITIAL_THREADS);
  const [search, setSearch] = useState('');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [newComment, setNewComment] = useState('');
  const [selectedThread, setSelectedThread] = useState('1');

  const activeThread = threads.find(t => t.id === selectedThread);

  const toggleLike = (threadId: string, commentId: string, isReply = false, parentId?: string) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t;
      const updateComment = (c: Comment): Comment => {
        if (c.id === commentId) return { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 };
        return { ...c, replies: c.replies.map(updateComment) };
      };
      return { ...t, comments: t.comments.map(updateComment) };
    }));
  };

  const handleReply = (commentId: string) => {
    if (!replyText.trim()) return;
    setThreads(prev => prev.map(t => {
      if (t.id !== selectedThread) return t;
      return {
        ...t, comments: t.comments.map(c => {
          if (c.id !== commentId) return c;
          return { ...c, replies: [...c.replies, { id: Date.now().toString(), author: 'You', initials: 'ME', content: replyText, likes: 0, liked: false, createdAt: new Date(), isPinned: false, replies: [] }] };
        }),
      };
    }));
    setReplyText('');
    setReplyingTo(null);
    toast.success('Reply posted!');
  };

  const handlePost = () => {
    if (!newComment.trim()) return;
    setThreads(prev => prev.map(t => {
      if (t.id !== selectedThread) return t;
      return { ...t, comments: [{ id: Date.now().toString(), author: 'You', initials: 'ME', content: newComment, likes: 0, liked: false, createdAt: new Date(), isPinned: false, replies: [] }, ...t.comments] };
    }));
    setNewComment('');
    toast.success('Comment posted!');
  };

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => (
    <div className={cn('space-y-2', depth > 0 && 'ml-8 border-l-2 border-muted pl-4')}>
      <div className={cn('rounded-lg p-3', comment.isPinned ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30')}>
        {comment.isPinned && <div className="flex items-center gap-1 text-xs text-primary mb-1"><Pin className="h-3 w-3" />Pinned</div>}
        <div className="flex items-center gap-2 mb-1.5">
          <Avatar className="h-6 w-6"><AvatarFallback className="text-xs">{comment.initials}</AvatarFallback></Avatar>
          <span className="text-sm font-medium">{comment.author}</span>
          <span className="text-xs text-muted-foreground">{formatDistanceToNow(comment.createdAt, { addSuffix: true })}</span>
        </div>
        <p className="text-sm">{comment.content}</p>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={() => toggleLike(selectedThread, comment.id)} className={cn('flex items-center gap-1 text-xs hover:text-primary transition-colors', comment.liked && 'text-primary')}>
            <ThumbsUp className={cn('h-3.5 w-3.5', comment.liked && 'fill-current')} />{comment.likes}
          </button>
          {depth === 0 && (
            <button onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setReplyText(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Reply className="h-3.5 w-3.5" />Reply
            </button>
          )}
        </div>
      </div>
      {replyingTo === comment.id && (
        <div className="ml-8 flex gap-2">
          <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." rows={2} className="text-sm" />
          <div className="flex flex-col gap-1">
            <Button size="sm" onClick={() => handleReply(comment.id)}>Post</Button>
            <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {comment.replies.length > 0 && (
        <div className="space-y-2">
          {(expandedComments[comment.id] ? comment.replies : comment.replies.slice(0, 1)).map(r => (
            <CommentItem key={r.id} comment={r} depth={depth + 1} />
          ))}
          {comment.replies.length > 1 && (
            <button onClick={() => setExpandedComments(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))} className="ml-8 text-xs text-primary flex items-center gap-1">
              {expandedComments[comment.id] ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />{comment.replies.length - 1} more replies</>}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Course Discussions</h1>
            <p className="text-sm text-muted-foreground">Ask questions and engage with lesson content</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Thread list */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lessons..." className="pl-9 text-sm" />
            </div>
            {threads.filter(t => !search || t.lessonTitle.toLowerCase().includes(search.toLowerCase())).map(t => (
              <Card key={t.id} className={cn('cursor-pointer hover:shadow-md transition-shadow', selectedThread === t.id && 'border-primary')} onClick={() => setSelectedThread(t.id)}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                    <BookOpen className="h-3 w-3" />Lesson {t.lessonNumber}
                  </div>
                  <p className="text-sm font-medium">{t.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.courseTitle}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />{t.comments.length} comment{t.comments.length !== 1 ? 's' : ''}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Active thread */}
          <div className="lg:col-span-2 space-y-4">
            {activeThread ? (
              <>
                <div>
                  <h2 className="font-bold">{activeThread.lessonTitle}</h2>
                  <p className="text-sm text-muted-foreground">{activeThread.courseTitle}</p>
                </div>
                <div className="space-y-2">
                  <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ask a question or share a thought about this lesson..." rows={3} />
                  <div className="flex justify-end">
                    <Button onClick={handlePost} disabled={!newComment.trim()}><Plus className="h-4 w-4 mr-1" />Post Comment</Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {activeThread.comments.map(c => <CommentItem key={c.id} comment={c} />)}
                  {activeThread.comments.length === 0 && (
                    <Card className="border-dashed"><CardContent className="flex flex-col items-center py-10 text-muted-foreground"><MessageSquare className="h-6 w-6 mb-1 opacity-30" /><p className="text-sm">No comments yet — be the first!</p></CardContent></Card>
                  )}
                </div>
              </>
            ) : (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-muted-foreground"><MessageSquare className="h-8 w-8 mb-2 opacity-30" /><p>Select a lesson to view discussion</p></CardContent></Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
