/**
 * Notification History Component
 * Display and manage sent notifications
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, MessageSquare, Bell, RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import useNotificationHistory, { Notification as HistoryNotification } from '@/hooks/use-notification-history';

interface NotificationHistoryProps {
  limit?: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-green-100 text-green-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  bounced: 'bg-red-100 text-red-800',
};

const channelIcons: Record<string, any> = {
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  push: <Bell className="h-4 w-4" />,
};

export function NotificationHistory({ limit = 50 }: NotificationHistoryProps) {
  const { notifications, loading, error, refetch, resendNotification } =
    useNotificationHistory(limit);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResend = async (id: string) => {
    try {
      setResendingId(id);
      await resendNotification(id);
    } catch (err) {
      console.error('Failed to resend notification:', err);
    } finally {
      setResendingId(null);
    }
  };

  // Filter notifications
  let filtered = notifications;
  if (filterType !== 'all') {
    filtered = filtered.filter((n) => n.channel === filterType);
  }
  if (filterStatus !== 'all') {
    filtered = filtered.filter((n) => n.delivery_status === filterStatus);
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
            <label className="text-sm font-medium">Channel</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="event_reminder">Event Reminder</SelectItem>
                <SelectItem value="task_due">Task Due</SelectItem>
                <SelectItem value="attendee_response">Attendee Response</SelectItem>
                <SelectItem value="calendar_invite">Calendar Invite</SelectItem>
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
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
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
            <div className="font-semibold">{notifications.filter((n) => n.delivery_status === 'sent').length}</div>
            <div className="text-muted-foreground text-xs">Sent</div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="font-semibold">{notifications.filter((n) => n.delivery_status === 'pending').length}</div>
            <div className="text-muted-foreground text-xs">Pending</div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="font-semibold">{notifications.filter((n) => n.delivery_status === 'failed').length}</div>
            <div className="text-muted-foreground text-xs">Failed</div>
          </div>
        </div>

        {/* TABLE */}
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            {notifications.length === 0 ? 'No notifications yet' : 'No notifications match filters'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((notification) => (
                  <TableRow key={notification.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {channelIcons[notification.type] || <Bell className="h-4 w-4" />}
                        <span className="text-sm">{notification.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-xs truncate">
                      {notification.title || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {notification.type}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[notification.delivery_status || 'sent']}>
                        {notification.delivery_status || 'sent'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.sent_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {notification.delivery_status === 'failed' && (
                        <Button
                          onClick={() => handleResend(notification.id)}
                          disabled={resendingId === notification.id}
                          size="sm"
                          variant="outline"
                        >
                          {resendingId === notification.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
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
