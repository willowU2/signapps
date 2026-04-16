"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  Eye,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const STORAGE_KEY = "signapps_link_in_bio";

interface BioLink {
  id: string;
  title: string;
  url: string;
  icon: string;
  color: string;
}

interface BioProfile {
  username: string;
  name: string;
  bio: string;
  avatar: string;
  links: BioLink[];
}

const DEFAULT_PROFILE: BioProfile = {
  username: "",
  name: "",
  bio: "",
  avatar: "",
  links: [],
};

const ICON_OPTIONS = [
  "🔗",
  "🌐",
  "📧",
  "📱",
  "🛒",
  "📺",
  "🎵",
  "📸",
  "💼",
  "🚀",
  "⭐",
  "💡",
];
const COLOR_OPTIONS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function loadProfile(): BioProfile {
  try {
    return (
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? DEFAULT_PROFILE
    );
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfile(p: BioProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function PhoneFrame({ profile }: { profile: BioProfile }) {
  return (
    <div className="relative mx-auto w-64">
      {/* Phone shell */}
      <div className="rounded-[40px] border-4 border-foreground/20 bg-foreground/5 overflow-hidden shadow-xl">
        {/* Status bar */}
        <div className="h-8 bg-foreground/10 flex items-center justify-center">
          <div className="w-20 h-4 bg-foreground/20 rounded-full" />
        </div>
        {/* Screen */}
        <div className="bg-background min-h-[460px] p-5 overflow-y-auto">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-4">
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
              </div>
            )}
            <h3 className="font-bold mt-2 text-sm text-center">
              {profile.name || "Your Name"}
            </h3>
            {profile.username && (
              <p className="text-xs text-muted-foreground">
                @{profile.username}
              </p>
            )}
            {profile.bio && (
              <p className="text-xs text-center mt-1 text-muted-foreground leading-relaxed">
                {profile.bio}
              </p>
            )}
          </div>

          {/* Links */}
          <div className="space-y-2">
            {profile.links.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Add links to see them here
              </p>
            ) : (
              profile.links.map((link) => (
                <div
                  key={link.id}
                  className="w-full py-2.5 px-3 rounded-xl text-white text-xs font-medium flex items-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: link.color }}
                >
                  <span>{link.icon}</span>
                  <span className="flex-1 text-center">
                    {link.title || "Untitled"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        {/* Home bar */}
        <div className="h-6 bg-foreground/10 flex items-center justify-center">
          <div className="w-24 h-1 bg-foreground/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function LinkInBioEditor() {
  const [profile, setProfile] = useState<BioProfile>(loadProfile);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const update = useCallback(
    (patch: Partial<BioProfile>) => {
      const next = { ...profile, ...patch };
      setProfile(next);
      saveProfile(next);
    },
    [profile],
  );

  const addLink = () => {
    const link: BioLink = {
      id: Date.now().toString(),
      title: "",
      url: "",
      icon: "🔗",
      color: COLOR_OPTIONS[profile.links.length % COLOR_OPTIONS.length],
    };
    update({ links: [...profile.links, link] });
  };

  const updateLink = (id: string, patch: Partial<BioLink>) => {
    update({
      links: profile.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  };

  const removeLink = (id: string) => {
    update({ links: profile.links.filter((l) => l.id !== id) });
  };

  const copyPublicUrl = () => {
    if (!profile.username) {
      toast.error("Set a username first");
      return;
    }
    const url = `${window.location.origin}/bio/${profile.username}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Public URL copied!");
    });
  };

  // Drag & drop reorder
  const handleDragStart = (i: number) => setDragIdx(i);
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const links = [...profile.links];
    const [moved] = links.splice(dragIdx, 1);
    links.splice(i, 0, moved);
    setDragIdx(i);
    update({ links });
  };
  const handleDragEnd = () => setDragIdx(null);

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 h-full overflow-auto">
      {/* Editor */}
      <div className="flex-1 space-y-4 min-w-0">
        <div>
          <h2 className="text-xl font-semibold">Link in Bio</h2>
          <p className="text-sm text-muted-foreground">
            Create your public bio page with links
          </p>
        </div>

        {/* Profile info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Username (for public URL)</Label>
                <Input
                  placeholder="yourname"
                  value={profile.username}
                  onChange={(e) =>
                    update({
                      username: e.target.value
                        .replace(/[^a-z0-9_-]/gi, "")
                        .toLowerCase(),
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Display Name</Label>
                <Input
                  placeholder="Your Full Name"
                  value={profile.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Avatar URL</Label>
              <Input
                placeholder="https://…/photo.jpg"
                value={profile.avatar}
                onChange={(e) => update({ avatar: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bio</Label>
              <Textarea
                placeholder="A short description about you…"
                value={profile.bio}
                onChange={(e) => update({ bio: e.target.value })}
                className="text-sm resize-none"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Links
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={addLink}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Link
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.links.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No links yet. Click &quot;Add Link&quot; to start.
              </p>
            ) : (
              <div className="space-y-3">
                {profile.links.map((link, i) => (
                  <div
                    key={link.id}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                    className={`border rounded-lg p-3 space-y-2 bg-background transition-shadow ${
                      dragIdx === i ? "shadow-md ring-2 ring-primary/20" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                      <div className="flex gap-1 flex-wrap">
                        {ICON_OPTIONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => updateLink(link.id, { icon })}
                            className={`w-6 h-6 rounded text-sm flex items-center justify-center transition-colors ${
                              link.icon === icon
                                ? "bg-primary/20 ring-1 ring-primary"
                                : "hover:bg-muted"
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
                        onClick={() => removeLink(link.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        placeholder="Link title"
                        value={link.title}
                        onChange={(e) =>
                          updateLink(link.id, { title: e.target.value })
                        }
                        className="h-8 text-sm"
                      />
                      <Input
                        placeholder="https://…"
                        value={link.url}
                        onChange={(e) =>
                          updateLink(link.id, { url: e.target.value })
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateLink(link.id, { color })}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            link.color === color
                              ? "ring-2 ring-offset-1 ring-foreground scale-110"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={copyPublicUrl}>
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? "Copied!" : "Copy public URL"}
          </Button>
          {profile.username && (
            <Button variant="outline" asChild className="gap-2">
              <a
                href={`/bio/${profile.username}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4" />
                Preview live
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Phone preview */}
      <div className="lg:w-72 shrink-0">
        <div className="sticky top-6">
          <p className="text-sm font-medium text-center mb-4 flex items-center justify-center gap-2">
            <Eye className="w-4 h-4" />
            Live Preview
          </p>
          <PhoneFrame profile={profile} />
        </div>
      </div>
    </div>
  );
}
