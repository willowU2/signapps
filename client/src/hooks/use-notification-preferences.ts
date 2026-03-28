/**
 * useNotificationPreferences Hook
 * Manages user notification preferences (email, push, SMS, etc.)
 */

import { useEffect, useState, useCallback } from 'react';
import { calendarApiClient } from '@/lib/api/core';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  event_reminders: boolean;
  task_reminders: boolean;
  attendee_responses: boolean;
  calendar_invites: boolean;
  created_at: string;
  updated_at: string;
}

export interface UseNotificationPreferencesReturn extends NotificationPreferences {
  loading: boolean;
  error: string | null;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

/**
 * Hook to manage notification preferences
 */
export function useNotificationPreferences(): UseNotificationPreferencesReturn {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await calendarApiClient.get(
          '/notifications/preferences'
        );

        setPreferences(response.data);
      } catch {
        setError('Failed to load notification preferences');
        // Set defaults if fetch fails
        setPreferences({
          id: 'default',
          user_id: 'unknown',
          email_enabled: true,
          push_enabled: true,
          sms_enabled: false,
          event_reminders: true,
          task_reminders: true,
          attendee_responses: true,
          calendar_invites: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  // Update preferences
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!preferences) return;

      try {
        setError(null);
        const updatedPrefs = { ...preferences, ...updates };

        const response = await calendarApiClient.put(
          '/notifications/preferences',
          updatedPrefs
        );

        setPreferences(response.data);
      } catch (err) {
        setError('Impossible d'enregistrer preferences');
        throw err;
      }
    },
    [preferences]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    const defaults: Partial<NotificationPreferences> = {
      email_enabled: true,
      push_enabled: true,
      sms_enabled: false,
      event_reminders: true,
      task_reminders: true,
      attendee_responses: true,
      calendar_invites: true,
    };

    await updatePreferences(defaults);
  }, [updatePreferences]);

  return {
    ...(preferences || {
      id: 'default',
      user_id: 'unknown',
      email_enabled: true,
      push_enabled: true,
      sms_enabled: false,
      event_reminders: true,
      task_reminders: true,
      attendee_responses: true,
      calendar_invites: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    loading,
    error,
    updatePreferences,
    resetToDefaults,
  };
}

export default useNotificationPreferences;
