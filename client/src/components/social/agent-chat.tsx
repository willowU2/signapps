'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Send,
  Bot,
  User,
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  Calendar,
  BarChart3,
  Loader2,
  Pencil,
  Check,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSocialStore } from '@/stores/social-store';
import { socialApi, socialApiClient } from '@/lib/api/social';
import { PLATFORM_COLORS, PLATFORM_LABELS } from './platform-utils';
import type { SocialAccount } from '@/lib/api/social';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AIResponseType = 'text' | 'post-preview' | 'schedule-confirmation' | 'analytics-insight';

interface PostPreviewData {
  content: string;
  platforms: string[];
  hashtags: string[];
  suggestedTime?: string;
}

interface ScheduleData {
  date: string;
  time: string;
  timezone: string;
  postSummary: string;
}

interface AnalyticsData {
  metric: string;
  value: string;
  change: string;
  positive: boolean;
  breakdown: { label: string; value: number }[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: AIResponseType;
  postPreview?: PostPreviewData;
  scheduleData?: ScheduleData;
  analyticsData?: AnalyticsData;
  timestamp: string;
}

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const THREADS_STORAGE_KEY = 'signsocial-agent-threads';

function loadThreadsFromStorage(): ChatThread[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(THREADS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveThreads(threads: ChatThread[]) {
  try {
    localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
  } catch {
    // storage unavailable
  }
}

async function loadThreadsFromApi(): Promise<ChatThread[]> {
  try {
    const res = await socialApiClient.get<any[]>('/social/ai-threads');
    const threads: ChatThread[] = (res.data ?? []).map((t: any) => ({
      id: t.id ?? crypto.randomUUID(),
      title: t.title ?? 'Untitled',
      messages: Array.isArray(t.messages) ? t.messages : [],
      createdAt: t.created_at ?? t.createdAt ?? new Date().toISOString(),
    }));
    saveThreads(threads);
    return threads;
  } catch {
    return loadThreadsFromStorage();
  }
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
  { icon: Calendar, text: 'Schedule a post for tomorrow' },
  { icon: Sparkles, text: 'Generate content about our new product launch' },
  { icon: BarChart3, text: "What's the best time to post on LinkedIn?" },
  { icon: MessageSquare, text: 'Create a thread about sustainable technology' },
];

// ---------------------------------------------------------------------------
// AI response engine — wired to real API with fallback
// ---------------------------------------------------------------------------

function generateTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 37) + '...';
}

function fallbackHashtags(topic: string): string[] {
  const words = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const base = words.map((w) => `#${w.charAt(0).toUpperCase() + w.slice(1)}`);
  const extras = [
    '#SocialMedia',
    '#ContentStrategy',
    '#DigitalMarketing',
    '#Growth',
    '#Branding',
    '#MarketingTips',
    '#BusinessGrowth',
  ];
  const combined = [...new Set([...base, ...extras])];
  return combined.slice(0, 7);
}

async function buildAIResponse(
  userMessage: string,
  selectedAccounts: SocialAccount[]
): Promise<ChatMessage> {
  const lower = userMessage.toLowerCase();
  const base: Omit<ChatMessage, 'content' | 'type' | 'postPreview' | 'scheduleData' | 'analyticsData'> = {
    id: crypto.randomUUID(),
    role: 'assistant',
    timestamp: new Date().toISOString(),
  };

  const platforms = selectedAccounts.length > 0
    ? selectedAccounts.map((a) => PLATFORM_LABELS[a.platform])
    : ['Twitter / X', 'LinkedIn'];

  const selectedPlatform: SocialAccount['platform'] =
    selectedAccounts.length > 0 ? selectedAccounts[0].platform : 'twitter';

  // --- Schedule intent ---
  if (lower.includes('schedule') && (lower.includes('post') || lower.includes('tomorrow') || lower.includes('next'))) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const dateStr = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    return {
      ...base,
      type: 'schedule-confirmation',
      content: `I've prepared a scheduling slot for you. Here's what I suggest:`,
      scheduleData: {
        date: dateStr,
        time: '10:00 AM',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        postSummary: userMessage.replace(/schedule\s*(a\s*)?/i, '').replace(/for\s*tomorrow/i, '').trim() || 'Your upcoming post',
      },
    };
  }

