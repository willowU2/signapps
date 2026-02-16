/**
 * Notification History Component
 * Display and manage sent notifications
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, MessageSquare, Bell, RotateCw, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  notification_type: string;
  channel: string;
  status: string;
  recipient_address: string | null;
  created_at: string;
  sent_at: string | null;
}

interface NotificationHistoryProps {
  limit?: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  bounced: 'bg-red-100 text-red-800',
};

const channelIcons: Record<string, any> = {
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  push: <Bell className="h-4 w-4" />,
};

export function NotificationHistory({ limit = 20 }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Load notifications
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/v1/notifications/history', {
        params: {
          limit,
        },
      });
      setNotifications(response.data.notifications);
      setError(null);
    } catch (err) {
      setError('Failed to load notification history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (id: string) => {
    try {
      setResendingId(id);
      await axios.post(`/api/v1/notifications/${id}/resend`);
      await loadNotifications();
    } catch (err) {
      setError('Failed to resend notification');
      console.error(err);
    } finally {
      setResendingId(null);
    }
  };

  // Filter notifications
  let filtered = notifications;
  if (filterType !== 'all') {
    filtered = filtered.filter((n) => n.notification_type === filterType);
  }
  if (filterStatus !== 'all') {
    filtered = filtered.filter((n) => n.status === filterStatus);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification History</CardTitle>
        <CardDescription>View and manage sent notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="event_reminder">Event Reminder</SelectItem>
                <SelectItem value="event_invitation">Event Invitation</SelectItem>
                <SelectItem value="task_assigned">Task Assigned</SelectItem>
                <SelectItem value="daily_digest">Daily Digest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={loadNotifications}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div className="p-3 bg-muted rounded">
            <div className="font-semibold">{notifications.length}</div>
            <div className="text-muted-foreground text-xs">Total</div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="font-semibold">{notifications.filter((n) => n.status === 'sent').length}</div>
            <div className="text-muted-foreground text-xs">Sent</div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="font-semibold">{notifications.filter((n) => n.status === 'pending').length}</div>
            <div className="text-muted-foreground text-xs">Pending</div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="font-semibold">{notifications.filter((n) => n.status === 'failed').length}</div>
            <div className="text-muted-foreground text-xs">Failed</div>
          </div>
        </div>

        {/* TABLE */}
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            {notifications.length === 0 ? 'No notifications sent yet' : 'No notifications match filters'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((notification) => (
                  <TableRow key={notification.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-sm">
                      {notification.notification_type.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {channelIcons[notification.channel]}
                        <span className="text-sm">{notification.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[notification.status]}>
                        {notification.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {notification.recipient_address || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {notification.status === 'failed' && (
                        <Button
                          onClick={() => handleResend(notification.id)}
                          disabled={resendingId === notification.id}
                          size="sm"
                          variant="outline"
                        >
                          {resendingId === notification.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCw className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
