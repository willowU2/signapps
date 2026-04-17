"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Plus,
  Trash2,
  Check,
  Clock,
  AlertTriangle,
  Users,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  commsApi,
  type Poll,
  type PollResults,
  type CreatePollRequest,
} from "@/lib/api/comms";

// ── Poll card ────────────────────────────────────────────────────────────────

function PollCard({ poll, onRefresh }: { poll: Poll; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const isClosed = poll.closes_at
    ? new Date(poll.closes_at) < new Date()
    : false;

  // Fetch results for this poll
  const { data: results } = useQuery<PollResults>({
    queryKey: ["comms-poll-results", poll.id],
    queryFn: async () => {
      const res = await commsApi.getResults(poll.id);
      return res.data;
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: (optionId: string) => commsApi.vote(poll.id, optionId),
    onSuccess: () => {
      toast.success("Vote recorded!");
      queryClient.invalidateQueries({
        queryKey: ["comms-poll-results", poll.id],
      });
      queryClient.invalidateQueries({ queryKey: ["comms-polls"] });
      onRefresh();
    },
    onError: () => toast.error("Failed to submit vote"),
  });

  // Use results data if available, otherwise fall back to poll options
  const displayOptions = results?.options ?? poll.options;
  const totalVotes =
    results?.total_votes ??
    displayOptions.reduce((s, o) => s + o.vote_count, 0);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={isClosed ? "secondary" : "default"}>
                {isClosed ? "Closed" : "Active"}
              </Badge>
              {poll.is_anonymous && (
                <Badge variant="outline" className="text-xs">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Anonymous
                </Badge>
              )}
              {poll.multiple_choice && (
                <Badge variant="outline" className="text-xs">
                  Multiple choice
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-lg">{poll.question}</h3>
            <p className="text-xs text-muted-foreground">
              <Users className="h-3 w-3 inline mr-1" />
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
              {" · "}
              Created{" "}
              {formatDistanceToNow(new Date(poll.created_at), {
                addSuffix: true,
              })}
              {poll.closes_at && !isClosed && (
                <span>
                  {" · "}
                  <Clock className="h-3 w-3 inline mr-1" />
                  Closes{" "}
                  {formatDistanceToNow(new Date(poll.closes_at), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {displayOptions.map((opt) => {
            const pct =
              totalVotes > 0
                ? Math.round((opt.vote_count / totalVotes) * 100)
                : 0;
            const isWinner =
              isClosed &&
              opt.vote_count ===
                Math.max(...displayOptions.map((o) => o.vote_count)) &&
              opt.vote_count > 0;

            return (
              <div key={opt.id}>
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={() => voteMutation.mutate(opt.id)}
                    disabled={isClosed || voteMutation.isPending}
                    className={`text-sm font-medium flex items-center gap-1 ${
                      isClosed
                        ? "cursor-default"
                        : "hover:text-primary cursor-pointer"
                    }`}
                  >
                    {isWinner && (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    )}
                    {opt.label}
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {pct}% ({opt.vote_count})
                  </span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </div>

        {!isClosed && (
          <p className="text-xs text-muted-foreground text-center">
            Click an option to vote
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Create poll dialog ───────────────────────────────────────────────────────

function CreatePollDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreatePollRequest) => void;
  isPending: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", ""]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [closesAt, setClosesAt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter((o) => o.trim());
    if (!question.trim() || validOptions.length < 2) {
      toast.error("A question and at least 2 options are required");
      return;
    }
    onSubmit({
      question: question.trim(),
      options: validOptions.map((o) => o.trim()),
      multiple_choice: multipleChoice,
      is_anonymous: isAnonymous,
      closes_at: closesAt || undefined,
    });
    setQuestion("");
    setOptions(["", "", ""]);
    setMultipleChoice(false);
    setIsAnonymous(false);
    setClosesAt("");
  };

  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Poll
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a Poll</DialogTitle>
          <DialogDescription>
            Ask your team a question and collect votes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="poll-question">Question</Label>
            <Input
              id="poll-question"
              placeholder="What would you like to ask?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(i)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setOptions([...options, ""])}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Option
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                id="poll-multiple"
                checked={multipleChoice}
                onCheckedChange={setMultipleChoice}
              />
              <Label htmlFor="poll-multiple">Allow multiple choices</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="poll-anonymous"
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
              />
              <Label htmlFor="poll-anonymous">Anonymous voting</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poll-closes">Closes at (optional)</Label>
            <Input
              id="poll-closes"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Poll"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PollsPage() {
  usePageTitle("Sondages");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch polls
  const {
    data: polls = [],
    isLoading,
    isError,
  } = useQuery<Poll[]>({
    queryKey: ["comms-polls"],
    queryFn: async () => {
      const res = await commsApi.listPolls();
      return res.data;
    },
  });

  // Create poll mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePollRequest) => commsApi.createPoll(data),
    onSuccess: () => {
      toast.success("Poll created!");
      queryClient.invalidateQueries({ queryKey: ["comms-polls"] });
      setDialogOpen(false);
    },
    onError: () => toast.error("Failed to create poll"),
  });

  const now = new Date();
  const active = polls.filter(
    (p) => !p.closes_at || new Date(p.closes_at) > now,
  );
  const closed = polls.filter(
    (p) => p.closes_at && new Date(p.closes_at) <= now,
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["comms-polls"] });
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Polls</h1>
              <p className="text-sm text-muted-foreground">
                {active.length} active · {closed.length} closed
              </p>
            </div>
          </div>
          <CreatePollDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onSubmit={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-6 w-3/4" />
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mb-2 text-destructive opacity-60" />
              <p>Failed to load polls</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["comms-polls"] })
                }
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs for active / closed */}
        {!isLoading && !isError && (
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4 mt-4">
              {active.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mb-2 opacity-30" />
                    <p>No active polls</p>
                    <p className="text-xs">Create one to get started</p>
                  </CardContent>
                </Card>
              )}
              {active.map((poll) => (
                <PollCard key={poll.id} poll={poll} onRefresh={handleRefresh} />
              ))}
            </TabsContent>

            <TabsContent value="closed" className="space-y-4 mt-4">
              {closed.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                    <Clock className="h-8 w-8 mb-2 opacity-30" />
                    <p>No closed polls yet</p>
                  </CardContent>
                </Card>
              )}
              {closed.map((poll) => (
                <PollCard key={poll.id} poll={poll} onRefresh={handleRefresh} />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
