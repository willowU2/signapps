"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  Plus,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  commsApi,
  type Announcement,
  type AnnouncementPriority,
  type CreateAnnouncementRequest,
} from "@/lib/api/comms";

// ── Priority metadata ────────────────────────────────────────────────────────

const PRIORITY_META: Record<
  AnnouncementPriority,
  { label: string; color: string; icon: React.ElementType }
> = {
  low: { label: "Low", color: "bg-muted text-muted-foreground", icon: Clock },
  normal: {
    label: "Normal",
    color: "bg-blue-500/10 text-blue-600",
    icon: Megaphone,
  },
  high: {
    label: "High",
    color: "bg-orange-500/10 text-orange-600",
    icon: AlertTriangle,
  },
  urgent: {
    label: "Urgent",
    color: "bg-red-500/10 text-red-600",
    icon: AlertTriangle,
  },
};

// ── Announcement card ────────────────────────────────────────────────────────

function AnnouncementCard({
  announcement,
  onMarkRead,
  onAcknowledge,
  isMarkingRead,
  isAcknowledging,
}: {
  announcement: Announcement;
  onMarkRead: (id: string) => void;
  onAcknowledge: (id: string) => void;
  isMarkingRead: boolean;
  isAcknowledging: boolean;
}) {
  const priority = PRIORITY_META[announcement.priority];
  const PriorityIcon = priority.icon;

  return (
    <Card
      className={`transition-shadow hover:shadow-md ${
        !announcement.is_read ? "border-primary/30 bg-primary/5" : ""
      }`}
    >
      <CardContent className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={priority.color}>
                <PriorityIcon className="h-3 w-3 mr-1" />
                {priority.label}
              </Badge>
              {!announcement.is_read && (
                <Badge variant="default" className="text-xs">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Unread
                </Badge>
              )}
              {announcement.requires_acknowledgement &&
                !announcement.is_acknowledged && (
                  <Badge variant="destructive" className="text-xs">
                    Acknowledgement required
                  </Badge>
                )}
              {announcement.is_acknowledged && (
                <Badge
                  variant="outline"
                  className="text-xs text-green-600 border-green-300"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Acknowledged
                </Badge>
              )}
            </div>
            <h3 className="text-lg font-semibold">{announcement.title}</h3>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(
                new Date(announcement.published_at || announcement.created_at),
                {
                  addSuffix: true,
                },
              )}
              {announcement.expires_at && (
                <span className="ml-2">
                  · Expires{" "}
                  {formatDistanceToNow(new Date(announcement.expires_at), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </p>
          </div>
        </div>

        <p className="text-sm text-foreground whitespace-pre-wrap">
          {announcement.content}
        </p>

        <div className="flex items-center gap-2 pt-1">
          {!announcement.is_read && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMarkRead(announcement.id)}
              disabled={isMarkingRead}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Mark as read
            </Button>
          )}
          {announcement.requires_acknowledgement &&
            !announcement.is_acknowledged && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onAcknowledge(announcement.id)}
                disabled={isAcknowledging}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Acknowledge
              </Button>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create announcement dialog ───────────────────────────────────────────────

function CreateAnnouncementDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAnnouncementRequest) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [requiresAck, setRequiresAck] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    onSubmit({
      title: title.trim(),
      content: content.trim(),
      priority,
      requires_acknowledgement: requiresAck,
      expires_at: expiresAt || undefined,
    });
    setTitle("");
    setContent("");
    setPriority("normal");
    setRequiresAck(false);
    setExpiresAt("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Announcement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Announcement</DialogTitle>
          <DialogDescription>
            Publish an announcement visible to the whole organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              placeholder="Announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-content">Content</Label>
            <Textarea
              id="ann-content"
              placeholder="Write the announcement body..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as AnnouncementPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-expires">Expires at</Label>
              <Input
                id="ann-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="ann-ack"
              checked={requiresAck}
              onCheckedChange={setRequiresAck}
            />
            <Label htmlFor="ann-ack">Requires acknowledgement</Label>
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
              {isPending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  usePageTitle("Annonces");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch announcements
  const {
    data: announcements = [],
    isLoading,
    isError,
  } = useQuery<Announcement[]>({
    queryKey: ["comms-announcements"],
    queryFn: async () => {
      const res = await commsApi.listAnnouncements();
      return res.data;
    },
  });

  // Create announcement mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateAnnouncementRequest) =>
      commsApi.createAnnouncement(data),
    onSuccess: () => {
      toast.success("Announcement published");
      queryClient.invalidateQueries({ queryKey: ["comms-announcements"] });
      setDialogOpen(false);
    },
    onError: () => toast.error("Failed to create announcement"),
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => commsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comms-announcements"] });
    },
    onError: () => toast.error("Failed to mark as read"),
  });

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => commsApi.acknowledge(id),
    onSuccess: () => {
      toast.success("Announcement acknowledged");
      queryClient.invalidateQueries({ queryKey: ["comms-announcements"] });
    },
    onError: () => toast.error("Failed to acknowledge"),
  });

  // Separate pinned / regular and sort by date
  const sorted = [...announcements].sort((a, b) => {
    const aTime = new Date(a.published_at || a.created_at).getTime();
    const bTime = new Date(b.published_at || b.created_at).getTime();
    return bTime - aTime;
  });

  const unreadCount = announcements.filter((a) => !a.is_read).length;
  const pendingAckCount = announcements.filter(
    (a) => a.requires_acknowledgement && !a.is_acknowledged,
  ).length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Announcements</h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 && (
                  <span className="font-medium text-primary">
                    {unreadCount} unread
                  </span>
                )}
                {unreadCount > 0 && pendingAckCount > 0 && " · "}
                {pendingAckCount > 0 && (
                  <span className="font-medium text-destructive">
                    {pendingAckCount} pending acknowledgement
                  </span>
                )}
                {unreadCount === 0 && pendingAckCount === 0 && "All caught up"}
              </p>
            </div>
          </div>
          <CreateAnnouncementDialog
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
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
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
              <p>Failed to load announcements</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["comms-announcements"],
                  })
                }
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && !isError && sorted.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
              <Megaphone className="h-8 w-8 mb-2 opacity-30" />
              <p>No announcements yet</p>
              <p className="text-xs">Create one to get started</p>
            </CardContent>
          </Card>
        )}

        {/* Announcement list */}
        {!isLoading && !isError && sorted.length > 0 && (
          <div className="space-y-4">
            {sorted.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                onMarkRead={(id) => markReadMutation.mutate(id)}
                onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                isMarkingRead={markReadMutation.isPending}
                isAcknowledging={acknowledgeMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
