/**
 * Notification Permission Dialog
 * Requests user permission for push notifications
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';

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
  const { isSupported, permission, subscribe, loading, error } =
    usePushNotifications();

  // Sync controlled open state
  useEffect(() => {
    if (controlledOpen !== undefined) {
      setOpen(controlledOpen);
    }
  }, [controlledOpen]);

  // Auto-show if permission not yet requested
  useEffect(() => {
    if (!dismissed && isSupported && permission === 'default') {
      setOpen(true);
    }
  }, [isSupported, permission, dismissed]);

  const handleClose = () => {
    setOpen(false);
    onOpenChange?.(false);
  };

  const handleEnable = async () => {
    try {
      await subscribe();
      handleClose();
    } catch (err) {
      console.error('Failed to enable notifications:', err);
    }
  };

  const handleRemindLater = () => {
    handleClose();
  };

  const handleDontAsk = () => {
    setDismissed(true);
    handleClose();
  };

  if (!isSupported || permission !== 'default' || dismissed) {
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
            className="rounded-md p-1 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-900 mb-2">
              We'll notify you about:
            </p>
            <ul className="space-y-2 text-gray-600">
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

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
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
            className="text-gray-500"
          >
            Don't Ask Again
          </Button>
          <Button onClick={handleEnable} disabled={loading}>
            {loading ? 'Enabling...' : 'Enable Notifications'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NotificationPermissionDialog;
