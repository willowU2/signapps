'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, FileText, TrendingUp, Inbox, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useSocialStore } from '@/stores/social-store';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { PLATFORM_COLORS, PLATFORM_LABELS } from './platform-utils';
import type { SocialAccount } from '@/lib/api/social';

function PlatformBadge({ platform }: { platform: SocialAccount['platform'] }) {
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
    fetchAccounts,
    fetchPosts,
    fetchInbox,
    fetchAnalytics,
    isLoadingAnalytics,
  } = useSocialStore();

  useEffect(() => {
    fetchAccounts();
    fetchPosts();
    fetchInbox({ unreadOnly: true });
    fetchAnalytics();
  }, [fetchAccounts, fetchPosts, fetchInbox, fetchAnalytics]);

  const recentPublished = posts
    .filter((p) => p.status === 'published')
    .slice(0, 5);

  const upcomingScheduled = posts
    .filter((p) => p.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 5);

  const unreadCount = inboxItems.filter((i) => !i.read).length;

  const statsCards = [
    {
      title: 'Total Followers',
      value: analytics?.totalFollowers?.toLocaleString() ?? '—',
      change: analytics?.followersGrowth != null ? `+${analytics.followersGrowth}%` : null,
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Posts This Week',
      value: analytics?.postsThisWeek?.toString() ?? '—',
      icon: FileText,
      color: 'text-green-500',
    },
    {
      title: 'Engagement Rate',
      value: analytics?.engagementRate != null ? `${analytics.engagementRate.toFixed(1)}%` : '—',
      icon: TrendingUp,
      color: 'text-purple-500',
    },
    {
      title: 'Pending Inbox',
      value: analytics?.pendingInbox?.toString() ?? unreadCount.toString(),
      icon: Inbox,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SignSocial</h1>
          <p className="text-muted-foreground text-sm">
            {accounts.filter((a) => a.status === 'connected').length} connected account
            {accounts.filter((a) => a.status === 'connected').length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/social/compose">
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold mt-1">
                      {isLoadingAnalytics ? <span className="animate-pulse">…</span> : stat.value}
                    </p>
                    {stat.change && (
                      <p className="text-xs text-green-500 mt-1">{stat.change} this month</p>
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
            <CardTitle className="text-base font-semibold">Recent Posts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/social/calendar">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPublished.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No published posts yet</p>
            ) : (
              recentPublished.map((post) => {
                const platform = accounts.find((a) => post.accounts.includes(a.id))?.platform;
                return (
                  <div key={post.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {platform && <PlatformBadge platform={platform} />}
                        <span className="text-xs text-muted-foreground">
                          {post.publishedAt
                            ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })
                            : ''}
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
            <CardTitle className="text-base font-semibold">Upcoming Scheduled</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/social/calendar">Calendar</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingScheduled.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No scheduled posts</p>
            ) : (
              upcomingScheduled.map((post) => {
                const platform = accounts.find((a) => post.accounts.includes(a.id))?.platform;
                return (
                  <div key={post.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
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

      {/* Connected Accounts Overview */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Connected Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card"
                >
                  {account.avatar ? (
                    <img src={account.avatar} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold"
                      style={{ backgroundColor: PLATFORM_COLORS[account.platform] }}
                    >
                      {account.platform.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium">@{account.username}</span>
                  {account.status !== 'connected' && (
                    <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" asChild>
                <Link href="/social/accounts">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Account
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
