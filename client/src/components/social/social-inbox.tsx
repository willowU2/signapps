/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sparkles, Send, Check, CheckCheck, RefreshCw } from 'lucide-react';
import { useSocialStore } from '@/stores/social-store';
import { InboxItem } from '@/lib/api/social';
import { socialApi } from '@/lib/api/social';
import { PLATFORM_COLORS } from './platform-utils';
import { ChannelSidebar } from './channel-sidebar';
import { formatDistanceToNow } from 'date-fns';

function InboxBadge({ type }: { type: string | undefined }) {
  const map: Record<string, string> = {
    comment: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    mention: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    dm: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${type ? (map[type] ?? '') : ''}`}>
      {type}
    </span>
  );
}

export function SocialInbox() {
  const { inboxItems, accounts, fetchInbox, markInboxRead, replyToInbox, isLoadingInbox } = useSocialStore();

  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const handleChannelSelection = useCallback((ids: string[]) => {
    setSelectedChannelIds(ids);
  }, []);

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchInbox({
      platform: platformFilter !== 'all' ? platformFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      unreadOnly: unreadOnly || undefined,
    });
  }, [fetchInbox, platformFilter, typeFilter, unreadOnly]);

  const loadSmartReplies = async (item: InboxItem) => {
    setIsLoadingReplies(true);
    setSmartReplies([]);
    try {
      const res = await socialApi.ai.smartReplies(item.id);
      setSmartReplies(res.data.suggestions);
    } catch {
      // silent
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const handleSelect = (item: InboxItem) => {
    setSelectedItem(item);
    setReplyText('');
    setSmartReplies([]);
    if (!item.read) {
      markInboxRead(item.id);
    }
  };

  const handleReply = async () => {
    if (!selectedItem || !replyText.trim()) return;
    setIsSending(true);
    try {
      await replyToInbox(selectedItem.id, replyText);
      setReplyText('');
      setSelectedItem(null);
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkRead = async () => {
    for (const id of selectedIds) {
      await markInboxRead(id);
    }
    setSelectedIds(new Set());
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const platforms = [...new Set(inboxItems.map((i) => i.platform).filter((p): p is string => !!p))];

  // Filter inbox items by selected channels
  const filteredInboxItems = selectedChannelIds.length > 0
    ? inboxItems.filter((item) => selectedChannelIds.includes(item.accountId))
    : inboxItems;

  return (
    <div className="flex h-full">
      <ChannelSidebar
        selectedAccountIds={selectedChannelIds}
        onSelectionChange={handleChannelSelection}
      />

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-6 h-full overflow-hidden">
      {/* List */}
      <div className="flex flex-col gap-3 w-full lg:w-80 xl:w-96 shrink-0">
        {/* Filters */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="comment">Comment</SelectItem>
                <SelectItem value="mention">Mention</SelectItem>
                <SelectItem value="dm">DM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch id="unread" checked={unreadOnly} onCheckedChange={setUnreadOnly} />
              <Label htmlFor="unread" className="text-sm">Unread only</Label>
            </div>
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBulkRead}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark {selectedIds.size} read
              </Button>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {isLoadingInbox ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInboxItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inbox is empty</p>
          ) : (
            filteredInboxItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                  selectedItem?.id === item.id
                    ? 'bg-primary/5 border-primary/20'
                    : 'hover:bg-muted/50 border-transparent'
                } ${!item.read ? 'border-l-2 border-l-primary' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelectItem(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 shrink-0"
                />
                {item.authorAvatar ? (
                  <img src={item.authorAvatar} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: PLATFORM_COLORS[item.platform ?? ''] ?? '#6b7280' }}
                  >
                    {item.authorName?.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium">{item.authorName}</span>
                    <InboxBadge type={item.type} />
                    {!item.read && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reply Panel */}
      <div className="flex-1 flex flex-col border rounded-xl overflow-hidden">
        {selectedItem ? (
          <>
            <div className="p-4 border-b space-y-3">
              <div className="flex items-start gap-3">
                {selectedItem.authorAvatar ? (
                  <img src={selectedItem.authorAvatar} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: PLATFORM_COLORS[selectedItem.platform ?? ''] ?? '#6b7280' }}
                  >
                    {selectedItem.authorName?.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{selectedItem.authorName}</span>
                    <span className="text-muted-foreground text-sm">@{selectedItem.authorName}</span>
                    <InboxBadge type={selectedItem.type} />
                    <Badge
                      variant="outline"
                      className="text-xs capitalize"
                      style={{ borderColor: PLATFORM_COLORS[selectedItem.platform ?? ''] }}
                    >
                      {selectedItem.platform}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">{selectedItem.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(selectedItem.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {/* Smart replies */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Reply</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadSmartReplies(selectedItem)}
                  disabled={isLoadingReplies}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-500" />
                  {isLoadingReplies ? 'Loading…' : 'AI Suggestions'}
                </Button>
              </div>

              {smartReplies.length > 0 && (
                <div className="space-y-2">
                  {smartReplies.map((reply, i) => (
                    <button
                      key={i}
                      onClick={() => setReplyText(reply)}
                      className="w-full text-left p-2 text-sm rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}

              <Textarea
                placeholder="Write your reply…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[120px] resize-none"
              />
            </div>

            <div className="p-4 border-t flex gap-2">
              <Button
                className="flex-1"
                onClick={handleReply}
                disabled={isSending || !replyText.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                {isSending ? 'Sending…' : 'Send Reply'}
              </Button>
              <Button
                variant="outline"
                onClick={() => markInboxRead(selectedItem.id)}
              >
                <Check className="h-4 w-4 mr-1" />
                Mark Read
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="font-medium">Select a message to reply</p>
              <p className="text-sm mt-1">Your inbox is organized here</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
