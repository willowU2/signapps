/**
 * Notification Permission Dialog
 * Requests user permission for push notifications
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { VAPID_PUBLIC_KEY } from "@/lib/api/core";

export interface NotificationPermissionDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Dialog component for requesting notification permissions
 */
export function NotificationPermissionDialog({
  open: controlledOpen,
  onOpenChange,
}: NotificationPermissionDialogProps) {
  const [open, setOpen] = useState(controlledOpen ?? false);
  const [dismissed, setDismissed] = useState(false);
  const [errorStr, setErrorStr] = useState<string | null>(null);

  const { register, loading } = usePushNotifications();

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const permission =
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default";
  const vapidKey = VAPID_PUBLIC_KEY || undefined;

  // Sync controlled open state
  useEffect(() => {
    if (controlledOpen !== undefined) {
      setOpen(controlledOpen);
    }
  }, [controlledOpen]);

  // Auto-show if permission not yet requested and service is available
  useEffect(() => {
    if (!dismissed && isSupported && permission === "default" && vapidKey) {
      setOpen(true);
    }
  }, [isSupported, permission, dismissed, vapidKey]);

  const handleClose = () => {
    setOpen(false);
    onOpenChange?.(false);
  };

  const handleEnable = async () => {
    try {
      await register();
      handleClose();
    } catch (e: unknown) {
      setErrorStr(
        (e instanceof Error ? e.message : String(e)) ||
          "Failed to enable notifications",
      );
    }
  };

  const handleRemindLater = () => {
    handleClose();
  };

  const handleDontAsk = () => {
    setDismissed(true);
    handleClose();
  };

  if (!isSupported || permission !== "default" || dismissed || !vapidKey) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            <div>
              <DialogTitle>Stay Updated</DialogTitle>
              <DialogDescription>
                Get real-time notifications for your calendar and tasks
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={handleDontAsk}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">
              We'll notify you about:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Event reminders and invitations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Task due dates and assignments</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Attendee responses and updates</span>
              </li>
            </ul>
          </div>

          {errorStr && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {errorStr}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleRemindLater}
            disabled={loading}
          >
            Remind Later
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDontAsk}
            className="text-muted-foreground"
          >
            Don't Ask Again
          </Button>
          <Button onClick={handleEnable} disabled={loading}>
            {loading ? "Enabling..." : "Enable Notifications"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
