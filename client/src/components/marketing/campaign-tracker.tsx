"use client";

import { useState } from "react";
import { TrendingUp, Mail, Share2, Eye, Zap } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  channel: "email" | "social" | "display" | "search";
  status: "active" | "paused" | "completed" | "draft";
  views: number;
  clicks: number;
  conversions: number;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
}

const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: "1",
    name: "Spring Product Launch",
    channel: "social",
    status: "active",
    views: 12500,
    clicks: 385,
    conversions: 28,
    budget: 5000,
    spent: 3240,
    startDate: "2026-03-01",
    endDate: "2026-03-31",
  },
  {
    id: "2",
    name: "Enterprise Outreach Q1",
    channel: "email",
    status: "active",
    views: 8900,
    clicks: 267,
    conversions: 15,
    budget: 2000,
    spent: 450,
    startDate: "2026-02-15",
    endDate: "2026-04-15",
  },
  {
    id: "3",
    name: "Winter Sale Campaign",
    channel: "display",
    status: "completed",
    views: 34200,
    clicks: 1024,
    conversions: 87,
    budget: 8000,
    spent: 8000,
    startDate: "2025-12-01",
    endDate: "2026-01-31",
  },
  {
    id: "4",
    name: "SMB Growth Initiative",
    channel: "search",
    status: "active",
    views: 5600,
    clicks: 284,
    conversions: 12,
    budget: 3500,
    spent: 2180,
    startDate: "2026-02-01",
    endDate: "2026-04-30",
  },
  {
    id: "5",
    name: "Partnership Announcement",
    channel: "social",
    status: "draft",
    views: 0,
    clicks: 0,
    conversions: 0,
    budget: 4000,
    spent: 0,
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  },
];

function getChannelIcon(channel: string) {
  switch (channel) {
    case "email":
      return <Mail className="w-4 h-4" />;
    case "social":
      return <Share2 className="w-4 h-4" />;
    case "display":
      return <Eye className="w-4 h-4" />;
    case "search":
      return <Zap className="w-4 h-4" />;
    default:
      return null;
  }
}

function getChannelBadgeColor(channel: string): string {
  switch (channel) {
    case "email":
      return "bg-blue-100 text-blue-800";
    case "social":
      return "bg-purple-100 text-purple-800";
    case "display":
      return "bg-green-100 text-green-800";
    case "search":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-muted text-gray-800";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "paused":
      return "bg-yellow-100 text-yellow-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "draft":
      return "bg-muted text-gray-800";
    default:
      return "bg-muted text-gray-800";
  }
}

function calculateCTR(clicks: number, views: number): number {
  return views > 0 ? (clicks / views) * 100 : 0;
}

function calculateConversionRate(conversions: number, clicks: number): number {
  return clicks > 0 ? (conversions / clicks) * 100 : 0;
}

export function CampaignTracker() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(DEFAULT_CAMPAIGNS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggleStatus = (id: string) => {
    setCampaigns(
      campaigns.map((campaign) => {
        if (campaign.id === id) {
          const newStatus = campaign.status === "active" ? "paused" : "active";
          return { ...campaign, status: newStatus };
        }
        return campaign;
      }),
    );
  };

  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const totalViews = campaigns.reduce((sum, c) => sum + c.views, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);
  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Campaign Tracker
          </h2>
          <p className="text-muted-foreground">
            Monitor performance across all channels
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Active Campaigns
          </p>
          <p className="text-3xl font-bold text-blue-900">{activeCampaigns}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Total Views
          </p>
          <p className="text-3xl font-bold text-green-900">
            {(totalViews / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Budget Spent
          </p>
          <p className="text-3xl font-bold text-purple-900">
            ${(totalSpent / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="rounded-lg border bg-orange-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Budget Remaining
          </p>
          <p className="text-3xl font-bold text-orange-900">
            ${((totalBudget - totalSpent) / 1000).toFixed(1)}K
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {campaigns.map((campaign) => {
          const ctr = calculateCTR(campaign.clicks, campaign.views);
          const conversionRate = calculateConversionRate(
            campaign.conversions,
            campaign.clicks,
          );
          const budgetUsed = (campaign.spent / campaign.budget) * 100;
          const isExpanded = expandedId === campaign.id;

          return (
            <div
              key={campaign.id}
              className="border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow"
            >
              <div
                className="p-6 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`p-2 rounded ${getChannelBadgeColor(campaign.channel)}`}
                    >
                      {getChannelIcon(campaign.channel)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {campaign.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(campaign.startDate).toLocaleDateString()} -{" "}
                        {new Date(campaign.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded capitalize ${getStatusColor(campaign.status)}`}
                  >
                    {campaign.status}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">
                      Views
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {(campaign.views / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">
                      Clicks
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {campaign.clicks}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">
                      CTR
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {ctr.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">
                      Conv.
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {conversionRate.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t bg-muted p-6 space-y-6">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-2">
                      Budget
                    </p>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-foreground font-semibold">
                        ${campaign.spent.toLocaleString()} / $
                        {campaign.budget.toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {budgetUsed.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${budgetUsed}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-card p-4 border">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        Total Conversions
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {campaign.conversions}
                      </p>
                    </div>
                    <div className="rounded-lg bg-card p-4 border">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        Cost per Click
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        ${(campaign.spent / campaign.clicks).toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-card p-4 border">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        Cost per Conversion
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        $
                        {campaign.conversions > 0
                          ? (campaign.spent / campaign.conversions).toFixed(2)
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(campaign.id)}
                    className={`w-full py-2 rounded font-medium transition-colors ${
                      campaign.status === "active"
                        ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                        : "bg-green-100 text-green-800 hover:bg-green-200"
                    }`}
                  >
                    {campaign.status === "active"
                      ? "Pause Campaign"
                      : "Activate Campaign"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
