import { useEffect } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { getServiceUrl, ServiceName } from '@/lib/api/factory';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

interface NotificationMessage {
  user_id: string;
  title: string;
  message: string;
  action_url?: string;
}

export function useNotificationsSSE() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const baseUrl = getServiceUrl(ServiceName.SCHEDULER);
    const url = `${baseUrl}/notifications/stream`;

    const controller = new AbortController();

    const connect = async () => {
      try {
        await fetchEventSource(url, {
          method: 'GET',
          credentials: 'include', // Ensure HttpOnly cookies are sent
          headers: {
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
          onopen: async (response) => {
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              console.error('Failed to connect to SSE stream: client error', response.status);
              throw new Error('SSE client error'); // Prevents retries for auth errors
            }
          },
          onmessage(ev) {
            if (ev.event === 'notification') {
              try {
                const data: NotificationMessage = JSON.parse(ev.data);
                
                // Show an interactive toast
                toast(data.title || 'Nouvelle Notification', {
                  description: data.message,
                  duration: 5000,
                });

                // Dispatch global event so the notification bell can update its counter and list
                window.dispatchEvent(new CustomEvent('new-notification', { detail: data }));
              } catch (e) {
                console.error('Failed to parse SSE message', e);
              }
            }
          },
          onclose() {
            // Reconnects automatically according to fetch-event-source logic
            // unless we throw an error here.
          },
          onerror(err) {
            console.error('SSE stream error:', err);
            // Throwing prevents auto reconnect on fatal errors.
            // Returning undefined tells it to reconnect with backoff.
            return undefined;
          }
        });
      } catch (e) {
        // Will be caught here if an error is thrown in onopen or onerror
        console.error('SSE connection aborted or failed:', e);
      }
    };

    connect();

    return () => {
      controller.abort();
    };
  }, [user, toast]);
}
