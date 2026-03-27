"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  category: "chat" | "email" | "devops";
  url_placeholder: string;
  events: string[];
  headers?: Record<string, string>;
}

const WEBHOOK_TEMPLATES: WebhookTemplate[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Send notifications to a Slack channel via Incoming Webhooks.",
    category: "chat",
    url_placeholder: "https://hooks.slack.com/services/T.../B.../...",
    events: ["user.created", "storage.upload", "container.started"],
    headers: { "Content-Type": "application/json" },
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Post cards to a Teams channel via Connectors.",
    category: "chat",
    url_placeholder: "https://outlook.office.com/webhook/...",
    events: ["user.created", "container.stopped"],
    headers: { "Content-Type": "application/json" },
  },
  {
    id: "discord",
    name: "Discord",
    description: "Send embed messages to a Discord channel.",
    category: "chat",
    url_placeholder: "https://discord.com/api/webhooks/...",
    events: ["user.login", "storage.upload"],
    headers: { "Content-Type": "application/json" },
  },
  {
    id: "email-notify",
    name: "Email Notification",
    description: "Forward events to an email notification endpoint.",
    category: "email",
    url_placeholder: "https://your-server.com/api/email-webhook",
    events: ["user.created", "user.deleted"],
  },
  {
    id: "github-actions",
    name: "GitHub Actions",
    description: "Trigger a GitHub Actions workflow_dispatch event.",
    category: "devops",
    url_placeholder: "https://api.github.com/repos/owner/repo/dispatches",
    events: ["storage.upload", "container.created"],
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: "Bearer <token>",
    },
  },
  {
    id: "generic-webhook",
    name: "Generic Webhook",
    description: "A standard JSON POST webhook for any endpoint.",
    category: "devops",
    url_placeholder: "https://your-endpoint.com/hook",
    events: ["user.created", "storage.upload"],
  },
];

const categoryColors: Record<WebhookTemplate["category"], string> = {
  chat: "bg-blue-500/10 text-blue-600",
  email: "bg-green-500/10 text-green-600",
  devops: "bg-orange-500/10 text-orange-600",
};

interface WebhookTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: WebhookTemplate) => void;
}

export function WebhookTemplatesDialog({
  open,
  onOpenChange,
  onSelect,
}: WebhookTemplatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Webhook Templates</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[480px] pr-4">
          <div className="space-y-3">
            {WEBHOOK_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-start justify-between rounded-lg border p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tpl.name}</span>
                    <Badge className={categoryColors[tpl.category]}>
                      {tpl.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tpl.description}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {tpl.events.slice(0, 3).join(", ")}
                    {tpl.events.length > 3 && ` +${tpl.events.length - 3}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onSelect(tpl);
                    onOpenChange(false);
                  }}
                >
                  Use
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
