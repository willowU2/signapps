'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { calendarApi } from '@/lib/api';

export function SendNotificationAdmin() {
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState('push');
  const [type, setType] = useState('event_reminder');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const handleSendTest = async () => {
    if (!title || !message) {
      toast.error('Please enter a title and message');
      return;
    }

    setLoading(true);
    try {
      await calendarApi.post('/notifications/push/send', {
        channel,
        type,
        title,
        message,
        recipient: 'self', // Send to current user
      });
      toast.success('Test notification queued successfully');
      setTitle('');
      setMessage('');
    } catch {
      toast.error('Failed to send test notification or endpoint not implemented');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed bg-muted/30">
      <CardHeader>
        <CardTitle className="text-lg">Admin / Developer Testing</CardTitle>
        <CardDescription>
          Send a test notification to yourself to verify delivery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Browser Push</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event_reminder">Event Reminder</SelectItem>
                <SelectItem value="task_assignment">Task Assignment</SelectItem>
                <SelectItem value="daily_digest">Daily Digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Title / Subject</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="E.g., Reminder: Project Sync"
          />
        </div>

        <div className="space-y-2">
          <Label>Message Body</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Notification content..."
            rows={3}
          />
        </div>

        <Button
          onClick={handleSendTest}
          disabled={loading || !title || !message}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send Test Notification
        </Button>
      </CardContent>
    </Card>
  );
}
