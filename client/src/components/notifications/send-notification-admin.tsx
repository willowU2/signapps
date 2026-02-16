/**
 * Send Notification Admin Component
 * Admin-only tool to send test notifications
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle, Loader, Send } from 'lucide-react';
import { calendarApi } from '@/lib/api';

/**
 * Admin component to send notifications for testing
 */
export function SendNotificationAdmin() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notificationType, setNotificationType] = useState('event_reminder');
  const [sendToAll, setSendToAll] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !body.trim()) {
      setError('Title and body are required');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      const response = await calendarApi.post(
        'http://localhost:3011/api/v1/notifications/push/send',
        {
          title: title.trim(),
          body: body.trim(),
          notification_type: notificationType,
          send_to_all: sendToAll,
          data: {
            test: true,
            timestamp: new Date().toISOString(),
          },
        }
      );

      setSuccess(true);
      setTitle('');
      setBody('');

      // Show result
      const result = response.data;
      if (result.failed > 0) {
        setError(`Sent: ${result.successful}/${result.total} (Failed: ${result.failed})`);
      } else {
        setError(`✅ Successfully sent to ${result.successful} subscriptions`);
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error('Failed to send notification:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send notification';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          Send Test Notification (Admin Only)
        </CardTitle>
        <CardDescription>
          Send a notification to all subscribed devices for testing
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          {error && (
            <div className={`flex items-start gap-2 rounded-md p-3 ${
              success ? 'bg-green-50' : 'bg-red-50'
            }`}>
              {success ? (
                <CheckCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${success ? 'text-green-600' : 'text-red-600'}`} />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <p className={`text-sm ${success ? 'text-green-700' : 'text-red-700'}`}>
                {error}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Notification title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Notification message body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isLoading}
              maxLength={500}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={notificationType} onValueChange={setNotificationType} disabled={isLoading}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event_reminder">Event Reminder</SelectItem>
                <SelectItem value="task_due">Task Due</SelectItem>
                <SelectItem value="attendee_response">Attendee Response</SelectItem>
                <SelectItem value="calendar_invite">Calendar Invite</SelectItem>
                <SelectItem value="test">Test Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Send To</Label>
            <Select value={sendToAll ? 'all' : 'specific'} onValueChange={(v) => setSendToAll(v === 'all')} disabled={isLoading}>
              <SelectTrigger id="recipient">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subscriptions</SelectItem>
                <SelectItem value="specific">Specific Device (Coming Soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !title.trim() || !body.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Notification
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default SendNotificationAdmin;
