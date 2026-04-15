"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, RefreshCw, Rss } from "lucide-react";
import { useSocialStore } from "@/stores/social-store";
import { RssFeed } from "@/lib/api/social";
import { PLATFORM_COLORS } from "./platform-utils";
import { formatDistanceToNow } from "date-fns";

function AddFeedDialog({
  open,
  onClose,
  accountOptions,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  accountOptions: { id: string; label: string; platform: string }[];
  onCreate: (data: Partial<RssFeed> & Pick<RssFeed, "name">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [template, setTemplate] = useState(
    "{{title}}\n\n{{description}}\n\n{{link}}",
  );
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    if (!name || !url) return;
    setIsSaving(true);
    try {
      await onCreate({
        name,
        url,
        template,
        targetAccountIds: selectedAccountIds,
        active: true,
      });
      setName("");
      setUrl("");
      setTemplate("{{title}}\n\n{{description}}\n\n{{link}}");
      setSelectedAccountIds([]);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add RSS Feed</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Feed Name</Label>
            <Input
              placeholder="My Tech Blog"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Feed URL</Label>
            <Input
              placeholder="https://example.com/rss.xml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Post Template</Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="min-h-[100px] font-mono text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Variables:{" "}
              <code className="bg-muted px-1 rounded">{"{{title}}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{{link}}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{{description}}"}</code>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Post to Accounts</Label>
            <div className="flex flex-wrap gap-2">
              {accountOptions.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => toggleAccount(acc.id)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    selectedAccountIds.includes(acc.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {acc.label}
                </button>
              ))}
              {accountOptions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No connected accounts
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={isSaving || !name || !url}
            >
              {isSaving ? "Creating…" : "Create Feed"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RssManager() {
  const {
    rssFeeds,
    accounts,
    fetchRssFeeds,
    createRssFeed,
    deleteRssFeed,
    toggleRssFeed,
    checkRssFeed,
  } = useSocialStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRssFeeds();
  }, [fetchRssFeeds]);

  const accountOptions = accounts
    .filter((a) => a.status === "connected")
    .map((a) => ({
      id: a.id,
      label: `@${a.username} (${a.platform})`,
      platform: a.platform,
    }));

  const handleCheckNow = async (id: string) => {
    setCheckingId(id);
    try {
      await checkRssFeed(id);
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">RSS Feeds</h2>
          <p className="text-sm text-muted-foreground">
            Auto-post from RSS to your social accounts
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Feed
        </Button>
      </div>

      {rssFeeds.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <Rss className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="font-medium">No RSS feeds configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a feed to automatically post updates to your accounts
          </p>
          <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add your first feed
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rssFeeds.map((feed) => {
            const targetAccounts = accounts.filter((a) =>
              feed.targetAccountIds.includes(a.id),
            );
            return (
              <Card key={feed.id}>
                <CardContent className="py-4 px-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg shrink-0">
                      <Rss className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{feed.name}</span>
                        <Badge variant={feed.active ? "default" : "secondary"}>
                          {feed.active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {feed.url}
                      </p>
                      {feed.lastCheckedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last checked{" "}
                          {formatDistanceToNow(new Date(feed.lastCheckedAt), {
                            addSuffix: true,
                          })}
                        </p>
                      )}
                      {targetAccounts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {targetAccounts.map((acc) => (
                            <span
                              key={acc.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-white"
                              style={{
                                backgroundColor: PLATFORM_COLORS[acc.platform],
                              }}
                            >
                              @{acc.username}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={feed.active}
                        onCheckedChange={(v) => toggleRssFeed(feed.id, v)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCheckNow(feed.id)}
                        disabled={checkingId === feed.id}
                        title="Check now"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${checkingId === feed.id ? "animate-spin" : ""}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteRssFeed(feed.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddFeedDialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        accountOptions={accountOptions}
        onCreate={createRssFeed}
      />
    </div>
  );
}
