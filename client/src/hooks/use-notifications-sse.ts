import { useEffect } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { getServiceUrl, ServiceName, getClient } from '@/lib/api/factory';
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
            if (response.status === 401) {
              console.warn('SSE 401 Unauthorized. Access token might be expired. Forcing token refresh...');
              try {
                // Hit a protected endpoint with axios so its interceptor refreshes the cookie
                const identityClient = getClient(ServiceName.IDENTITY);
                await identityClient.get('/auth/me');
              } catch (e) {
                // Ignore errors
              }
              // Throw a specific error to allow retry
              throw new Error('SSE_AUTH_ERROR');
            }
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              console.warn('Failed to connect to SSE stream: client error', response.status);
              throw new Error('SSE_CLIENT_ERROR'); // Prevents retries for other client errors
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
                console.warn('Failed to parse SSE message', e);
              }
            }
          },
          onclose() {
            // Reconnects automatically according to fetch-event-source logic
          },
          onerror(err) {
            console.warn('SSE connection error:', err);
            
            if (err.message === 'SSE_AUTH_ERROR') {
              // Return nothing to allow it to retry (with a fresh cookie!)
              return; 
            }
            if (err.message === 'SSE_CLIENT_ERROR') {
              // Throwing prevents auto reconnect on fatal errors.
              throw err;
            }
            // Returning undefined tells it to reconnect with backoff.
            return undefined;
          }
        });
      } catch (e) {
        console.warn('SSE connection aborted or failed:', e);
      }
    };

    connect();

    return () => {
      controller.abort();
    };
  }, [user, toast]);
}
