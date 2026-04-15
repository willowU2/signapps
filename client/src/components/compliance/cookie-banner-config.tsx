"use client";

// IDEA-280: Cookie banner configuration — customizable cookie consent

import { useState, useEffect } from "react";
import {
  Cookie,
  Eye,
  Palette,
  Save,
  Globe,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CookieCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  enabled: boolean;
}

interface BannerConfig {
  title: string;
  description: string;
  accept_all_text: string;
  reject_all_text: string;
  manage_text: string;
  save_text: string;
  position: "bottom" | "top" | "center";
  layout: "banner" | "popup" | "bar";
  primary_color: string;
  show_logo: boolean;
  logo_url?: string;
  privacy_policy_url: string;
  auto_accept_days: number; // 0 = never auto-accept
  categories: CookieCategory[];
}

const DEFAULT_CONFIG: BannerConfig = {
  title: "We use cookies",
  description:
    "We use cookies to improve your experience and analyze site usage. By clicking 'Accept All', you consent to our use of cookies.",
  accept_all_text: "Accept All",
  reject_all_text: "Reject All",
  manage_text: "Manage Preferences",
  save_text: "Save Settings",
  position: "bottom",
  layout: "banner",
  primary_color: "#2563eb",
  show_logo: false,
  privacy_policy_url: "/privacy",
  auto_accept_days: 0,
  categories: [
    {
      id: "necessary",
      name: "Necessary",
      description: "Essential for the website to function.",
      required: true,
      enabled: true,
    },
    {
      id: "analytics",
      name: "Analytics",
      description: "Help us understand how visitors use the site.",
      required: false,
      enabled: false,
    },
    {
      id: "marketing",
      name: "Marketing",
      description: "Used to deliver relevant advertisements.",
      required: false,
      enabled: false,
    },
    {
      id: "preferences",
      name: "Preferences",
      description: "Remember your settings and preferences.",
      required: false,
      enabled: false,
    },
  ],
};

export function CookieBannerConfig() {
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetch("/api/compliance/cookie-banner")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) setConfig(d.config);
      })
      .catch(() => {});
  }, []);

  function update<K extends keyof BannerConfig>(
    key: K,
    value: BannerConfig[K],
  ) {
    setConfig((p) => ({ ...p, [key]: value }));
  }

  function updateCategory(id: string, patch: Partial<CookieCategory>) {
    setConfig((p) => ({
      ...p,
      categories: p.categories.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/compliance/cookie-banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      toast.success("Cookie banner configuration saved");
    } catch {
      toast.error("Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Cookie className="h-4 w-4" /> Cookie Banner Configuration
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPreviewOpen((p) => !p)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" /> Aperçu
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1" />{" "}
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-3 mt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Banner title</Label>
            <Input
              value={config.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={config.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Accept all button</Label>
              <Input
                value={config.accept_all_text}
                onChange={(e) => update("accept_all_text", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reject all button</Label>
              <Input
                value={config.reject_all_text}
                onChange={(e) => update("reject_all_text", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Manage preferences</Label>
              <Input
                value={config.manage_text}
                onChange={(e) => update("manage_text", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Privacy policy URL</Label>
              <Input
                value={config.privacy_policy_url}
                onChange={(e) => update("privacy_policy_url", e.target.value)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Position</Label>
              <Select
                value={config.position}
                onValueChange={(v) =>
                  update("position", v as BannerConfig["position"])
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="center">Center (modal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Layout</Label>
              <Select
                value={config.layout}
                onValueChange={(v) =>
                  update("layout", v as BannerConfig["layout"])
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">Banner</SelectItem>
                  <SelectItem value="popup">Popup card</SelectItem>
                  <SelectItem value="bar">Slim bar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Primary color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.primary_color}
                  onChange={(e) => update("primary_color", e.target.value)}
                  className="h-8 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={config.primary_color}
                  onChange={(e) => update("primary_color", e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show logo</Label>
            <Switch
              checked={config.show_logo}
              onCheckedChange={(v) => update("show_logo", v)}
            />
          </div>
          {config.show_logo && (
            <div className="space-y-1.5">
              <Label className="text-xs">Logo URL</Label>
              <Input
                value={config.logo_url ?? ""}
                onChange={(e) => update("logo_url", e.target.value)}
                placeholder="/logo.png"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-2 mt-3">
          {config.categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-start justify-between rounded-md border px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={cat.name}
                    onChange={(e) =>
                      updateCategory(cat.id, { name: e.target.value })
                    }
                    className="h-7 text-sm font-medium w-32"
                    disabled={cat.required}
                  />
                  {cat.required && (
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <Input
                  value={cat.description}
                  onChange={(e) =>
                    updateCategory(cat.id, { description: e.target.value })
                  }
                  className="h-6 text-xs text-muted-foreground mt-1"
                  disabled={cat.required}
                />
              </div>
              <Switch
                checked={cat.enabled}
                onCheckedChange={(v) =>
                  !cat.required && updateCategory(cat.id, { enabled: v })
                }
                disabled={cat.required}
                className="ml-3 mt-0.5"
              />
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Live preview */}
      {previewOpen && (
        <div
          className={cn(
            "border rounded-lg overflow-hidden shadow-lg",
            config.position === "center" ? "mx-auto max-w-md" : "w-full",
          )}
          style={{ borderColor: config.primary_color }}
        >
          <div className="p-4 bg-background">
            <p className="font-semibold text-sm">{config.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {config.description}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                className="flex-1 py-1.5 rounded text-xs text-white font-medium"
                style={{ backgroundColor: config.primary_color }}
              >
                {config.accept_all_text}
              </button>
              <button className="flex-1 py-1.5 rounded text-xs border font-medium">
                {config.reject_all_text}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
