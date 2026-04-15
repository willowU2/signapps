"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Webhook, Search, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface WebhookEvent {
  event: string;
  description: string;
  service: string;
  payloadExample: Record<string, unknown>;
}

const WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    event: "user.created",
    service: "identity",
    description: "A new user account was created",
    payloadExample: {
      event: "user.created",
      user_id: "u123",
      email: "alice@example.com",
      timestamp: "2025-03-20T10:00:00Z",
    },
  },
  {
    event: "user.deleted",
    service: "identity",
    description: "A user account was permanently deleted",
    payloadExample: {
      event: "user.deleted",
      user_id: "u123",
      timestamp: "2025-03-20T10:00:00Z",
    },
  },
  {
    event: "user.login",
    service: "identity",
    description: "User logged in successfully",
    payloadExample: {
      event: "user.login",
      user_id: "u123",
      ip: "1.2.3.4",
      timestamp: "2025-03-20T10:00:00Z",
    },
  },
  {
    event: "storage.upload",
    service: "storage",
    description: "File uploaded to storage",
    payloadExample: {
      event: "storage.upload",
      file_id: "f456",
      name: "report.pdf",
      size: 102400,
      owner: "u123",
    },
  },
  {
    event: "storage.delete",
    service: "storage",
    description: "File deleted from storage",
    payloadExample: {
      event: "storage.delete",
      file_id: "f456",
      name: "report.pdf",
    },
  },
  {
    event: "mail.received",
    service: "mail",
    description: "New email received",
    payloadExample: {
      event: "mail.received",
      message_id: "m789",
      from: "bob@example.com",
      subject: "Hello",
    },
  },
  {
    event: "container.started",
    service: "containers",
    description: "Conteneur démarré successfully",
    payloadExample: {
      event: "container.started",
      container_id: "c001",
      name: "myapp",
      image: "nginx:latest",
    },
  },
  {
    event: "container.stopped",
    service: "containers",
    description: "Conteneur arrêté",
    payloadExample: {
      event: "container.stopped",
      container_id: "c001",
      exit_code: 0,
    },
  },
  {
    event: "calendar.event.created",
    service: "calendar",
    description: "Calendar event created",
    payloadExample: {
      event: "calendar.event.created",
      event_id: "e321",
      title: "Team meeting",
      start: "2025-03-25T09:00:00Z",
    },
  },
  {
    event: "route.updated",
    service: "proxy",
    description: "Proxy route configuration updated",
    payloadExample: {
      event: "route.updated",
      route_id: "r555",
      domain: "app.example.com",
      target: "http://localhost:3000",
    },
  },
];

const SERVICES = Array.from(new Set(WEBHOOK_EVENTS.map((e) => e.service)));

export function WebhookEventCatalog() {
  const [search, setSearch] = useState("");
  const [service, setService] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = WEBHOOK_EVENTS.filter((e) => {
    const matchSearch =
      !search ||
      e.event.includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    const matchSvc = service === "all" || e.service === service;
    return matchSearch && matchSvc;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Webhook className="h-5 w-5 text-primary" />
          Webhook Event Catalog
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setService("all")}
              className={`text-xs px-2 py-1 rounded border ${service === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-accent"}`}
            >
              All
            </button>
            {SERVICES.map((s) => (
              <button
                key={s}
                onClick={() => setService(s)}
                className={`text-xs px-2 py-1 rounded border capitalize ${service === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-accent"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="h-96">
          <div className="space-y-1.5 pr-2">
            {filtered.map((ev) => (
              <div key={ev.event} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 text-left transition-colors"
                  onClick={() =>
                    setExpanded(expanded === ev.event ? null : ev.event)
                  }
                >
                  <div className="flex items-center gap-2">
                    {expanded === ev.event ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <code className="text-sm font-mono text-primary">
                      {ev.event}
                    </code>
                    <Badge variant="secondary" className="text-[10px]">
                      {ev.service}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {ev.description}
                  </span>
                </button>

                {expanded === ev.event && (
                  <div className="border-t p-3 bg-muted/20 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {ev.description}
                    </p>
                    <div className="relative">
                      <pre className="text-xs font-mono bg-background rounded-lg p-3 overflow-x-auto border">
                        {JSON.stringify(ev.payloadExample, null, 2)}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-7 w-7"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(ev.payloadExample, null, 2),
                          );
                          toast.success("Payload copied");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
