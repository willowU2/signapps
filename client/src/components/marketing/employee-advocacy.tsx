"use client";

import { useState } from "react";
import { Share2, BarChart3, Users, TrendingUp } from "lucide-react";

interface ShareableContent {
  id: string;
  title: string;
  description: string;
  type: "article" | "video" | "infographic" | "whitepaper";
  link: string;
  createdDate: string;
  totalShares: number;
  engagementRate: number;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  influenceScore: number;
  totalShares: number;
  totalReaches: number;
  engagementRate: number;
  followers: number;
}

const DEFAULT_CONTENT: ShareableContent[] = [
  {
    id: "1",
    title: "How SignApps is Transforming SMB Operations",
    description: "An in-depth look at how our platform helps small businesses scale efficiently.",
    type: "article",
    link: "https://blog.signapps.com/smboperations",
    createdDate: "2026-03-18",
    totalShares: 127,
    engagementRate: 8.3,
  },
  {
    id: "2",
    title: "Product Demo: New AI-Powered Workflows",
    description: "Watch our latest automation features in action.",
    type: "video",
    link: "https://video.signapps.com/ai-workflows-2026",
    createdDate: "2026-03-15",
    totalShares: 89,
    engagementRate: 12.5,
  },
  {
    id: "3",
    title: "2026 Digital Workplace Trends",
    description: "Key trends shaping the future of enterprise software.",
    type: "infographic",
    link: "https://assets.signapps.com/trends-2026.pdf",
    createdDate: "2026-03-10",
    totalShares: 203,
    engagementRate: 15.2,
  },
  {
    id: "4",
    title: "Enterprise Security & Compliance Guide",
    description: "Comprehensive whitepaper on data protection in SignApps.",
    type: "whitepaper",
    link: "https://assets.signapps.com/security-guide-2026.pdf",
    createdDate: "2026-03-01",
    totalShares: 67,
    engagementRate: 6.8,
  },
];

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: "1",
    name: "Alice Johnson",
    role: "VP Product",
    influenceScore: 92,
    totalShares: 45,
    totalReaches: 12400,
    engagementRate: 9.2,
    followers: 3200,
  },
  {
    id: "2",
    name: "Bob Chen",
    role: "DevOps Lead",
    influenceScore: 78,
    totalShares: 32,
    totalReaches: 8900,
    engagementRate: 7.5,
    followers: 1850,
  },
  {
    id: "3",
    name: "Carol Davis",
    role: "Design Manager",
    influenceScore: 85,
    totalShares: 38,
    totalReaches: 10200,
    engagementRate: 8.8,
    followers: 2500,
  },
  {
    id: "4",
    name: "David Wilson",
    role: "Customer Success Lead",
    influenceScore: 72,
    totalShares: 28,
    totalReaches: 7600,
    engagementRate: 6.9,
    followers: 1450,
  },
  {
    id: "5",
    name: "Emma Brown",
    role: "Marketing Manager",
    influenceScore: 88,
    totalShares: 51,
    totalReaches: 13800,
    engagementRate: 10.1,
    followers: 2950,
  },
];

function getContentTypeIcon(type: string): string {
  switch (type) {
    case "article":
      return "📄";
    case "video":
      return "🎥";
    case "infographic":
      return "📊";
    case "whitepaper":
      return "📋";
    default:
      return "📌";
  }
}

function getContentTypeColor(type: string): string {
  switch (type) {
    case "article":
      return "bg-blue-100 text-blue-800";
    case "video":
      return "bg-purple-100 text-purple-800";
    case "infographic":
      return "bg-green-100 text-green-800";
    case "whitepaper":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getInfluenceColor(score: number): string {
  if (score >= 85) return "text-green-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

export function EmployeeAdvocacy() {
  const [content, setContent] = useState<ShareableContent[]>(DEFAULT_CONTENT);
  const [employees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [activeTab, setActiveTab] = useState<"content" | "advocates">("content");

  const totalReaches = employees.reduce((sum, e) => sum + e.totalReaches, 0);
  const avgEngagement = (
    employees.reduce((sum, e) => sum + e.engagementRate, 0) / employees.length
  ).toFixed(1);
  const topAdvocate = employees.reduce((prev, current) =>
    prev.influenceScore > current.influenceScore ? prev : current
  );

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Advocacy</h2>
          <p className="text-gray-600">Amplify your reach through employee networks</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Active Advocates</p>
          <p className="text-3xl font-bold text-blue-900">{employees.length}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Total Reaches</p>
          <p className="text-3xl font-bold text-green-900">
            {(totalReaches / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Avg Engagement</p>
          <p className="text-3xl font-bold text-purple-900">{avgEngagement}%</p>
        </div>
        <div className="rounded-lg border bg-orange-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Top Advocate</p>
          <p className="text-lg font-bold text-orange-900">{topAdvocate.name}</p>
          <p className="text-xs text-gray-600">{topAdvocate.role}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b flex gap-1 bg-white rounded-lg p-1">
        <button
          onClick={() => setActiveTab("content")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === "content"
              ? "bg-blue-100 text-blue-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Shareable Content
        </button>
        <button
          onClick={() => setActiveTab("advocates")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === "advocates"
              ? "bg-blue-100 text-blue-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Top Advocates
        </button>
      </div>

      {/* Shareable Content Tab */}
      {activeTab === "content" && (
        <div className="space-y-4">
          {content.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg p-6 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <span className="text-3xl">{getContentTypeIcon(item.type)}</span>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded capitalize ${getContentTypeColor(item.type)}`}
                      >
                        {item.type}
                      </span>
                      <p className="text-xs text-gray-500">
                        {new Date(item.createdDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-t border-b">
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-1">
                    Total Shares
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {item.totalShares}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-1">
                    Engagement Rate
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {item.engagementRate}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-1">
                    Estimated Reach
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {(item.totalShares * 95).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleCopyLink(item.link)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <Share2 className="w-4 h-4" />
                Copy Share Link
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Top Advocates Tab */}
      {activeTab === "advocates" && (
        <div className="space-y-4">
          {employees
            .sort((a, b) => b.influenceScore - a.influenceScore)
            .map((employee) => (
              <div
                key={employee.id}
                className="border rounded-lg p-6 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {employee.name}
                    </h3>
                    <p className="text-sm text-gray-600">{employee.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 font-medium mb-1">
                      Influence Score
                    </p>
                    <p
                      className={`text-3xl font-bold ${getInfluenceColor(employee.influenceScore)}`}
                    >
                      {employee.influenceScore}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs text-gray-600 font-medium mb-1">
                      Total Shares
                    </p>
                    <p className="text-2xl font-bold text-blue-900">
                      {employee.totalShares}
                    </p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-xs text-gray-600 font-medium mb-1">
                      Total Reaches
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {(employee.totalReaches / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-3">
                    <p className="text-xs text-gray-600 font-medium mb-1">
                      Engagement
                    </p>
                    <p className="text-2xl font-bold text-purple-900">
                      {employee.engagementRate}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3">
                    <p className="text-xs text-gray-600 font-medium mb-1">
                      Followers
                    </p>
                    <p className="text-2xl font-bold text-orange-900">
                      {(employee.followers / 1000).toFixed(1)}K
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-gray-900">
                      Top performer in advocacy metrics
                    </p>
                  </div>
                  <button className="px-4 py-2 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium text-sm">
                    View Profile
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
