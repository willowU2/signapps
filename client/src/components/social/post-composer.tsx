'use client';

import { useState, useCallback } from 'react';
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
import { Calendar } from '@/components/ui/calendar';
import { Sparkles, Hash, Clock, Send, Save, ImagePlus, X } from 'lucide-react';
import { useSocialStore } from '@/stores/social-store';
import { socialApi } from '@/lib/api/social';
import type { SocialAccount } from '@/lib/api/social';
import { PostPreview } from './post-preview';
import { PLATFORM_LABELS, getPlatformCharLimit, getCharLimitColor } from './platform-utils';
import { format } from 'date-fns';

interface PostComposerProps {
  onSaved?: () => void;
  initialContent?: string;
}

export function PostComposer({ onSaved, initialContent = '' }: PostComposerProps) {
  const { accounts, createPost, schedulePost, publishPost } = useSocialStore();

  const [content, setContent] = useState(initialContent);
  const [platformContent, setPlatformContent] = useState<Record<string, string>>({});
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHashtagLoading, setIsHashtagLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleHour, setScheduleHour] = useState('09');
  const [scheduleMinute, setScheduleMinute] = useState('00');
  const [activePreviewPlatform, setActivePreviewPlatform] = useState<SocialAccount['platform'] | null>(null);

  const connectedAccounts = accounts.filter((a) => a.status === 'connected');

  const toggleAccount = useCallback((id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }, []);

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) return;
    setIsGenerating(true);
    try {
      const res = await socialApi.ai.generate({ topic: aiTopic });
      setContent(res.data.content);
      if (res.data.hashtags.length > 0) setHashtags(res.data.hashtags);
    } catch {
      // silent — backend not running yet
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

  const getContentForPlatform = (platform: SocialAccount['platform']) => {
    return platformContent[platform] ?? content;
  };

  const selectedAccounts = connectedAccounts.filter((a) => selectedAccountIds.includes(a.id));
  const selectedPlatforms = [...new Set(selectedAccounts.map((a) => a.platform))];

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await createPost({
        content,
        platformContent,
        accounts: selectedAccountIds,
        hashtags,
        mediaUrls,
        status: 'draft',
      });
      onSaved?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) return;
    setIsSaving(true);
    try {
      const post = await createPost({
        content,
        platformContent,
        accounts: selectedAccountIds,
        hashtags,
        mediaUrls,
        status: 'draft',
      });
      const dt = new Date(scheduleDate);
      dt.setHours(parseInt(scheduleHour), parseInt(scheduleMinute), 0, 0);
      await schedulePost(post.id, dt.toISOString());
      onSaved?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishNow = async () => {
    setIsSaving(true);
    try {
      const post = await createPost({
        content,
        platformContent,
        accounts: selectedAccountIds,
        hashtags,
        mediaUrls,
        status: 'draft',
      });
      await publishPost(post.id);
      onSaved?.();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left: Compose */}
      <div className="space-y-4">
        {/* AI Generate */}
        <div className="flex gap-2">
          <Input
            placeholder="Topic to generate content about…"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
          />
          <Button variant="outline" size="sm" onClick={handleAiGenerate} disabled={isGenerating || !aiTopic}>
            <Sparkles className="h-4 w-4 mr-1" />
            {isGenerating ? 'Generating…' : 'Generate'}
          </Button>
        </div>

        {/* Main text area */}
        <div className="space-y-1">
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[140px] resize-none"
          />
          <div className="flex justify-end text-xs text-muted-foreground">
            {content.length} characters
          </div>
        </div>

        {/* Hashtags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Hashtags</Label>
            <Button variant="ghost" size="sm" onClick={handleHashtagSuggest} disabled={isHashtagLoading || !content}>
              <Hash className="h-3 w-3 mr-1" />
              {isHashtagLoading ? 'Loading…' : 'Suggest'}
            </Button>
          </div>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeHashtag(tag)}>
                  #{tag}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Media */}
        <div className="space-y-2">
          <Label className="text-sm">Media</Label>
          <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground text-sm">
            <ImagePlus className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <span>Drag & drop images/video or</span>{' '}
            <button className="underline text-primary" onClick={() => {
              const url = prompt('Enter image URL:');
              if (url) setMediaUrls((prev) => [...prev, url]);
            }}>browse</button>
          </div>
          {mediaUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="h-16 w-16 object-cover rounded" />
                  <button
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center"
                    onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account selector */}
        <div className="space-y-2">
          <Label className="text-sm">Post to</Label>
          {connectedAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No connected accounts. Add one in Accounts.</p>
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

        {/* Platform-specific overrides */}
        {selectedPlatforms.length > 1 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Platform-specific content (optional)</Label>
            {selectedPlatforms.map((platform) => {
              const limit = getPlatformCharLimit(platform);
              const text = platformContent[platform] ?? '';
              return (
                <div key={platform} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium capitalize">{PLATFORM_LABELS[platform]}</span>
                    <span className={`text-xs ${getCharLimitColor(text.length || content.length, limit)}`}>
                      {limit - (text.length || content.length)} remaining
                    </span>
                  </div>
                  <Textarea
                    placeholder={`Override for ${PLATFORM_LABELS[platform]} (leave empty to use main text)`}
                    value={text}
                    onChange={(e) => setPlatformContent((prev) => ({ ...prev, [platform]: e.target.value }))}
                    className="text-sm min-h-[80px] resize-none"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving || !content}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={!content || selectedAccountIds.length === 0}>
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
              {scheduleDate && (
                <p className="text-xs text-muted-foreground">
                  {format(scheduleDate, 'PPP')} at {scheduleHour}:{scheduleMinute}
                </p>
              )}
              <Button className="w-full" onClick={handleSchedule} disabled={!scheduleDate || isSaving}>
                Confirm Schedule
              </Button>
            </PopoverContent>
          </Popover>

          <Button
            onClick={handlePublishNow}
            disabled={isSaving || !content || selectedAccountIds.length === 0}
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
                    activePreviewPlatform === p ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
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
            {(activePreviewPlatform ? [activePreviewPlatform] : selectedPlatforms).map((platform) => {
              const account = selectedAccounts.find((a) => a.platform === platform);
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}
