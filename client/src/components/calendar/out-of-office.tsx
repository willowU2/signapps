"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  Palmtree,
  Clock,
  Mail,
  CalendarOff,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OutOfOfficeSettings {
  enabled: boolean;
  startDate: string; // ISO date
  endDate: string; // ISO date
  autoReplyMessage: string;
  autoDeclineInvitations: boolean;
  showOooOnCalendar: boolean;
  autoReplyToEmails: boolean;
  updatedAt: string;
}

// ── Storage helpers ────────────────────────────────────────────────────────

const OOO_KEY = "signapps_ooo_settings";

export function getOooSettings(): OutOfOfficeSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(OOO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOooSettings(settings: OutOfOfficeSettings): void {
  localStorage.setItem(OOO_KEY, JSON.stringify(settings));
}

export function clearOooSettings(): void {
  localStorage.removeItem(OOO_KEY);
}

export function isCurrentlyOoo(): boolean {
  const settings = getOooSettings();
  if (!settings || !settings.enabled) return false;
  try {
    const now = new Date();
    return isWithinInterval(now, {
      start: parseISO(settings.startDate),
      end: parseISO(settings.endDate),
    });
  } catch {
    return false;
  }
}

// ── OOO Banner ─────────────────────────────────────────────────────────────

export function OooBanner() {
  const [settings, setSettings] = useState<OutOfOfficeSettings | null>(null);

  useEffect(() => {
    setSettings(getOooSettings());
  }, []);

  if (!settings || !settings.enabled) return null;

  const now = new Date();
  const start = parseISO(settings.startDate);
  const end = parseISO(settings.endDate);
  const isActive = isWithinInterval(now, { start, end });
  const isUpcoming = now < start;

  if (!isActive && !isUpcoming) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-sm border-b",
        isActive
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
          : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
      )}
    >
      <Palmtree className="h-4 w-4 shrink-0" />
      <span className="font-medium">
        {isActive ? "Out of Office" : "OOO Scheduled"}
      </span>
      <span className="text-muted-foreground">
        {format(start, "dd MMM", { locale: fr })} &ndash;{" "}
        {format(end, "dd MMM yyyy", { locale: fr })}
      </span>
      {settings.autoDeclineInvitations && (
        <Badge variant="outline" className="text-xs">
          <CalendarOff className="h-3 w-3 mr-1" /> Auto-decline
        </Badge>
      )}
      {settings.autoReplyToEmails && (
        <Badge variant="outline" className="text-xs">
          <Mail className="h-3 w-3 mr-1" /> Auto-reply
        </Badge>
      )}
    </div>
  );
}

// ── OOO Dialog / Sheet ─────────────────────────────────────────────────────

interface OutOfOfficeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OutOfOfficeSheet({ open, onOpenChange }: OutOfOfficeSheetProps) {
  const [enabled, setEnabled] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [autoReplyMessage, setAutoReplyMessage] = useState(
    "I'm currently out of office and will respond to your message when I return. For urgent matters, please contact my team."
  );
  const [autoDeclineInvitations, setAutoDeclineInvitations] = useState(true);
  const [showOooOnCalendar, setShowOooOnCalendar] = useState(true);
  const [autoReplyToEmails, setAutoReplyToEmails] = useState(true);

  // Load existing settings
  useEffect(() => {
    const existing = getOooSettings();
    if (existing) {
      setEnabled(existing.enabled);
      setStartDate(existing.startDate);
      setEndDate(existing.endDate);
      setAutoReplyMessage(existing.autoReplyMessage);
      setAutoDeclineInvitations(existing.autoDeclineInvitations);
      setShowOooOnCalendar(existing.showOooOnCalendar);
      setAutoReplyToEmails(existing.autoReplyToEmails);
    }
  }, [open]);

  const handleSave = useCallback(() => {
    if (enabled && (!startDate || !endDate)) {
      toast.error("Please select start and end dates");
      return;
    }

    if (enabled && new Date(endDate) <= new Date(startDate)) {
      toast.error("End date must be after start date");
      return;
    }

    const settings: OutOfOfficeSettings = {
      enabled,
      startDate,
      endDate,
      autoReplyMessage,
      autoDeclineInvitations,
      showOooOnCalendar,
      autoReplyToEmails,
      updatedAt: new Date().toISOString(),
    };

    saveOooSettings(settings);
    toast.success(enabled ? "Out of Office enabled" : "Out of Office disabled");
    onOpenChange(false);
  }, [
    enabled,
    startDate,
    endDate,
    autoReplyMessage,
    autoDeclineInvitations,
    showOooOnCalendar,
    autoReplyToEmails,
    onOpenChange,
  ]);

  const handleDisable = () => {
    setEnabled(false);
    clearOooSettings();
    toast.success("Out of Office disabled");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Palmtree className="h-5 w-5 text-primary" />
            Out of Office
          </SheetTitle>
          <SheetDescription>
            Configure automatic responses and calendar status for when you are away.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable Out of Office</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Activate OOO mode for the specified period
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              {/* Date range */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Date Range
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">End date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Auto-reply message */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Auto-reply message
                </Label>
                <Textarea
                  rows={4}
                  value={autoReplyMessage}
                  onChange={(e) => setAutoReplyMessage(e.target.value)}
                  placeholder="Message sent to people who email or invite you during your OOO period..."
                />
              </div>

              {/* Options */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Auto-decline invitations</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically decline new calendar invitations
                    </p>
                  </div>
                  <Switch
                    checked={autoDeclineInvitations}
                    onCheckedChange={setAutoDeclineInvitations}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Show on calendar</Label>
                    <p className="text-xs text-muted-foreground">
                      Display OOO status on your calendar for colleagues
                    </p>
                  </div>
                  <Switch
                    checked={showOooOnCalendar}
                    onCheckedChange={setShowOooOnCalendar}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Auto-reply to emails</Label>
                    <p className="text-xs text-muted-foreground">
                      Send auto-reply to incoming emails
                    </p>
                  </div>
                  <Switch
                    checked={autoReplyToEmails}
                    onCheckedChange={setAutoReplyToEmails}
                  />
                </div>
              </div>

              {/* Warning */}
              {autoReplyToEmails && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-amber-800 dark:text-amber-300">
                    Auto-reply will be sent once per sender during the OOO period.
                    Make sure your mail service is connected.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter className="gap-2">
          {enabled && getOooSettings()?.enabled && (
            <Button type="button" variant="destructive" size="sm" onClick={handleDisable}>
              <X className="h-4 w-4 mr-1" /> Disable OOO
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
