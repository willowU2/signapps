'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import {
  Sparkles,
  Hash,
  Clock,
  Send,
  Save,
  ImagePlus,
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Globe,
  Layers,
  Repeat,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSocialStore } from '@/stores/social-store';
import { socialApi } from '@/lib/api/social';
import type { SocialAccount, ThreadPost } from '@/lib/api/social';
import { PostPreview } from './post-preview';
import { SignatureSelector } from './post-signatures';
import { UrlShortenerPopover } from './url-shortener';
import { SocialAttachDrive } from '@/components/interop/SocialAttachDrive';
import { DocFromTemplate } from '@/components/interop/DocFromTemplate';
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  getPlatformCharLimit,
  getCharLimitColor,
} from './platform-utils';
import { format } from 'date-fns';

// ---------- Thread delay options ----------
const THREAD_DELAY_OPTIONS = [
  { value: '1', label: '1 min' },
  { value: '2', label: '2 min' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
];

// ---------- Repeat interval options ----------
const REPEAT_OPTIONS = [
  { value: '0', label: 'None', days: 0 },
  { value: '1', label: 'Every day', days: 1 },
  { value: '2', label: 'Every 2 days', days: 2 },
  { value: '3', label: 'Every 3 days', days: 3 },
  { value: '7', label: 'Weekly', days: 7 },
  { value: '14', label: 'Every 2 weeks', days: 14 },
  { value: '30', label: 'Monthly', days: 30 },
] as const;

// ---------- Helpers to generate IDs ----------
let _threadIdCounter = 0;
function nextThreadId(): string {
  _threadIdCounter += 1;
  return `tp_${Date.now()}_${_threadIdCounter}`;
}

// ---------- Props ----------
interface PostComposerProps {
  onSaved?: () => void;
  initialContent?: string;
}

export function PostComposer({ onSaved, initialContent = '' }: PostComposerProps) {
  const { accounts, signatures, createPost, schedulePost, publishPost } = useSocialStore();

  // ----- Core content -----
  const [content, setContent] = useState(initialContent);
  const [platformContent, setPlatformContent] = useState<Record<string, string>>({});
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);

  // ----- AI -----
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHashtagLoading, setIsHashtagLoading] = useState(false);

  // ----- Scheduling / saving -----
  const [isSaving, setIsSaving] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleHour, setScheduleHour] = useState('09');
  const [scheduleMinute, setScheduleMinute] = useState('00');

  // ----- Recurring / Repeat -----
  const [repeatInterval, setRepeatInterval] = useState(0);

  // ----- Preview -----
  const [activePreviewPlatform, setActivePreviewPlatform] = useState<SocialAccount['platform'] | null>(null);

  // ----- Thread state -----
  const [threadPosts, setThreadPosts] = useState<ThreadPost[]>([
    { id: nextThreadId(), content: initialContent, delayMinutes: 0 },
  ]);

  // ----- Compose mode: 'global' (single content) vs 'per-platform' -----
  const [composeMode, setComposeMode] = useState<'global' | 'per-platform'>('global');

  // ----- Per-platform thread overrides -----
  // Key = platform string, value = ThreadPost[] for that platform
  const [platformThreadOverrides, setPlatformThreadOverrides] = useState<
    Record<string, ThreadPost[]>
  >({});

  // The currently active platform tab when in per-platform mode
  const [activePlatformTab, setActivePlatformTab] = useState<string>('');

  const connectedAccounts = useMemo(() => accounts.filter((a) => a.status === 'connected'), [accounts]);
  const selectedAccounts = useMemo(
    () => connectedAccounts.filter((a) => selectedAccountIds.includes(a.id)),
    [connectedAccounts, selectedAccountIds]
  );
  const selectedPlatforms = useMemo(
    () => [...new Set(selectedAccounts.map((a) => a.platform))],
    [selectedAccounts]
  );

  // When switching to per-platform mode, populate per-platform threads from global threads
  const handleToggleComposeMode = useCallback(() => {
    setComposeMode((prev) => {
      const next = prev === 'global' ? 'per-platform' : 'global';
      if (next === 'per-platform') {
        // Pre-populate overrides from global thread state
        const overrides: Record<string, ThreadPost[]> = {};
        for (const p of selectedPlatforms) {
          // If override already exists, keep it; otherwise clone from global
          if (!platformThreadOverrides[p]) {
            overrides[p] = threadPosts.map((tp) => ({ ...tp, id: nextThreadId() }));
          }
        }
        if (Object.keys(overrides).length > 0) {
          setPlatformThreadOverrides((prev2) => ({ ...prev2, ...overrides }));
        }
        // Set the first platform as active tab
        if (selectedPlatforms.length > 0 && !activePlatformTab) {
          setActivePlatformTab(selectedPlatforms[0]);
        }
      }
      return next;
    });
  }, [selectedPlatforms, threadPosts, platformThreadOverrides, activePlatformTab]);

  // ----- Account toggling -----
  const toggleAccount = useCallback((id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }, []);

  // ----- AI generation -----
  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) return;
    setIsGenerating(true);
    try {
      const res = await socialApi.ai.generate({ topic: aiTopic });
      setContent(res.data.content);
      // Also update first thread post
      setThreadPosts((prev) => {
        const copy = [...prev];
        if (copy.length > 0) {
          copy[0] = { ...copy[0], content: res.data.content };
        }
        return copy;
      });
      if (res.data.hashtags && res.data.hashtags.length > 0) setHashtags(res.data.hashtags);
    } catch {
      // silent -- backend not running yet
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHashtagSuggest = async () => {
    if (!content.trim()) return;
    setIsHashtagLoading(true);
    try {
      const res = await socialApi.ai.hashtags(content);
      setHashtags(res.data.hashtags);
    } catch {
      // silent
    } finally {
      setIsHashtagLoading(false);
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags((prev) => prev.filter((h) => h !== tag));
  };

  // ----- Thread manipulation helpers -----
  function updateThreadPosts(
    setter: React.Dispatch<React.SetStateAction<ThreadPost[]>>,
    fn: (prev: ThreadPost[]) => ThreadPost[],
    syncContent?: boolean
  ) {
    setter((prev) => {
      const next = fn(prev);
      // Keep the top-level `content` in sync with thread[0] (global mode)
      if (syncContent && next.length > 0) {
        setContent(next[0].content);
      }
      return next;
    });
  }

  function addThreadPost(
    setter: React.Dispatch<React.SetStateAction<ThreadPost[]>>,
    syncContent?: boolean
  ) {
    updateThreadPosts(
      setter,
      (prev) => [...prev, { id: nextThreadId(), content: '', delayMinutes: 5 }],
      syncContent
    );
  }

  function removeThreadPost(
    setter: React.Dispatch<React.SetStateAction<ThreadPost[]>>,
    id: string,
    syncContent?: boolean
  ) {
    updateThreadPosts(
      setter,
      (prev) => prev.filter((p) => p.id !== id),
      syncContent
    );
  }

  function moveThreadPost(
    setter: React.Dispatch<React.SetStateAction<ThreadPost[]>>,
    index: number,
    direction: 'up' | 'down',
    syncContent?: boolean
  ) {
    updateThreadPosts(
      setter,
      (prev) => {
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= prev.length) return prev;
        const copy = [...prev];
        [copy[index], copy[target]] = [copy[target], copy[index]];
        return copy;
      },
      syncContent
    );
  }

  function setThreadPostContent(
    setter: React.Dispatch<React.SetStateAction<ThreadPost[]>>,
    id: string,
    newContent: string,
    syncContent?: boolean
  ) {
    updateThreadPosts(
      setter,
      (prev) => prev.map((p) => (p.id === id ? { ...p, content: newContent } : p)),
      syncContent
    );
  }

  function setThreadPostDelay(
    setter: React.Dispatch<React.SetStateAction<ThreadPost[]>>,
    id: string,
    delayMinutes: number
  ) {
    updateThreadPosts(setter, (prev) =>
      prev.map((p) => (p.id === id ? { ...p, delayMinutes } : p))
    );
  }

  // ----- Content getters for preview -----
  function getContentForPlatform(platform: SocialAccount['platform']): string {
    if (composeMode === 'per-platform' && platformThreadOverrides[platform]) {
      return platformThreadOverrides[platform].map((p) => p.content).join('\n\n---\n\n');
    }
    return platformContent[platform] ?? threadPosts.map((p) => p.content).join('\n\n---\n\n');
  }

  // ----- Active threads for the current editing context -----
  function getActiveThreads(): ThreadPost[] {
    if (composeMode === 'per-platform' && activePlatformTab) {
      return platformThreadOverrides[activePlatformTab] ?? threadPosts;
    }
    return threadPosts;
  }

  function getActiveThreadSetter(): React.Dispatch<React.SetStateAction<ThreadPost[]>> {
    if (composeMode === 'per-platform' && activePlatformTab) {
      // Return a wrapper that updates the correct platform entry
      return (action: React.SetStateAction<ThreadPost[]>) => {
        setPlatformThreadOverrides((prev) => {
          const current = prev[activePlatformTab] ?? threadPosts;
          const next = typeof action === 'function' ? action(current) : action;
          return { ...prev, [activePlatformTab]: next };
        });
      };
    }
    return setThreadPosts;
  }

  // ----- Signature helpers -----
  const autoSignature = signatures.find((s) => s.autoAdd);
  const autoSignatureText = autoSignature ? `\n---\n${autoSignature.content}` : '';

  function appendSignatureToContent(text: string): string {
    if (!autoSignatureText) return text;
    if (text.endsWith(autoSignatureText)) return text;
    return text + autoSignatureText;
  }

  const handleAppendSignature = (signatureContent: string) => {
    const suffix = `\n---\n${signatureContent}`;
    if (threadPosts.length > 0) {
      const lastPost = threadPosts[threadPosts.length - 1];
      setThreadPostContent(
        setThreadPosts,
        lastPost.id,
        lastPost.content + suffix,
        true
      );
    } else {
      setContent((prev) => prev + suffix);
    }
  };

  // ----- Build payload -----
  function buildPayload(status: 'draft') {
    const baseContent = threadPosts.length === 1 ? threadPosts[0].content : content;
    const finalContent = appendSignatureToContent(baseContent);

    const payload: import('@/stores/social-store').CreatePostRequest = {
      content: finalContent,
      accounts: selectedAccountIds,
      hashtags,
      mediaUrls,
      status,
    };

    if (repeatInterval > 0) {
      payload.repeatInterval = repeatInterval;
    }

    // Thread posts (more than 1 post = a thread)
    if (threadPosts.length > 1) {
      const postsWithSig = autoSignatureText
        ? threadPosts.map((tp, i) =>
            i === threadPosts.length - 1
              ? { ...tp, content: appendSignatureToContent(tp.content) }
              : tp
          )
        : threadPosts;
      payload.threadPosts = postsWithSig;
    }

    // Platform overrides
    if (composeMode === 'per-platform') {
      const overrides: Record<string, { content: string; threadPosts?: ThreadPost[] }> = {};
      for (const [platform, posts] of Object.entries(platformThreadOverrides)) {
        const postsWithSig = autoSignatureText
          ? posts.map((p, i) =>
              i === posts.length - 1
                ? { ...p, content: appendSignatureToContent(p.content) }
                : p
            )
          : posts;
        overrides[platform] = {
          content: postsWithSig.map((p) => p.content).join('\n\n'),
          threadPosts: postsWithSig.length > 1 ? postsWithSig : undefined,
        };
      }
      if (Object.keys(overrides).length > 0) {
        payload.platformOverrides = overrides;
      }
    } else if (Object.keys(platformContent).length > 0) {
      payload.platformContent = platformContent;
    }

    return payload;
  }

  // ----- Save / schedule / publish handlers -----
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await createPost(buildPayload('draft'));
      toast.success('Draft saved');
      onSaved?.();
    } catch {
      toast.error("Impossible d'enregistrer draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) return;
    setIsSaving(true);
    try {
      const post = await createPost(buildPayload('draft'));
      const dt = new Date(scheduleDate);
      dt.setHours(parseInt(scheduleHour), parseInt(scheduleMinute), 0, 0);
      await schedulePost(post.id, dt.toISOString(), repeatInterval > 0 ? repeatInterval : undefined);
      toast.success('Post scheduled');
      onSaved?.();
    } catch {
      toast.error('Failed to schedule post');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishNow = async () => {
    setIsSaving(true);
    try {
      const post = await createPost(buildPayload('draft'));
      await publishPost(post.id);
      toast.success('Post published');
      onSaved?.();
    } catch {
      toast.error('Failed to publish post');
    } finally {
      setIsSaving(false);
    }
  };

  // Determine if we have any content at all (for button disabling)
  const hasContent = threadPosts.some((tp) => tp.content.trim().length > 0);

  // ========================================================================
  //  RENDER: Thread post card
  // ========================================================================
  function renderThreadPost(
    post: ThreadPost,
    index: number,
    posts: ThreadPost[],
    setter: React.Dispatch<React.SetStateAction<ThreadPost[]>>,
    syncContent: boolean,
    charLimit?: number
  ) {
    const total = posts.length;
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const textLen = post.content.length;

    return (
      <div key={post.id} className="relative rounded-lg border bg-card p-3 space-y-2">
        {/* Header: numbering + actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Post {index + 1}/{total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Déplacer vers le haut"
              disabled={isFirst}
              onClick={() => moveThreadPost(setter, index, 'up', syncContent)}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Déplacer vers le bas"
              disabled={isLast}
              onClick={() => moveThreadPost(setter, index, 'down', syncContent)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {total > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                aria-label="Supprimer ce post"
                onClick={() => removeThreadPost(setter, post.id, syncContent)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Textarea */}
        <Textarea
          placeholder={isFirst ? "What's on your mind?" : `Thread post ${index + 1}...`}
          value={post.content}
          onChange={(e) => setThreadPostContent(setter, post.id, e.target.value, syncContent)}
          className="min-h-[100px] resize-none text-sm"
        />

        {/* Footer: char count + delay selector */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {textLen} characters
            {charLimit && (
              <span className={`ml-2 ${getCharLimitColor(textLen, charLimit)}`}>
                ({charLimit - textLen >= 0
                  ? `${charLimit - textLen} remaining`
                  : `${Math.abs(charLimit - textLen)} over`})
              </span>
            )}
          </div>
          {!isFirst && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Delay:</span>
              <Select
                value={String(post.delayMinutes)}
                onValueChange={(val) =>
                  setThreadPostDelay(setter, post.id, parseInt(val))
                }
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THREAD_DELAY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========================================================================
  //  RENDER
  // ========================================================================
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left: Compose */}
      <div className="space-y-4">
        {/* AI Generate */}
        <div className="flex gap-2">
          <Input
            placeholder="Topic to generate content about..."
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAiGenerate}
            disabled={isGenerating || !aiTopic}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </div>

        {/* Compose mode toggle: Global vs Per-platform */}
        {selectedPlatforms.length > 1 && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              {composeMode === 'global' ? (
                <Globe className="h-4 w-4 text-primary" />
              ) : (
                <Layers className="h-4 w-4 text-primary" />
              )}
              <span className="font-medium">
                {composeMode === 'global' ? 'Global mode' : 'Per-platform mode'}
              </span>
              <span className="text-xs text-muted-foreground">
                {composeMode === 'global'
                  ? '-- same content for all platforms'
                  : '-- customize per platform'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleComposeMode}
            >
              {composeMode === 'global' ? (
                <>
                  <Layers className="h-3.5 w-3.5 mr-1" />
                  Per-platform
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5 mr-1" />
                  Global
                </>
              )}
            </Button>
          </div>
        )}

        {/* =============== GLOBAL MODE =============== */}
        {composeMode === 'global' && (
          <div className="space-y-3">
            {threadPosts.map((post, i) =>
              renderThreadPost(post, i, threadPosts, setThreadPosts, true)
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => addThreadPost(setThreadPosts, true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Post to Thread
            </Button>
          </div>
        )}

        {/* =============== PER-PLATFORM MODE =============== */}
        {composeMode === 'per-platform' && selectedPlatforms.length > 0 && (
          <Tabs
            value={activePlatformTab || selectedPlatforms[0]}
            onValueChange={setActivePlatformTab}
            className="w-full"
          >
            <TabsList className="w-full flex">
              {selectedPlatforms.map((p) => (
                <TabsTrigger
                  key={p}
                  value={p}
                  className="flex items-center gap-1.5 flex-1"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PLATFORM_COLORS[p] }}
                  />
                  <span className="capitalize text-xs">{PLATFORM_LABELS[p]}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {selectedPlatforms.map((platform) => {
              const limit = getPlatformCharLimit(platform);
              const posts = platformThreadOverrides[platform] ?? threadPosts;
              const platformSetter: React.Dispatch<React.SetStateAction<ThreadPost[]>> = (action) => {
                setPlatformThreadOverrides((prev) => {
                  const current = prev[platform] ?? threadPosts.map((tp) => ({ ...tp, id: nextThreadId() }));
                  const next = typeof action === 'function' ? action(current) : action;
                  return { ...prev, [platform]: next };
                });
              };

              return (
                <TabsContent key={platform} value={platform} className="space-y-3 mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="capitalize font-medium">{PLATFORM_LABELS[platform]}</span>
                    <span>Character limit: {limit.toLocaleString()}</span>
                  </div>
                  {posts.map((post, i) =>
                    renderThreadPost(post, i, posts, platformSetter, false, limit)
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => addThreadPost(platformSetter, false)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Post to Thread
                  </Button>
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {/* Signature selector + auto-signature preview */}
        <div className="flex items-center gap-2">
          <SignatureSelector onSelect={handleAppendSignature} />
          {autoSignature && (
            <span className="text-xs text-muted-foreground">
              Auto-signature: <span className="font-medium">{autoSignature.name}</span>
            </span>
          )}
        </div>

        <Separator />

        {/* Hashtags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Hashtags</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHashtagSuggest}
              disabled={isHashtagLoading || !hasContent}
            >
              <Hash className="h-3 w-3 mr-1" />
              {isHashtagLoading ? 'Chargement...' : 'Suggest'}
            </Button>
          </div>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => removeHashtag(tag)}
                >
                  #{tag}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Interop: Attach Drive files & Doc templates */}
        <div className="flex items-center gap-2 flex-wrap">
          <SocialAttachDrive
            onAttach={(attachments) => {
              const links = attachments.map((a) => `\n📎 ${a.node.name}: ${a.url}`).join('');
              setContent((prev) => prev + links);
            }}
          />
          <DocFromTemplate
            triggerLabel="Modèle doc"
            onInsertContent={(text) => setContent((prev) => prev ? `${prev}\n\n${text}` : text)}
          />
        </div>

        {/* URL Shortener */}
        <div className="flex items-center gap-2">
          <UrlShortenerPopover
            content={content}
            onContentChange={(newContent) => {
              setContent(newContent);
              // Keep thread post #0 in sync
              setThreadPosts((prev) => {
                if (prev.length === 0) return prev;
                const copy = [...prev];
                copy[0] = { ...copy[0], content: newContent };
                return copy;
              });
            }}
          />
        </div>

        {/* Media */}
        <div className="space-y-2">
          <Label className="text-sm">Media</Label>
          <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground text-sm">
            <ImagePlus className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <span>Drag & drop images/video or</span>{' '}
            <button
              className="underline text-primary"
              onClick={() => {
                const url = prompt('Enter image URL:');
                if (url) setMediaUrls((prev) => [...prev, url]);
              }}
            >
              browse
            </button>
          </div>
          {mediaUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-16 w-16 object-cover rounded" />
                  <button
                    aria-label="Supprimer ce média"
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center"
                    onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account selector */}
        <div className="space-y-2">
          <Label className="text-sm">Post to</Label>
          {connectedAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No connected accounts. Add one in Accounts.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connectedAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => toggleAccount(account.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all ${
                    selectedAccountIds.includes(account.id)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="capitalize">{account.platform}</span>
                  <span className="font-medium">@{account.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving || !hasContent}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={!hasContent || selectedAccountIds.length === 0}
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 space-y-3">
              <Calendar
                mode="single"
                selected={scheduleDate}
                onSelect={setScheduleDate}
                disabled={(date) => date < new Date()}
              />
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={scheduleHour}
                  onChange={(e) => setScheduleHour(e.target.value.padStart(2, '0'))}
                  className="w-16 text-center"
                />
                <span>:</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={scheduleMinute}
                  onChange={(e) => setScheduleMinute(e.target.value.padStart(2, '0'))}
                  className="w-16 text-center"
                />
              </div>
              {/* Repeat option */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs">Repeat</Label>
                </div>
                <Select
                  value={String(repeatInterval)}
                  onValueChange={(val) => setRepeatInterval(parseInt(val))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="No repeat" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPEAT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {repeatInterval > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Repeat className="h-3 w-3" />
                    Will repeat every {repeatInterval} day{repeatInterval !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {scheduleDate && (
                <p className="text-xs text-muted-foreground">
                  {format(scheduleDate, 'PPP')} at {scheduleHour}:{scheduleMinute}
                  {repeatInterval > 0 && (
                    <span className="ml-1 font-medium">
                      (repeats every {repeatInterval} day{repeatInterval !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
              )}
              <Button
                className="w-full"
                onClick={handleSchedule}
                disabled={!scheduleDate || isSaving}
              >
                Confirm Schedule
              </Button>
            </PopoverContent>
          </Popover>

          <Button
            onClick={handlePublishNow}
            disabled={isSaving || !hasContent || selectedAccountIds.length === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            Publish Now
          </Button>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Preview</h3>
          {selectedPlatforms.length > 0 && (
            <div className="flex gap-1">
              {selectedPlatforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePreviewPlatform(p)}
                  className={`px-2 py-1 rounded text-xs capitalize transition-colors ${
                    activePreviewPlatform === p
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedPlatforms.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
            Select accounts to see preview
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {(activePreviewPlatform ? [activePreviewPlatform] : selectedPlatforms).map(
              (platform) => {
                const account = selectedAccounts.find((a) => a.platform === platform);
                // Determine which thread to show in preview
                const previewThreads =
                  composeMode === 'per-platform' && platformThreadOverrides[platform]
                    ? platformThreadOverrides[platform]
                    : threadPosts;

                if (previewThreads.length <= 1) {
                  // Single post
                  return (
                    <PostPreview
                      key={platform}
                      platform={platform}
                      content={getContentForPlatform(platform)}
                      accountName={account?.displayName}
                      accountAvatar={account?.avatar}
                      mediaUrls={mediaUrls}
                    />
                  );
                }

                // Thread: render multiple previews with numbering
                return (
                  <div key={platform} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: PLATFORM_COLORS[platform] }}
                      />
                      <span className="text-xs font-semibold capitalize">
                        {PLATFORM_LABELS[platform]} Thread ({previewThreads.length} posts)
                      </span>
                    </div>
                    {previewThreads.map((tp, i) => (
                      <div key={tp.id} className="relative">
                        {i > 0 && (
                          <div className="absolute -top-2 left-6 w-px h-2 bg-border" />
                        )}
                        <PostPreview
                          platform={platform}
                          content={tp.content}
                          accountName={account?.displayName}
                          accountAvatar={account?.avatar}
                          mediaUrls={i === 0 ? mediaUrls : undefined}
                        />
                        {i < previewThreads.length - 1 && tp.delayMinutes > 0 && (
                          <div className="text-center text-[10px] text-muted-foreground py-0.5">
                            {tp.delayMinutes >= 60
                              ? `${tp.delayMinutes / 60}h delay`
                              : `${previewThreads[i + 1]?.delayMinutes ?? 0}m delay`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
