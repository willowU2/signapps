'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Share2, X, ExternalLink, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSocialStore } from '@/stores/social-store';
import { PLATFORM_COLORS, PLATFORM_LABELS } from './platform-utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface QuickShareProps {
  /** Custom text to pre-fill (overrides page title auto-detection) */
  text?: string;
  /** Show trigger button (default true). Set false to control via openQuickShare() */
  showButton?: boolean;
}

/**
 * Opens the quick share dialog programmatically from anywhere in the app.
 * Fires a custom event that QuickShare listens for.
 */
export function openQuickShare(text?: string) {
  window.dispatchEvent(new CustomEvent('signapps:quick-share', { detail: { text } }));
}

export function QuickShare({ text, showButton = true }: QuickShareProps) {
  const router = useRouter();
  const { accounts, createPost } = useSocialStore();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uniquePlatforms = useMemo(() => {
    const activePlatforms = accounts.filter((a) => a.isActive).map((a) => a.platform);
    return [...new Set(activePlatforms)];
  }, [accounts]);

  const buildDefaultContent = useCallback(() => {
    if (text) return text;
    if (typeof window === 'undefined') return '';
    const title = document.title.replace(' — SignApps', '').replace(' | SignApps', '');
    const url = window.location.href;
    return `${title}\n${url}`;
  }, [text]);

  const openDialog = useCallback(
    (customText?: string) => {
      setContent(customText ?? buildDefaultContent());
      setSelectedPlatforms(uniquePlatforms.slice(0, 2));
      setOpen(true);
    },
    [buildDefaultContent, uniquePlatforms]
  );

  // Listen for global event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail;
      openDialog(detail?.text);
    };
    window.addEventListener('signapps:quick-share', handler);
    return () => window.removeEventListener('signapps:quick-share', handler);
  }, [openDialog]);

  // Keyboard shortcut Ctrl+Shift+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        openDialog();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openDialog]);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const handleShare = async () => {
    if (!content.trim()) {
      toast.error('Post content is required');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get account IDs for selected platforms
      const accountIds = accounts
        .filter((a) => a.isActive && selectedPlatforms.includes(a.platform))
        .map((a) => a.id);

      await createPost({ content, accountIds, status: 'draft' });
      toast.success('Draft created! Open Compose to schedule or publish.');
      setOpen(false);
    } catch {
      toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenComposer = () => {
    setOpen(false);
    const params = new URLSearchParams({ text: content });
    router.push(`/social/compose?${params.toString()}`);
  };

  return (
    <>
      {showButton && (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => openDialog()}>
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Quick Share
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Keyboard hint */}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Tip: Press{' '}
              <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded font-mono">Ctrl+Shift+S</kbd>
              {' '}to open from anywhere
            </p>

            {/* Post content */}
            <div>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What do you want to share?"
                className="resize-none text-sm"
                rows={4}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">{content.length} characters</p>
            </div>

            {/* Platform selection */}
            <div>
              <p className="text-xs font-medium mb-2">Post to:</p>
              {uniquePlatforms.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No connected accounts.{' '}
                  <a href="/social/accounts" className="underline">Connect accounts</a>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {uniquePlatforms.map((platform) => {
                    const active = selectedPlatforms.includes(platform);
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => togglePlatform(platform)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${
                          active ? 'text-white border-transparent' : 'text-foreground border-border hover:border-primary/40'
                        }`}
                        style={active ? { backgroundColor: PLATFORM_COLORS[platform] ?? '#6b7280' } : {}}
                      >
                        {PLATFORM_LABELS[platform] ?? platform}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2"
                onClick={handleShare}
                disabled={isSubmitting || !content.trim() || selectedPlatforms.length === 0}
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Creating draft…' : 'Save as Draft'}
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleOpenComposer}>
                <ExternalLink className="w-4 h-4" />
                Open Composer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
