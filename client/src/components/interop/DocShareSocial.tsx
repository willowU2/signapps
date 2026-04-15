"use client";

/**
 * Feature 1: Doc → share on social (one-click)
 * Feature 16: Social → schedule doc publication
 */

import { useState } from "react";
import { Share2, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { socialApi } from "@/lib/api/social";
import { docEditorUrl } from "@/hooks/use-cross-module";

interface DocShareSocialProps {
  docId: string;
  docName: string;
  docContent?: string;
}

export function DocShareSocial({
  docId,
  docName,
  docContent,
}: DocShareSocialProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [customText, setCustomText] = useState("");

  const url = docEditorUrl(docId, docName);
  const defaultText = `📄 ${docName}\n${url}`;

  const handleShareNow = async () => {
    setLoading(true);
    try {
      const accountsRes = await socialApi.accounts.list();
      const accountIds: string[] = (accountsRes?.data ?? []).map((a) => a.id);
      if (!accountIds.length) {
        toast.error("Aucun compte social connecté");
        return;
      }
      await socialApi.posts.create({
        content: customText || defaultText,
        accountIds,
      });
      toast.success("Partagé sur les réseaux sociaux");
      setOpen(false);
    } catch {
      // Fallback: copy link
      navigator.clipboard.writeText(customText || defaultText);
      toast.success("Lien copié pour partage social");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) {
      toast.error("Choisissez une date");
      return;
    }
    setLoading(true);
    try {
      const accountsRes = await socialApi.accounts.list();
      const accountIds: string[] = (accountsRes?.data ?? []).map((a) => a.id);
      await socialApi.posts.create({
        content: customText || defaultText,
        accountIds,
        scheduledAt: new Date(scheduleDate).toISOString(),
      });
      toast.success("Publication planifiée");
      setOpen(false);
    } catch {
      toast.error("Erreur lors de la planification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="h-3.5 w-3.5" />
          Partager
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        <p className="text-sm font-semibold">
          Partager sur les réseaux sociaux
        </p>
        <div className="space-y-1">
          <Label className="text-xs">Message</Label>
          <textarea
            className="w-full text-sm border rounded-md p-2 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
            value={customText || defaultText}
            onChange={(e) => setCustomText(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={handleShareNow}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Share2 className="h-3.5 w-3.5 mr-1" />
          )}
          Partager maintenant
        </Button>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Planifier
          </Label>
          <div className="flex gap-2">
            <Input
              type="datetime-local"
              className="text-xs h-8"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleSchedule}
              disabled={loading || !scheduleDate}
            >
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
