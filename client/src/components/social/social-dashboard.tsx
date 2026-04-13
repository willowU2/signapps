/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  FileText,
  TrendingUp,
  Inbox,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  ClipboardList,
  CheckCheck,
  XCircle,
} from "lucide-react";
import { useSocialStore } from "@/stores/social-store";
import { socialApi } from "@/lib/api/social";
import { toast } from "sonner";
import type { SocialPost } from "@/lib/api/social";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "./platform-utils";
import { ChannelSidebar } from "./channel-sidebar";
import { StreakCounter } from "./streak-counter";
import type { SocialAccount } from "@/lib/api/social";
import { SocialPostFromDoc } from "@/components/interop/SocialPostFromDoc";
import { SocialAnalyticsDocLink } from "@/components/interop/SocialAnalyticsDocLink";
import { UnifiedContentLibrary } from "@/components/interop/UnifiedContentLibrary";

function PlatformBadge({ platform }: { platform: SocialAccount["platform"] }) {
  const color = PLATFORM_COLORS[platform];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white capitalize"
      style={{ backgroundColor: color }}
    >
      {platform}
    </span>
  );
}

export function SocialDashboard() {
  const {
    accounts,
    posts,
    inboxItems,
    analytics,
    error: socialError,
    fetchAccounts,
    fetchPosts,
    fetchInbox,
    fetchAnalytics,
    isLoadingAnalytics,
  } = useSocialStore();

  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [reviewQueue, setReviewQueue] = useState<SocialPost[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const loadReviewQueue = useCallback(async () => {
    setReviewLoading(true);
    try {
      const res = await socialApi.posts.listReviewQueue();
      setReviewQueue(res.data);
    } catch {
      // silently ignore — service may not be running
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const handleApprove = async (postId: string) => {
    try {
      await socialApi.posts.approve(postId);
      setReviewQueue((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post approved");
    } catch {
      toast.error("Failed to approve post");
    }
  };

  const handleReject = async (postId: string) => {
    const reason = prompt("Rejection reason (optional):") ?? undefined;
    try {
      await socialApi.posts.reject(postId, reason);
      setReviewQueue((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post rejected");
    } catch {
      toast.error("Failed to reject post");
    }
  };

  const reload = () => {
    fetchAccounts();
    fetchPosts();
    fetchInbox({ unreadOnly: true });
    fetchAnalytics();
    loadReviewQueue();
  };

  useEffect(() => {
    fetchAccounts();
    fetchPosts();
    fetchInbox({ unreadOnly: true });
    fetchAnalytics();
    loadReviewQueue();
  }, [fetchAccounts, fetchPosts, fetchInbox, fetchAnalytics, loadReviewQueue]);

  const handleChannelSelection = useCallback((ids: string[]) => {
    setSelectedChannelIds(ids);
  }, []);

  // Filter posts by selected channels
  const filteredPosts =
    selectedChannelIds.length > 0
      ? posts.filter((p) =>
          (p.accounts ?? []).some((aid) => selectedChannelIds.includes(aid)),
        )
      : posts;

  const recentPublished = filteredPosts
    .filter((p) => p.status === "published")
    .slice(0, 5);

  const upcomingScheduled = filteredPosts
    .filter((p) => p.status === "scheduled")
    .sort(
      (a, b) =>
        new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
    )
    .slice(0, 5);

  const unreadCount = inboxItems.filter((i) => !i.read).length;

  const statsCards = [
    {
      title: "Abonnés total",
      value: analytics?.totalFollowers?.toLocaleString() ?? "\u2014",
      change:
        analytics?.followersGrowth != null
          ? `+${analytics.followersGrowth}%`
          : null,
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Posts cette semaine",
      value: analytics?.postsThisWeek?.toString() ?? "\u2014",
      icon: FileText,
      color: "text-green-500",
    },
    {
      title: "Taux d'engagement",
      value:
        analytics?.engagementRate != null
          ? `${analytics.engagementRate.toFixed(1)}%`
          : "\u2014",
      icon: TrendingUp,
      color: "text-purple-500",
    },
    {
      title: "Messages en attente",
      value: analytics?.pendingInbox?.toString() ?? unreadCount.toString(),
      icon: Inbox,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="flex h-full">
      <ChannelSidebar
        selectedAccountIds={selectedChannelIds}
        onSelectionChange={handleChannelSelection}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* API Error Banner */}
        {socialError && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                Service social indisponible : {socialError}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reload}>
              Réessayer
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">SignSocial</h1>
              <p className="text-muted-foreground text-sm">
                {accounts.filter((a) => a.status === "connected").length} compte
                {accounts.filter((a) => a.status === "connected").length !== 1
                  ? "s"
                  : ""}{" "}
                connecté
                {accounts.filter((a) => a.status === "connected").length !== 1
                  ? "s"
                  : ""}
              </p>
            </div>
            <StreakCounter />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SocialPostFromDoc />
            <SocialAnalyticsDocLink />
            <UnifiedContentLibrary />
            <Button asChild>
              <Link href="/social/compose">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau post
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statsCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {isLoadingAnalytics ? (
                          <span className="animate-pulse">{"\u2026"}</span>
                        ) : (
                          stat.value
                        )}
                      </p>
                      {stat.change && (
                        <p className="text-xs text-green-500 mt-1">
                          {stat.change} ce mois
                        </p>
                      )}
                    </div>
                    <div className={`p-2 bg-muted rounded-lg ${stat.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Published Posts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                Posts récents
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/social/calendar">Voir tout</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentPublished.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium">Aucun post publie</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vos publications recentes apparaitront ici.
                  </p>
                </div>
              ) : (
                recentPublished.map((post) => {
                  const platform = accounts.find((a) =>
                    (post.accounts ?? []).includes(a.id),
                  )?.platform;
                  return (
                    <div
                      key={post.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{post.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {platform && <PlatformBadge platform={platform} />}
                          <span className="text-xs text-muted-foreground">
                            {post.publishedAt
                              ? formatDistanceToNow(
                                  new Date(post.publishedAt),
                                  { addSuffix: true },
                                )
                              : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Upcoming Scheduled */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                Prochains programmés
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/social/calendar">Calendrier</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingScheduled.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium">Aucun post programme</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Planifiez vos prochaines publications.
                  </p>
                </div>
              ) : (
                upcomingScheduled.map((post) => {
                  const platform = accounts.find((a) =>
                    (post.accounts ?? []).includes(a.id),
                  )?.platform;
                  return (
                    <div
                      key={post.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{post.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {platform && <PlatformBadge platform={platform} />}
                          {post.scheduledAt && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.scheduledAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Review Queue */}
        {(reviewQueue.length > 0 || reviewLoading) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-500" />
                Review Queue
                {reviewQueue.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {reviewQueue.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviewLoading ? (
                <p className="text-sm text-muted-foreground text-center py-2 animate-pulse">
                  Loading…
                </p>
              ) : reviewQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  File d'attente vide
                </p>
              ) : (
                reviewQueue.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start gap-3 p-2 rounded-lg border bg-muted/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{post.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted {new Date(post.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-green-600 border-green-600 hover:bg-green-50"
                        onClick={() => handleApprove(post.id)}
                      >
                        <CheckCheck className="h-3.5 w-3.5 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => handleReject(post.id)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Connecté Accounts Overview */}
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">
                Connectez votre premier compte social
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Publiez sur toutes vos plateformes depuis un seul endroit
              </p>
              <Button className="mt-4" asChild>
                <Link href="/social/accounts">
                  <Plus className="mr-2 h-4 w-4" /> Connecter un compte
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Comptes connectés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card"
                  >
                    {account.avatar ? (
                      <img
                        src={account.avatar}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold"
                        style={{
                          backgroundColor: PLATFORM_COLORS[account.platform],
                        }}
                      >
                        {account.platform.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium">
                      @{account.username}
                    </span>
                    {account.status !== "connected" && (
                      <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" asChild>
                  <Link href="/social/accounts">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Ajouter un compte
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