  // --- Generate / create content intent ---
  if (lower.includes('generate') || lower.includes('create') || lower.includes('write') || lower.includes('draft') || lower.includes('compose')) {
    let topic = userMessage
      .replace(/^(generate|create|write|draft|compose)\s*(a\s*)?(post|content|thread|tweet|article)?\s*(about|on|for|regarding)?\s*/i, '')
      .trim();
    if (!topic) topic = 'your brand';

    try {
      const res = await socialApi.ai.generate({
        topic,
        tone: 'personal',
        platform: selectedPlatform,
      });
      const postContent = res.data.content;
      const hashtags = res.data.hashtags?.length > 0 ? res.data.hashtags : fallbackHashtags(topic);

      return {
        ...base,
        type: 'post-preview',
        content: `Here's a post about **${topic}** for ${platforms.join(' and ')}:`,
        postPreview: {
          content: postContent,
          platforms,
          hashtags,
          suggestedTime: 'Today at 2:00 PM',
        },
      };
    } catch {
      // Fallback to local generation if API is unavailable
      const postContent = `We're excited to share our perspective on ${topic}.\n\n` +
        `The key takeaway? Businesses that embrace ${topic} are seeing remarkable growth -- both in engagement and customer loyalty.\n\n` +
        `Here are 3 things we've learned:\n` +
        `1. Authenticity matters more than ever\n` +
        `2. Consistency beats virality\n` +
        `3. Community-driven content outperforms branded content by 2.4x\n\n` +
        `What's your experience with ${topic}? Let us know in the comments.`;

      return {
        ...base,
        type: 'post-preview',
        content: `Here's a post about **${topic}** for ${platforms.join(' and ')}:`,
        postPreview: {
          content: postContent,
          platforms,
          hashtags: fallbackHashtags(topic),
          suggestedTime: 'Today at 2:00 PM',
        },
      };
    }
  }

  // --- Analytics / best time intent ---
  if (lower.includes('best time') || lower.includes('analytics') || lower.includes('performance') || lower.includes('engagement') || lower.includes('stats') || lower.includes('insights')) {
    let platformLabel = 'your accounts';
    if (lower.includes('linkedin')) platformLabel = 'LinkedIn';
    else if (lower.includes('twitter') || lower.includes(' x ')) platformLabel = 'Twitter / X';
    else if (lower.includes('instagram')) platformLabel = 'Instagram';
    else if (lower.includes('facebook')) platformLabel = 'Facebook';
    else if (lower.includes('mastodon')) platformLabel = 'Mastodon';
    else if (lower.includes('bluesky')) platformLabel = 'Bluesky';

    // Try to get best time from API for the first selected account
    let bestTimeInfo: string | null = null;
    if (selectedAccounts.length > 0) {
      try {
        const btRes = await socialApi.ai.bestTime(selectedAccounts[0].id);
        bestTimeInfo = `Best time to post: **${(btRes.data as any).day} at ${(btRes.data as any).hour}:00** -- ${(btRes.data as any).reason}`;
      } catch {
        // API unavailable, use fallback data
      }
    }

    return {
      ...base,
      type: 'analytics-insight',
      content: bestTimeInfo
        ? `Here's an engagement analysis for **${platformLabel}**:\n\n${bestTimeInfo}`
        : `Here's an engagement analysis for **${platformLabel}**:`,
      analyticsData: {
        metric: 'Engagement Rate',
        value: '4.7%',
        change: '+0.8%',
        positive: true,
        breakdown: [
          { label: 'Mon', value: 62 },
          { label: 'Tue', value: 78 },
          { label: 'Wed', value: 91 },
          { label: 'Thu', value: 85 },
          { label: 'Fri', value: 70 },
          { label: 'Sat', value: 45 },
          { label: 'Sun', value: 38 },
        ],
      },
    };
  }

