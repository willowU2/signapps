"use client";

import { useState } from "react";
import { Edit2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WebhookTemplate {
  id: string;
  name: string;
  platform: string;
  payloadPreview: Record<string, unknown>;
  description: string;
}

const WEBHOOK_TEMPLATES: WebhookTemplate[] = [
  {
    id: "slack",
    name: "Slack",
    platform: "Slack",
    description: "Post messages and rich notifications to Slack channels",
    payloadPreview: {
      text: "Document updated",
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: "*Document Updated*\nNew changes available" },
        },
      ],
    },
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    platform: "Teams",
    description: "Send adaptive cards to Microsoft Teams channels",
    payloadPreview: {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: "Document Updated",
      themeColor: "0078BE",
      sections: [
        {
          activityTitle: "Document Updated",
          activitySubtitle: "New version available",
        },
      ],
    },
  },
  {
    id: "discord",
    name: "Discord",
    platform: "Discord",
    description: "Send embeds and messages to Discord channels",
    payloadPreview: {
      embeds: [
        {
          title: "Document Updated",
          description: "A document in your workspace has been updated",
          color: 5814783,
          fields: [
            { name: "Document", value: "quarterly-report.pdf", inline: true },
            { name: "Updated At", value: "2024-03-22 10:30:00", inline: true },
          ],
        },
      ],
    },
  },
];

export function WebhookTemplates() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyPayload = (template: WebhookTemplate) => {
    const payloadJson = JSON.stringify(template.payloadPreview, null, 2);
    navigator.clipboard.writeText(payloadJson);
    setCopiedId(template.id);
    toast.success(`${template.name} payload copied to clipboard`);

    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEdit = (template: WebhookTemplate) => {
    toast.info(`Editing ${template.name} template`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Webhook Templates</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Pre-configured templates for popular notification platforms
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {WEBHOOK_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">{template.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
              </div>
            </div>

            {/* Payload Preview */}
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-gray-600">Payload Preview</p>
              <pre className="bg-gray-50 rounded-md p-3 text-xs overflow-auto max-h-40 border border-gray-200">
                <code className="font-mono text-gray-700">
                  {JSON.stringify(template.payloadPreview, null, 2)}
                </code>
              </pre>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => handleEdit(template)}
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => handleCopyPayload(template)}
              >
                {copiedId === template.id ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
