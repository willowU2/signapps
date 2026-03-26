'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Eye, MousePointer, Download } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useSocialStore } from '@/stores/social-store';
import { PLATFORM_COLORS } from './platform-utils';
import { ChannelSidebar } from './channel-sidebar';
import { format, parseISO } from 'date-fns';

export function SocialAnalytics() {
  const {
    analytics,
    followerHistory,
    platformEngagement,
    topPosts,
    accounts,
    fetchAnalytics,
    isLoadingAnalytics,
  } = useSocialStore();

  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const handleChannelSelection = useCallback((ids: string[]) => {
    setSelectedChannelIds(ids);
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const statsCards = [
    {
      title: 'Total Followers',
      value: analytics?.totalFollowers?.toLocaleString() ?? '—',
      change: analytics?.followersGrowth,
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Engagement Rate',
      value: analytics?.engagementRate != null ? `${analytics.engagementRate.toFixed(2)}%` : '—',
      icon: TrendingUp,
      color: 'text-purple-500',
    },
    {
      title: 'Total Reach',
      value: analytics?.totalReach?.toLocaleString() ?? '—',
      icon: Eye,
      color: 'text-green-500',
    },
    {
      title: 'Total Clicks',
      value: analytics?.totalClicks?.toLocaleString() ?? '—',
      icon: MousePointer,
      color: 'text-orange-500',
    },
  ];

  // Group follower history by date, aggregated
  const followerChartData = followerHistory
    .reduce((acc: Record<string, { date: string; [k: string]: number | string }>, point) => {
      const dateKey = point.date.slice(0, 10);
      if (!acc[dateKey]) acc[dateKey] = { date: dateKey };
      acc[dateKey][point.platform] = (acc[dateKey][point.platform] as number ?? 0) + point.followers;
      return acc;
    }, {});

  const followerChartArray = Object.values(followerChartData).slice(-30);

  const engagementChartData = platformEngagement.map((pe) => ({
    platform: pe.platform,
    engagement: pe.engagement,
    posts: pe.posts,
    fill: PLATFORM_COLORS[pe.platform as keyof typeof PLATFORM_COLORS] ?? '#6b7280',
  }));

  const handleExportPDF = () => {
    window.print();
  };

  const platformsInHistory = [...new Set(followerHistory.map((d) => d.platform))];

  return (
    <div className="flex h-full">
      <ChannelSidebar
        selectedAccountIds={selectedChannelIds}
        onSelectionChange={handleChannelSelection}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" />
          Export PDF
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
                      {isLoadingAnalytics ? <span className="animate-pulse text-muted-foreground">…</span> : stat.value}
                    </p>
                    {stat.change != null && (
                      <p className={`text-xs mt-1 ${stat.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stat.change >= 0 ? '+' : ''}{stat.change}% this month
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Followers Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Followers (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {followerChartArray.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={followerChartArray} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => {
                      try { return format(parseISO(val), 'MMM d'); } catch { return val; }
                    }}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(label) => {
                      try { return format(parseISO(label as string), 'PPP'); } catch { return label as string; }
                    }}
                  />
                  <Legend />
                  {platformsInHistory.map((platform) => (
                    <Line
                      key={platform}
                      type="monotone"
                      dataKey={platform}
                      stroke={PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] ?? '#6b7280'}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Engagement by Platform */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            {engagementChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={engagementChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="engagement" name="Engagement %" radius={[4, 4, 0, 0]}>
                    {engagementChartData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Performing Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No post data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b">
                    <th className="text-left pb-2 pr-4">Content</th>
                    <th className="text-left pb-2 pr-4">Platform</th>
                    <th className="text-right pb-2 pr-4">Likes</th>
                    <th className="text-right pb-2 pr-4">Shares</th>
                    <th className="text-right pb-2">Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topPosts.map((post) => {
                    const account = accounts.find((a) => post.accounts.includes(a.id));
                    return (
                      <tr key={post.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-4 max-w-xs">
                          <p className="truncate">{post.content}</p>
                        </td>
                        <td className="py-2 pr-4">
                          {account && (
                            <Badge
                              variant="outline"
                              className="text-xs capitalize"
                              style={{ borderColor: PLATFORM_COLORS[account.platform] }}
                            >
                              {account.platform}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right">{post.likesCount ?? 0}</td>
                        <td className="py-2 pr-4 text-right">{post.sharesCount ?? 0}</td>
                        <td className="py-2 text-right">{post.commentsCount ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
