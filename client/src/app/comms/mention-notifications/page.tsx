"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  AtSign,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Megaphone,
  FileText,
  BarChart3,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  commsApi,
  type MentionNotification,
  type NotifSource,
} from "@/lib/api/comms";

const SOURCE_ICONS: Record<NotifSource, React.ElementType> = {
  announcement: Megaphone,
  document: FileText,
  poll: BarChart3,
  news: Bell,
};

export default function MentionNotificationsPage() {
  usePageTitle("Mentions");
  const {
    data: notifs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<MentionNotification[]>({
    queryKey: ["comms-mention-notifications"],
    queryFn: () => commsApi.listMentions(),
  });
  const [settings, setSettings] = useState({
    announcements: true,
    documents: true,
    polls: true,
    news: true,
    email: false,
    push: true,
  });
  const [tab, setTab] = useState("all");

  const unread = notifs.filter((n) => !n.read).length;
  const filtered = tab === "unread" ? notifs.filter((n) => !n.read) : notifs;

  const markRead = async (id: string) => {
    try {
      await commsApi.markMentionRead(id);
      refetch();
    } catch {
      toast.error("Erreur");
    }
  };

  const markAllRead = async () => {
    try {
      await commsApi.markAllMentionsRead();
      toast.success("Tout marque comme lu");
      refetch();
    } catch {
      toast.error("Erreur");
    }
  };

  const remove = async (id: string) => {
    try {
      await commsApi.deleteMention(id);
      refetch();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const clearAll = async () => {
    try {
      await commsApi.clearAllMentions();
      toast.success("Toutes les notifications effacees");
      refetch();
    } catch {
      toast.error("Erreur");
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <AtSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">@Mention Notifications</h1>
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <AtSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">@Mention Notifications</h1>
              <p className="text-sm text-muted-foreground">
                Erreur de chargement
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 relative">
              <AtSign className="h-5 w-5 text-primary" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                  {unread}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">@Mention Notifications</h1>
              <p className="text-sm text-muted-foreground">
                {unread > 0
                  ? `${unread} unread mention${unread > 1 ? "s" : ""}`
                  : "All caught up!"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {unread > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
            {notifs.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAll}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">All ({notifs.length})</TabsTrigger>
                <TabsTrigger value="unread">
                  Unread{" "}
                  {unread > 0 && (
                    <Badge className="ml-1 h-4 px-1 text-xs">{unread}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value={tab} className="mt-4 space-y-2">
                {filtered.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                      <AtSign className="h-8 w-8 mb-2 opacity-30" />
                      <p>No {tab === "unread" ? "unread " : ""}mentions</p>
                    </CardContent>
                  </Card>
                )}
                {filtered.map((n) => {
                  const Icon = SOURCE_ICONS[n.source];
                  return (
                    <Card
                      key={n.id}
                      className={cn(
                        "transition-colors",
                        !n.read && "border-primary/30 bg-primary/2",
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 mt-0.5">
                            <AvatarFallback className="text-xs">
                              {n.fromInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">
                                {n.from}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {n.message}
                              </span>
                              {!n.read && (
                                <div className="h-2 w-2 rounded-full bg-primary ml-auto shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                              <Icon className="h-3 w-3" />
                              <span className="font-medium text-foreground/70">
                                {n.sourceTitle}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1.5 bg-muted/50 rounded px-2 py-1 italic">
                              &quot;{n.context}&quot;
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(n.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                              <div className="ml-auto flex gap-1">
                                {!n.read && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => markRead(n.id)}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Mark read
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs text-destructive"
                                  onClick={() => remove(n.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>
            </Tabs>
          </div>

          {/* Settings panel */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Notification Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Notify me about mentions in
                  </h3>
                  {[
                    {
                      key: "announcements",
                      label: "Announcements",
                      icon: Megaphone,
                    },
                    { key: "documents", label: "Documents", icon: FileText },
                    { key: "polls", label: "Polls", icon: BarChart3 },
                    { key: "news", label: "News Feed", icon: Bell },
                  ].map(({ key, label, icon: Icon }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between"
                    >
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {label}
                      </Label>
                      <Switch
                        checked={
                          settings[key as keyof typeof settings] as boolean
                        }
                        onCheckedChange={(v) =>
                          setSettings({ ...settings, [key]: v })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Delivery
                  </h3>
                  {[
                    { key: "push", label: "Push notifications" },
                    { key: "email", label: "Email digest" },
                  ].map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between"
                    >
                      <Label className="cursor-pointer">{label}</Label>
                      <Switch
                        checked={
                          settings[key as keyof typeof settings] as boolean
                        }
                        onCheckedChange={(v) => {
                          setSettings({ ...settings, [key]: v });
                          toast.success(
                            `${label} ${v ? "active" : "desactive"}`,
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