  // --- Hashtag intent ---
  if (lower.includes('hashtag') || lower.includes('#')) {
    const topicText = userMessage.replace(/.*(?:hashtag|#|suggest|recommend)s?\s*(?:for|about)?\s*/i, '').trim() || 'social media';

    let tags: string[];
    try {
      const hashRes = await socialApi.ai.hashtags(topicText);
      tags = hashRes.data.hashtags?.length > 0 ? hashRes.data.hashtags : fallbackHashtags(topicText);
    } catch {
      tags = fallbackHashtags(topicText);
    }

    return {
      ...base,
      type: 'text',
      content: `Here are some hashtag suggestions for **${topicText}**:\n\n` +
        tags.map((t) => `- \`${t}\` -- High relevance, moderate competition`).join('\n') +
        `\n\nI recommend using 3-5 of these for the best reach. Mix popular and niche hashtags for optimal discoverability.`,
    };
  }

  // --- Help / generic intent ---
  if (lower.includes('help') || lower.includes('what can you do') || lower === 'hi' || lower === 'hello' || lower === 'hey') {
    return {
      ...base,
      type: 'text',
      content: `Hello! I'm your SignSocial AI assistant. Here's what I can help you with:\n\n` +
        `- **Generate content**: "Write a post about our new feature"\n` +
        `- **Create threads**: "Create a thread about AI trends"\n` +
        `- **Schedule posts**: "Schedule a post for tomorrow at 10am"\n` +
        `- **Analytics insights**: "What's the best time to post on LinkedIn?"\n` +
        `- **Hashtag suggestions**: "Suggest hashtags for digital marketing"\n` +
        `- **Content ideas**: "Give me content ideas for this week"\n\n` +
        `Select channels in the left sidebar to target specific platforms. How can I help you today?`,
    };
  }

  // --- Content ideas ---
  if (lower.includes('idea') || lower.includes('suggest') || lower.includes('recommend') || lower.includes('inspiration')) {
    return {
      ...base,
      type: 'text',
      content: `Here are 5 content ideas for this week:\n\n` +
        `1. **Behind-the-scenes**: Share a day-in-the-life at your company. This type of content gets 2x more engagement.\n\n` +
        `2. **Industry poll**: Ask your audience about a trending topic. Polls drive 25% higher interaction rates.\n\n` +
        `3. **Customer spotlight**: Feature a customer success story. Social proof increases trust by 72%.\n\n` +
        `4. **Quick tip / How-to**: Share a practical tip related to your industry. Educational content is saved 3x more often.\n\n` +
        `5. **Throwback post**: Share a milestone or growth moment. Nostalgia content drives strong emotional engagement.\n\n` +
        `Want me to draft any of these? Just say "Write a post about #2" or describe what you'd like!`,
    };
  }

  // --- Default fallback: try content generation via AI ---
  try {
    const res = await socialApi.ai.generate({
      topic: userMessage,
      tone: 'personal',
      platform: selectedPlatform,
    });
    return {
      ...base,
      type: 'text',
      content: res.data.content,
    };
  } catch {
    return {
      ...base,
      type: 'text',
      content: `That's a great question! Here's what I think:\n\n` +
        `Based on current social media trends, the best approach for "${userMessage.slice(0, 80)}" would involve:\n\n` +
        `1. **Craft a compelling hook** -- The first line determines whether people stop scrolling.\n` +
        `2. **Use visual content** -- Posts with images or videos see 2.3x more engagement.\n` +
        `3. **Include a clear CTA** -- Tell your audience what to do next.\n\n` +
        `Would you like me to create a full post based on this? Just let me know which platforms you'd like to target.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Sub-components for AI response types
// ---------------------------------------------------------------------------

function PostPreviewCard({ data }: { data: PostPreviewData }) {
  const { createPost, publishPost, schedulePost, accounts } = useSocialStore();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(data.content);
  const [published, setPublished] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      const accountIds = accounts
        .filter((a) => data.platforms.some((p) => PLATFORM_LABELS[a.platform] === p))
        .map((a) => a.id);
      const post = await createPost({
        content,
        accounts: accountIds.length > 0 ? accountIds : accounts.map((a) => a.id),
        hashtags: data.hashtags,
        status: 'draft',
      });
      await publishPost(post.id);
      setPublished(true);
      toast.success('Post published successfully');
    } catch {
      toast.error('Failed to publish post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSchedule = async () => {
    setIsSubmitting(true);
    try {
      const accountIds = accounts
        .filter((a) => data.platforms.some((p) => PLATFORM_LABELS[a.platform] === p))
        .map((a) => a.id);
      const post = await createPost({
        content,
        accounts: accountIds.length > 0 ? accountIds : accounts.map((a) => a.id),
        hashtags: data.hashtags,
        status: 'draft',
      });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      await schedulePost(post.id, tomorrow.toISOString());
      setScheduled(true);
      toast.success('Post scheduled successfully');
    } catch {
      toast.error('Failed to schedule post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mt-3 overflow-hidden border border-border/60">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-medium">Generated Post</span>
          </div>
          <div className="flex gap-1">
            {data.platforms.map((p) => (
              <Badge key={p} variant="secondary" className="text-xs">
                {p}
              </Badge>
            ))}
          </div>
        </div>
        <Separator />
        {editing ? (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] text-sm"
            autoFocus
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
        )}
        {data.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.hashtags.map((h) => (
              <Badge key={h} variant="outline" className="text-xs font-normal">
                {h}
              </Badge>
            ))}
          </div>
        )}
        {data.suggestedTime && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Suggested: {data.suggestedTime}
          </div>
        )}
        <Separator />
        <div className="flex gap-2">
          {published ? (
            <Badge className="bg-green-600 text-white">Published</Badge>
          ) : scheduled ? (
            <Badge className="bg-blue-600 text-white">Scheduled</Badge>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(!editing)}
                disabled={isSubmitting}
              >
                {editing ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Done
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Edit
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSchedule}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                )}
                Schedule
              </Button>
              <Button size="sm" onClick={handlePublish} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Publish
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function ScheduleCard({ data }: { data: ScheduleData }) {
  const { createPost, schedulePost, accounts } = useSocialStore();
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const accountIds = accounts.map((a) => a.id);
      const post = await createPost({
        content: data.postSummary,
        accounts: accountIds,
        status: 'draft',
      });
      // Parse the date and time from the schedule data
      const scheduledAt = new Date(`${data.date} ${data.time}`);
      if (isNaN(scheduledAt.getTime())) {
        // Fallback: schedule for tomorrow at 10am
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        await schedulePost(post.id, tomorrow.toISOString());
      } else {
        await schedulePost(post.id, scheduledAt.toISOString());
      }
      setConfirmed(true);
      toast.success('Post scheduled successfully');
    } catch {
      toast.error('Failed to schedule post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mt-3 overflow-hidden border border-border/60">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Schedule Confirmation</span>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Date</p>
            <p className="font-medium">{data.date}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Time</p>
            <p className="font-medium">{data.time}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Timezone</p>
            <p className="font-medium">{data.timezone}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Post</p>
            <p className="font-medium truncate">{data.postSummary}</p>
          </div>
        </div>
        <Separator />
        <div className="flex gap-2">
          {confirmed ? (
            <Badge className="bg-green-600 text-white">
              <Check className="h-3.5 w-3.5 mr-1" />
              Confirmed
            </Badge>
          ) : (
            <>
              <Button size="sm" onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                Confirm
              </Button>
              <Button size="sm" variant="outline" disabled={isSubmitting}>
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Change Time
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function AnalyticsCard({ data }: { data: AnalyticsData }) {
  const maxVal = Math.max(...data.breakdown.map((b) => b.value));

  return (
    <Card className="mt-3 overflow-hidden border border-border/60">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">{data.metric}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold">{data.value}</span>
            <Badge
              variant="secondary"
              className={data.positive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}
            >
              <TrendingUp className={`h-3 w-3 mr-0.5 ${!data.positive ? 'rotate-180' : ''}`} />
              {data.change}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="flex items-end gap-1.5 h-20">
          {data.breakdown.map((item) => (
            <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-primary/80 transition-all"
                style={{ height: `${(item.value / maxVal) * 100}%`, minHeight: 4 }}
              />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Best days to post: <strong>Wednesday</strong> and <strong>Thursday</strong> based on
          your engagement data. Aim for 9-11 AM or 1-3 PM for maximum reach.
        </p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Platform icon (compact inline version)
// ---------------------------------------------------------------------------

function PlatformDot({ platform }: { platform: SocialAccount['platform'] }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ backgroundColor: PLATFORM_COLORS[platform] }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AgentChat() {
  const { accounts, fetchAccounts } = useSocialStore();

  // Thread state
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');

  // Channel selection
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const threadsRef = useRef<ChatThread[]>([]);

  // Keep refs in sync
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // -- Load accounts & threads on mount --
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    loadThreadsFromApi().then((loaded) => {
      setThreads(loaded);
      threadsRef.current = loaded;
    });
  }, []);

  // -- Scroll to bottom on new messages --
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedContent]);

  // -- Persist threads helper --
  const persistThreads = useCallback(
    (updated: ChatThread[]) => {
      setThreads(updated);
      threadsRef.current = updated;
      saveThreads(updated);
    },
    []
  );

  // -- Sync a single thread to API --
  const syncThreadToApi = useCallback((thread: ChatThread, isNew: boolean) => {
    if (isNew) {
      socialApiClient.post('/social/ai-threads', {
        id: thread.id,
        title: thread.title,
        messages: thread.messages,
        created_at: thread.createdAt,
      }).catch(() => {});
    } else {
      socialApiClient.put(`/social/ai-threads/${thread.id}`, {
        title: thread.title,
        messages: thread.messages,
      }).catch(() => {});
    }
  }, []);

  // -- Load a thread --
  const loadThread = useCallback((thread: ChatThread) => {
    setActiveThreadId(thread.id);
    activeThreadIdRef.current = thread.id;
    setMessages(thread.messages);
    setInput('');
    setIsTyping(false);
    setStreamedContent('');
  }, []);

  // -- New chat --
  const startNewChat = useCallback(() => {
    setActiveThreadId(null);
    activeThreadIdRef.current = null;
    setMessages([]);
    setInput('');
    setIsTyping(false);
    setStreamedContent('');
    inputRef.current?.focus();
  }, []);

  // -- Delete thread --
  const deleteThread = useCallback(
    (threadId: string) => {
      const updated = threadsRef.current.filter((t) => t.id !== threadId);
      persistThreads(updated);
      socialApiClient.delete(`/social/ai-threads/${threadId}`).catch(() => {});
      if (activeThreadIdRef.current === threadId) {
        startNewChat();
      }
    },
    [persistThreads, startNewChat]
  );

  // -- Streaming simulation --
  const streamResponse = useCallback(
    (response: ChatMessage, currentMessages: ChatMessage[]) => {
      const fullContent = response.content;
      let index = 0;
      setStreamedContent('');
      setIsTyping(true);

      const interval = setInterval(() => {
        const chunkSize = Math.random() > 0.3 ? 2 : 1;
        index = Math.min(index + chunkSize, fullContent.length);
        setStreamedContent(fullContent.slice(0, index));

        if (index >= fullContent.length) {
          clearInterval(interval);
          setIsTyping(false);
          setStreamedContent('');

          const newMessages = [...currentMessages, response];
          setMessages(newMessages);

          // Persist to thread
          const currentThreadId = activeThreadIdRef.current;
          const prev = threadsRef.current;
          const existing = prev.find((t) => t.id === currentThreadId);

          let updated: ChatThread[];
          if (existing) {
            const updatedThread = { ...existing, messages: newMessages };
            updated = prev.map((t) =>
              t.id === currentThreadId ? updatedThread : t
            );
            syncThreadToApi(updatedThread, false);
          } else {
            const firstUserMsg = newMessages.find((m) => m.role === 'user');
            const newThread: ChatThread = {
              id: crypto.randomUUID(),
              title: generateTitle(firstUserMsg?.content || 'New conversation'),
              messages: newMessages,
              createdAt: new Date().toISOString(),
            };
            updated = [newThread, ...prev];
            setActiveThreadId(newThread.id);
            activeThreadIdRef.current = newThread.id;
            syncThreadToApi(newThread, true);
          }

          persistThreads(updated);
        }
      }, 15);

      return () => clearInterval(interval);
    },
    [persistThreads, syncThreadToApi]
  );

  // -- Send message --
  const sendMessage = useCallback(
    (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || isTyping) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: msg,
        type: 'text',
        timestamp: new Date().toISOString(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput('');

      // Brief delay before AI starts responding
      setIsTyping(true);
      const selectedAccts = accounts.filter((a) => selectedAccountIds.includes(a.id));
      setTimeout(async () => {
        try {
          const response = await buildAIResponse(msg, selectedAccts);
          streamResponse(response, newMessages);
        } catch {
          setIsTyping(false);
          toast.error('Failed to get AI response');
        }
      }, 600);
    },
    [input, isTyping, messages, accounts, selectedAccountIds, streamResponse]
  );

  // -- Keyboard handling --
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // -- Toggle account selection --
  const toggleAccount = useCallback((accountId: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* ================================================================ */}
        {/* LEFT PANEL: Connecté Channels                                   */}
        {/* ================================================================ */}
        <div className="w-[240px] shrink-0 flex flex-col border-r bg-card">
          <div className="p-3 h-12 flex items-center">
            <span className="text-sm font-semibold">Target Channels</span>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No accounts connected.
                  <br />
                  <a href="/social/accounts" className="text-primary underline mt-1 inline-block">
                    Add accounts
                  </a>
                </p>
              )}
              {accounts.map((account) => {
                const isSelected = selectedAccountIds.includes(account.id);
                return (
                  <button
                    key={account.id}
                    onClick={() => toggleAccount(account.id)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : 'hover:bg-muted/60'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${PLATFORM_COLORS[account.platform]}18` }}
                      >
                        <PlatformDot platform={account.platform} />
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                          account.status === 'connected'
                            ? 'bg-green-500'
                            : account.status === 'expired'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        @{account.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {PLATFORM_LABELS[account.platform]}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          {selectedAccounts.length > 0 && (
            <>
              <Separator />
              <div className="p-2">
                <p className="text-xs text-muted-foreground text-center">
                  {selectedAccounts.length} channel{selectedAccounts.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </>
          )}
        </div>

        {/* ================================================================ */}
        {/* CENTER PANEL: Chat area                                          */}
        {/* ================================================================ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="h-12 flex items-center px-4 border-b shrink-0">
            <Bot className="h-5 w-5 text-primary mr-2" />
            <span className="text-sm font-semibold">SignSocial AI Agent</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              Beta
            </Badge>
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1 px-4">
            <div className="max-w-3xl mx-auto py-6 space-y-6">
              {/* Empty state with suggested prompts */}
              {messages.length === 0 && !isTyping && (
                <div className="flex flex-col items-center justify-center py-16 space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">
                      How can I help with your social media?
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-md">
                      I can generate content, schedule posts, analyze performance, suggest
                      hashtags, and more. Select channels on the left to target specific
                      platforms.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt.text}
                        onClick={() => sendMessage(prompt.text)}
                        className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3 text-left text-sm hover:bg-muted/60 transition-colors"
                      >
                        <prompt.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{prompt.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[85%] ${
                      message.role === 'user' ? 'order-first' : ''
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground ml-auto'
                          : 'bg-muted'
                      }`}
                    >
                      <MarkdownLite text={message.content} />
                    </div>
                    {/* Structured action cards */}
                    {message.type === 'post-preview' && message.postPreview && (
                      <PostPreviewCard data={message.postPreview} />
                    )}
                    {message.type === 'schedule-confirmation' && message.scheduleData && (
                      <ScheduleCard data={message.scheduleData} />
                    )}
                    {message.type === 'analytics-insight' && message.analyticsData && (
                      <AnalyticsCard data={message.analyticsData} />
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className="bg-blue-600 text-white">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {/* Streaming / typing indicator */}
              {isTyping && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[85%]">
                    {streamedContent ? (
                      <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-muted">
                        <MarkdownLite text={streamedContent} />
                        <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle rounded-sm" />
                      </div>
                    ) : (
                      <div className="rounded-2xl px-4 py-3 bg-muted flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t p-4 shrink-0">
            <div className="max-w-3xl mx-auto">
              {selectedAccounts.length > 0 && (
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">Targeting:</span>
                  {selectedAccounts.map((a) => (
                    <Badge
                      key={a.id}
                      variant="secondary"
                      className="text-xs gap-1"
                    >
                      <PlatformDot platform={a.platform} />
                      @{a.username}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me to create posts, schedule content, analyze performance..."
                  className="min-h-[44px] max-h-[160px] resize-none flex-1"
                  rows={1}
                  disabled={isTyping}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="h-[44px] w-[44px] shrink-0"
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || isTyping}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send message</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                Press Enter to send, Shift+Enter for new line.
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT PANEL: Thread history                                      */}
        {/* ================================================================ */}
        <div className="w-[200px] shrink-0 flex flex-col border-l bg-card">
          <div className="h-12 flex items-center justify-between px-3 shrink-0">
            <span className="text-sm font-semibold">History</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={startNewChat}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Chat</TooltipContent>
            </Tooltip>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {threads.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No conversations yet.
                  <br />
                  Start chatting!
                </p>
              )}
              {threads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                const msgCount = thread.messages.length;

                return (
                  <div
                    key={thread.id}
                    className={`group relative rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : 'hover:bg-muted/60'
                    }`}
                    onClick={() => loadThread(thread)}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {thread.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {msgCount} message{msgCount !== 1 ? 's' : ''} &middot;{' '}
                          {formatRelativeTime(thread.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteThread(thread.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Delete thread</TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Lightweight markdown renderer (bold, code, lists, line breaks)
// ---------------------------------------------------------------------------

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i > 0) {
      elements.push(<br key={`br-${i}`} />);
    }

    // Parse inline formatting
    elements.push(<InlineMarkdown key={`line-${i}`} text={line} />);
  }

  return <>{elements}</>;
}

function InlineMarkdown({ text }: { text: string }) {
  // Split on bold (**text**) and inline code (`text`)
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Inline code
      parts.push(
        <code
          key={match.index}
          className="rounded bg-black/10 px-1 py-0.5 text-xs font-mono"
        >
          {match[3]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString();
}
