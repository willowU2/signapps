/**
 * Push Subscription Manager
 * Displays and manages push notification subscriptions
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Trash2, AlertCircle, Loader } from 'lucide-react';
import { calendarApi } from '@/lib/api';
import { usePushNotifications } from '@/hooks/use-push-notifications';

export interface PushSubscription {
  id: string;
  browser_name?: string;
  created_at: string;
}

export interface PushSubscriptionManagerProps {
  onSubscriptionChange?: (count: number) => void;
}

/**
 * Component to manage push notification subscriptions
 */
export function PushSubscriptionManager({
  onSubscriptionChange,
}: PushSubscriptionManagerProps) {
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { isSupported, isSubscribed, subscribe, unsubscribe } =
    usePushNotifications();

  // Load subscriptions on mount
  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Notify parent of subscription changes
  useEffect(() => {
    onSubscriptionChange?.(subscriptions.length);
  }, [subscriptions.length, onSubscriptionChange]);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await calendarApi.get(
        'http://localhost:3011/api/v1/notifications/subscriptions/push'
      );

      setSubscriptions(response.data || []);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      setError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (subscriptionId: string) => {
    try {
      setDeletingId(subscriptionId);
      setError(null);

      await calendarApi.delete(
        `http://localhost:3011/api/v1/notifications/subscriptions/push/${subscriptionId}`
      );

      setSubscriptions((prev) =>
        prev.filter((sub) => sub.id !== subscriptionId)
      );

      // Also unsubscribe locally if this is the only subscription
      if (subscriptions.length === 1 && isSubscribed) {
        await unsubscribe();
      }
    } catch (err) {
      console.error('Failed to delete subscription:', err);
      setError('Failed to delete subscription');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubscribe = async () => {
    try {
      setError(null);
      await subscribe();
      // Reload subscriptions to show the new one
      await loadSubscriptions();
    } catch (err) {
      console.error('Failed to subscribe:', err);
      setError('Failed to subscribe to notifications');
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in your browser
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Push Notifications
            </CardTitle>
            <CardDescription>
              Manage your push notification subscriptions
            </CardDescription>
          </div>
          {subscriptions.length > 0 && (
            <Badge variant="secondary">{subscriptions.length} active</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-600 mb-4">
              No active subscriptions
            </p>
            <Button onClick={handleSubscribe} variant="outline">
              Subscribe Now
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium">
                      {sub.browser_name || 'Browser'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Subscribed {new Date(sub.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(sub.id)}
                  disabled={deletingId === sub.id}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {deletingId === sub.id ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}

            <Button
              onClick={handleSubscribe}
              variant="outline"
              className="w-full"
            >
              <Bell className="h-4 w-4 mr-2" />
              Add Another Device
            </Button>
          </div>
        )}

        <div className="border-t pt-4 text-xs text-gray-600">
          <p className="font-medium text-gray-700 mb-2">About Push Notifications:</p>
          <ul className="space-y-1">
            <li>• You'll receive notifications even when the app is closed</li>
            <li>• Notifications are sent to all your subscribed devices</li>
            <li>• You can subscribe from multiple browsers and devices</li>
            <li>
              • Unsubscribe anytime to stop receiving notifications on a device
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default PushSubscriptionManager;
