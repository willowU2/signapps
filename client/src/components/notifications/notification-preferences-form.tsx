/**
 * Notification Preferences Form
 * Allows users to configure notification settings
 */

'use client';
import { SpinnerInfinity } from 'spinners-react';


import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle } from 'lucide-react';
import useNotificationPreferences, { NotificationPreferences } from '@/hooks/use-notification-preferences';

/**
 * Form component for notification preferences
 */
export function NotificationPreferencesForm() {
  const {
    email_enabled,
    push_enabled,
    sms_enabled,
    event_reminders,
    task_reminders,
    attendee_responses,
    calendar_invites,
    loading,
    error,
    updatePreferences,
    resetToDefaults,
  } = useNotificationPreferences();

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleToggle = async (field: string, value: boolean) => {
    try {
      setIsSaving(true);
      setSaved(false);

      const updates: Record<string, unknown> = { [field]: value };
      await updatePreferences(updates as Partial<NotificationPreferences>);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Error handled by useNotificationPreferences state
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    try {
      setIsSaving(true);
      await resetToDefaults();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Error handled by useNotificationPreferences state
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-5 w-5  text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Configure how and when you receive notifications
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {saved && (
          <div className="flex items-start gap-2 rounded-md bg-green-50 p-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-700">Preferences saved successfully</p>
          </div>
        )}

        {/* Notification Channels */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Notification Channels
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <label htmlFor="email-enabled" className="text-sm text-muted-foreground">
                📧 Email Notifications
              </label>
              <Switch
                id="email-enabled"
                checked={email_enabled}
                onCheckedChange={(checked) =>
                  handleToggle('email_enabled', checked)
                }
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <label htmlFor="push-enabled" className="text-sm text-muted-foreground">
                🔔 Browser Push Notifications
              </label>
              <Switch
                id="push-enabled"
                checked={push_enabled}
                onCheckedChange={(checked) =>
                  handleToggle('push_enabled', checked)
                }
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <label htmlFor="sms-enabled" className="text-sm text-muted-foreground">
                📱 SMS Notifications
              </label>
              <Switch
                id="sms-enabled"
                checked={sms_enabled}
                onCheckedChange={(checked) =>
                  handleToggle('sms_enabled', checked)
                }
                disabled={isSaving}
              />
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Notification Types
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <label htmlFor="event-reminders" className="text-sm text-muted-foreground">
                📅 Event Reminders
              </label>
              <Switch
                id="event-reminders"
                checked={event_reminders}
                onCheckedChange={(checked) =>
                  handleToggle('event_reminders', checked)
                }
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <label htmlFor="task-reminders" className="text-sm text-muted-foreground">
                ✓ Task Reminders
              </label>
              <Switch
                id="task-reminders"
                checked={task_reminders}
                onCheckedChange={(checked) =>
                  handleToggle('task_reminders', checked)
                }
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <label htmlFor="attendee-responses" className="text-sm text-muted-foreground">
                👥 Attendee Responses
              </label>
              <Switch
                id="attendee-responses"
                checked={attendee_responses}
                onCheckedChange={(checked) =>
                  handleToggle('attendee_responses', checked)
                }
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <label htmlFor="calendar-invites" className="text-sm text-muted-foreground">
                ✉️ Calendar Invites
              </label>
              <Switch
                id="calendar-invites"
                checked={calendar_invites}
                onCheckedChange={(checked) =>
                  handleToggle('calendar_invites', checked)
                }
                disabled={isSaving}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 border-t pt-4">
          <Button
            variant="outline"
            onClick={handleResetDefaults}
            disabled={isSaving}
          >
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationPreferencesForm;
