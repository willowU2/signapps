"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Newspaper,
  ThumbsUp,
  MessageSquare,
  Share2,
  Plus,
  Heart,
  Smile,
  Star,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { usePageTitle } from "@/hooks/use-page-title";
import { commsApi, type NewsItem } from "@/lib/api/comms";

const REACTIONS = [
  { emoji: "\u{1F44D}", label: "Like", icon: ThumbsUp },
  { emoji: "\u{2764}\u{FE0F}", label: "Love", icon: Heart },
  { emoji: "\u{1F389}", label: "Celebrate", icon: Star },
  { emoji: "\u{1F604}", label: "Funny", icon: Smile },
];

const categoryColors: Record<string, string> = {
  Business: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  HR: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Tech: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  General: "bg-muted text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function NewsFeedPage() {
  usePageTitle("Fil d'actualite");
  const {
    data: news = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<NewsItem[]>({
    queryKey: ["comms-news-feed"],
    queryFn: () => commsApi.listNews(),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "General",
  });

  const handleReact = (id: string, emoji: string) => {
    commsApi.reactToNews(id, emoji).catch(() => {
      toast.error("Erreur lors de la reaction");
    });
    refetch();
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    try {
      await commsApi.createNews({
        title: form.title,
        content: form.content,
        category: form.category,
      });
      setForm({ title: "", content: "", category: "General" });
      setOpen(false);
      toast.success("Actualite publiee !");
      refetch();
    } catch {
      toast.error("Erreur lors de la publication");
    }
  };

  if (isLoading) {
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
                <p className="text-sm text-muted-foreground">
                  Stay up to date with company news
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Newspaper className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Company News</h1>
              <p className="text-sm text-muted-foreground">
                Stay up to date with company news
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm font-medium">Erreur de chargement</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reessayer
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

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
              <p className="text-sm text-muted-foreground">
                Stay up to date with company news
              </p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Post News
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Post Company News</DialogTitle>
              </DialogHeader>
              <form onSubmit={handlePost} className="space-y-4">
                <Input
                  placeholder="News title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <Textarea
                  placeholder="News content..."
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                  rows={4}
                />
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option>General</option>
                  <option>Business</option>
                  <option>HR</option>
                  <option>Tech</option>
                </select>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">Publish</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {news.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
              <Newspaper className="h-8 w-8 mb-2 opacity-30" />
              <p>Aucune actualite</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {news.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-xs">
                        {item.authorInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {item.author}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.date), {
                            addSuffix: true,
                          })}
                        </span>
                        <Badge
                          className={cn(
                            "text-xs",
                            categoryColors[item.category] ||
                              categoryColors.General,
                          )}
                        >
                          {item.category}
                        </Badge>
                      </div>
                      <h3 className="font-bold mt-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {REACTIONS.map((r) => {
                      const count = item.reactions[r.emoji] || 0;
                      const active = item.userReaction === r.emoji;
                      return count > 0 || active ? (
                        <Button
                          key={r.emoji}
                          variant={active ? "default" : "outline"}
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => handleReact(item.id, r.emoji)}
                        >
                          <span>{r.emoji}</span>
                          <span>{count}</span>
                        </Button>
                      ) : null;
                    })}
                    <div className="ml-auto flex gap-1">
                      {REACTIONS.map((r) => (
                        <Button
                          key={r.emoji}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-base"
                          onClick={() => handleReact(item.id, r.emoji)}
                          title={r.label}
                        >
                          {r.emoji}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <MessageSquare className="h-4 w-4" />
                      {item.comments} comments
                    </button>
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto">
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
