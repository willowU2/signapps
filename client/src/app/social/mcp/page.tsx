"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { Bot, Wrench, Code2, Zap, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MCP_TOOLS = [
  {
    name: "create_post",
    description: "Create a new social media post (draft or immediate publish)",
    params: [
      {
        name: "content",
        type: "string",
        required: true,
        description: "Post text content",
      },
      {
        name: "account_ids",
        type: "string[]",
        required: true,
        description: "Target account IDs",
      },
      {
        name: "hashtags",
        type: "string[]",
        required: false,
        description: "Hashtag list (without #)",
      },
      {
        name: "media_urls",
        type: "string[]",
        required: false,
        description: "Image/video URLs to attach",
      },
    ],
    example: `{
  "content": "Exciting news! Our new feature just launched 🚀",
  "account_ids": ["acc_twitter_main"],
  "hashtags": ["product", "launch", "saas"]
}`,
  },
  {
    name: "schedule_post",
    description: "Schedule a draft post at a specific date and time",
    params: [
      {
        name: "post_id",
        type: "string",
        required: true,
        description: "ID of an existing draft post",
      },
      {
        name: "scheduled_at",
        type: "ISO 8601",
        required: true,
        description: "When to publish the post",
      },
    ],
    example: `{
  "post_id": "post_abc123",
  "scheduled_at": "2026-04-01T09:00:00Z"
}`,
  },
  {
    name: "get_analytics",
    description:
      "Retrieve analytics overview: followers, engagement rate, reach, top posts",
    params: [
      {
        name: "period",
        type: "string",
        required: false,
        description: "7d | 30d | 90d (default: 30d)",
      },
      {
        name: "platform",
        type: "string",
        required: false,
        description: "Filter by platform",
      },
    ],
    example: `{
  "period": "30d",
  "platform": "linkedin"
}`,
  },
  {
    name: "list_accounts",
    description: "List all connected social media accounts",
    params: [
      {
        name: "platform",
        type: "string",
        required: false,
        description: "Filter by platform",
      },
      {
        name: "active_only",
        type: "boolean",
        required: false,
        description: "Only return active accounts",
      },
    ],
    example: `{
  "active_only": true
}`,
  },
  {
    name: "get_inbox",
    description: "Fetch inbox items: mentions, comments, direct messages",
    params: [
      {
        name: "type",
        type: "string",
        required: false,
        description: "mention | comment | dm",
      },
      {
        name: "unread_only",
        type: "boolean",
        required: false,
        description: "Only unread items",
      },
      {
        name: "limit",
        type: "integer",
        required: false,
        description: "Max items to return (default 20)",
      },
    ],
    example: `{
  "type": "mention",
  "unread_only": true
}`,
  },
  {
    name: "reply_to_inbox",
    description: "Reply to an inbox item (comment, mention or DM)",
    params: [
      {
        name: "inbox_item_id",
        type: "string",
        required: true,
        description: "ID of the inbox item to reply to",
      },
      {
        name: "content",
        type: "string",
        required: true,
        description: "Reply text",
      },
    ],
    example: `{
  "inbox_item_id": "inbox_456",
  "content": "Thanks for your feedback! We're looking into it 🙏"
}`,
  },
];

const CONFIG_EXAMPLE = `{
  "mcpServers": {
    "signapps-social": {
      "command": "npx",
      "args": ["-y", "@signapps/mcp-server"],
      "env": {
        "SIGNAPPS_API_KEY": "your_api_key_here",
        "SIGNAPPS_BASE_URL": "https://app.signapps.io"
      }
    }
  }
}`;

const CLAUDE_EXAMPLE = `User: Post a motivational quote for Monday morning to LinkedIn

Claude uses: create_post({
  content: "Monday is not the enemy — it's an opportunity. 🌟 What's one goal you're tackling this week?",
  account_ids: ["acc_linkedin_main"],
  hashtags: ["motivation", "monday", "productivity"]
})

Result: Draft created (post_xyz). Scheduled for Monday 08:00.`;

export default function McpPage() {
  usePageTitle("Social — Intégration MCP");
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Bot className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold">MCP Integration</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Connect AI agents (like Claude) to SignApps Social using the Model
          Context Protocol. Let your AI assistant create, schedule and manage
          social posts on your behalf.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary">Model Context Protocol</Badge>
          <Badge variant="outline">6 tools available</Badge>
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline flex items-center gap-1"
          >
            MCP Docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Setup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-500" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal list-inside space-y-3">
            <li>
              <strong>Get your API key:</strong> Go to{" "}
              <a
                href="/social/settings/api-keys"
                className="text-primary underline"
              >
                Settings → API Keys
              </a>{" "}
              and generate a new key.
            </li>
            <li>
              <strong>Add to your MCP client config</strong> (e.g.{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                claude_desktop_config.json
              </code>
              ):
            </li>
          </ol>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono">
            {CONFIG_EXAMPLE}
          </pre>
          <ol start={3} className="list-decimal list-inside space-y-2">
            <li>Restart your MCP client (Claude Desktop, Continue, etc.)</li>
            <li>
              The <strong>signapps-social</strong> tools will appear
              automatically
            </li>
          </ol>

          <div className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300 text-xs">
            <strong>Note:</strong> The MCP server package{" "}
            <code>@signapps/mcp-server</code> is currently in preview. Contact
            support for early access.
          </div>
        </CardContent>
      </Card>

      {/* Tools */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Available Tools
        </h2>

        {MCP_TOOLS.map((tool) => (
          <Card key={tool.name}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm font-bold bg-muted px-2 py-1 rounded">
                  {tool.name}
                </code>
              </div>
              <p className="text-sm text-muted-foreground">
                {tool.description}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-1.5 pr-3">Parameter</th>
                      <th className="text-left py-1.5 pr-3">Type</th>
                      <th className="text-left py-1.5 pr-3">Required</th>
                      <th className="text-left py-1.5">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tool.params.map((p) => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 font-mono font-medium">
                          {p.name}
                        </td>
                        <td className="py-1.5 pr-3 text-muted-foreground">
                          {p.type}
                        </td>
                        <td className="py-1.5 pr-3">
                          {p.required ? (
                            <span className="text-red-500">required</span>
                          ) : (
                            <span className="text-muted-foreground">
                              optional
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          {p.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <p className="text-xs font-medium mb-1">Example input</p>
                <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto font-mono">
                  {tool.example}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Claude example */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-purple-500" />
            Example: Ask Claude to manage your social media
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap">
            {CLAUDE_EXAMPLE}
          </pre>
          <p className="text-xs text-muted-foreground mt-3">
            With MCP, Claude can autonomously create posts, check analytics,
            reply to mentions and schedule content — all based on your natural
            language instructions.
          </p>
        </CardContent>
      </Card>

      {/* Use cases */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Automation ideas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>
              Ask Claude to write and schedule a week of LinkedIn posts in one
              prompt
            </li>
            <li>
              Automatically reply to unread mentions with context-aware
              responses
            </li>
            <li>
              Generate monthly analytics reports and suggest content
              improvements
            </li>
            <li>Recycle top performing posts from last quarter</li>
            <li>
              Post breaking news from RSS feeds with AI-generated commentary
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
