"use client";
// Feature 17: Contact → show social media profiles

import { useState, useEffect } from "react";
import { Globe, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { socialProfilesApi, type SocialProfile } from "@/lib/api/interop";
import { toast } from "sonner";

const PLATFORM_ICONS: Record<string, string> = {
  linkedin: "in",
  twitter: "𝕏",
  github: "gh",
  website: "🌐",
};

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-700",
  twitter: "bg-slate-100 text-slate-700",
  github: "bg-muted text-muted-foreground",
  website: "bg-green-100 text-green-700",
};

interface Props {
  contactId: string;
}

export function ContactSocialProfiles({ contactId }: Props) {
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{
    platform: SocialProfile["platform"];
    url: string;
  }>({
    platform: "linkedin",
    url: "",
  });

  const refresh = () => setProfiles(socialProfilesApi.byContact(contactId));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const handleAdd = () => {
    if (!form.url.trim()) return;
    socialProfilesApi.upsert({
      contactId,
      platform: form.platform,
      url: form.url.trim(),
    });
    toast.success("Profil social ajouté.");
    setForm({ platform: "linkedin", url: "" });
    setAdding(false);
    refresh();
  };

  const handleDelete = (id: string) => {
    socialProfilesApi.delete(id);
    refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Globe className="h-3 w-3" /> Réseaux sociaux ({profiles.length})
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="h-3 w-3 mr-1" /> Ajouter
        </Button>
      </div>

      {adding && (
        <div className="flex gap-2 items-end">
          <Select
            value={form.platform}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                platform: v as SocialProfile["platform"],
              }))
            }
          >
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="twitter">Twitter/X</SelectItem>
              <SelectItem value="github">GitHub</SelectItem>
              <SelectItem value="website">Site web</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://..."
            className="h-7 text-xs flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>
            OK
          </Button>
        </div>
      )}

      {profiles.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Aucun profil social lié.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${PLATFORM_COLORS[p.platform] ?? ""}`}
            >
              <span className="font-bold">{PLATFORM_ICONS[p.platform]}</span>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="hover:underline max-w-32 truncate"
              >
                {p.url.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
              <button
                onClick={() => handleDelete(p.id)}
                className="ml-0.5 hover:opacity-60"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
