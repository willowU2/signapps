"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Plus,
  TrendingUp,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { usePageTitle } from "@/hooks/use-page-title";
import { commsApi, type Suggestion } from "@/lib/api/comms";

const statusConfig = {
  pending: {
    label: "Pending",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    icon: Clock,
  },
  reviewing: {
    label: "Reviewing",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    icon: TrendingUp,
  },
  accepted: {
    label: "Accepted",
    color:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: ThumbsDown,
  },
};

export default function SuggestionsPage() {
  usePageTitle("Suggestions");
  const {
    data: suggestions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Suggestion[]>({
    queryKey: ["comms-suggestions"],
    queryFn: () => commsApi.listSuggestions(),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "General",
  });
  const [activeTab, setActiveTab] = useState("all");

  const handleVote = async (id: string, dir: "up" | "down") => {
    try {
      await commsApi.voteSuggestion(id, dir);
      refetch();
    } catch {
      toast.error("Erreur lors du vote");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    try {
      await commsApi.createSuggestion({
        title: form.title,
        description: form.description,
        category: form.category,
      });
      setForm({ title: "", description: "", category: "General" });
      setOpen(false);
      toast.success("Suggestion soumise anonymement !");
      refetch();
    } catch {
      toast.error("Erreur lors de la soumission");
    }
  };

  const filtered =
    activeTab === "all"
      ? suggestions
      : suggestions.filter((s) => s.status === activeTab);
  const sorted = [...filtered].sort(
    (a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes),
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Suggestion Box</h1>
              <p className="text-sm text-muted-foreground">
                Anonymous ideas — vote to show support
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Suggestion Box</h1>
              <p className="text-sm text-muted-foreground">
                Anonymous ideas — vote to show support
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
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Suggestion Box</h1>
              <p className="text-sm text-muted-foreground">
                Anonymous ideas — vote to show support
              </p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Suggestion
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit a Suggestion</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  Your suggestion is completely anonymous. No personal
                  information is attached.
                </div>
                <Input
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <Textarea
                  placeholder="Describe your suggestion..."
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
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
                  {[
                    "General",
                    "UX",
                    "Facilities",
                    "Culture",
                    "Technology",
                    "Process",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">Submit Anonymously</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({suggestions.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="reviewing">Reviewing</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="space-y-3 mt-4">
            {sorted.map((s) => {
              const sc = statusConfig[s.status];
              const StatusIcon = sc.icon;
              const score = s.upvotes - s.downvotes;
              return (
                <Card key={s.id}>
                  <CardContent className="p-5">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-1 min-w-[48px]">
                        <Button
                          variant={s.userVote === "up" ? "default" : "ghost"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleVote(s.id, "up")}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <span
                          className={cn(
                            "text-sm font-bold",
                            score > 0
                              ? "text-green-600"
                              : score < 0
                                ? "text-red-600"
                                : "",
                          )}
                        >
                          {score}
                        </span>
                        <Button
                          variant={s.userVote === "down" ? "default" : "ghost"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleVote(s.id, "down")}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <h3 className="font-semibold">{s.title}</h3>
                          <Badge className={cn("text-xs shrink-0", sc.color)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {sc.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {s.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {s.category}
                          </Badge>
                          <span>
                            {formatDistanceToNow(new Date(s.date), {
                              addSuffix: true,
                            })}
                          </span>
                          <span>
                            {s.upvotes} upvotes · {s.downvotes} downvotes
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {sorted.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mb-2 opacity-30" />
                  <p>No suggestions yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
