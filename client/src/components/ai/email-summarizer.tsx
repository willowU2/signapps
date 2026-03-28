'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface EmailItem {
  id: string;
  sender: string;
  subject: string;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  isRead: boolean;
}

export function EmailSummarizer() {
  const [emails, setEmails] = useState<EmailItem[]>([
    {
      id: '1',
      sender: 'john.smith@acme.com',
      subject: 'Quarterly Budget Review Meeting',
      summary: 'Budget review scheduled for March 28th. Please prepare Q1 financial reports.',
      priority: 'high',
      isRead: false,
    },
    {
      id: '2',
      sender: 'marketing@company.com',
      subject: 'Campaign Launch Update',
      summary: 'New marketing campaign launches Monday with 40% budget increase allocated.',
      priority: 'medium',
      isRead: false,
    },
    {
      id: '3',
      sender: 'hr@company.com',
      subject: 'Team Building Event Confirmation',
      summary: 'Team event confirmed for April 5th at Blue River Resort. RSVP required by Friday.',
      priority: 'low',
      isRead: true,
    },
    {
      id: '4',
      sender: 'client.support@vendor.com',
      subject: 'Critical System Update Required',
      summary: 'Security patch urgent: Update system within 24 hours to prevent vulnerabilities.',
      priority: 'high',
      isRead: false,
    },
    {
      id: '5',
      sender: 'notifications@service.com',
      subject: 'Invoice #INV-2026-0415 Ready',
      summary: 'Invoice INV-2026-0415 for $2,450 is ready for review and approval.',
      priority: 'medium',
      isRead: true,
    },
  ]);

  const handleMarkAsRead = (id: string) => {
    setEmails(emails.map(email => (email.id === id ? { ...email, isRead: true } : email)));
    toast.success('Marked as read');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 border-red-200';
      case 'medium':
        return 'bg-amber-50 border-amber-200';
      case 'low':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-amber-100 text-amber-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="h-4 w-4" />;
      case 'medium':
        return <Clock className="h-4 w-4" />;
      case 'low':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const unreadCount = emails.filter(e => !e.isRead).length;
  const highPriorityCount = emails.filter(e => e.priority === 'high' && !e.isRead).length;

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Summarizer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600 font-medium">Unread</p>
              <p className="text-2xl font-bold text-blue-900">{unreadCount}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-600 font-medium">High Priority</p>
              <p className="text-2xl font-bold text-red-900">{highPriorityCount}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 font-medium">Total Emails</p>
              <p className="text-2xl font-bold text-slate-900">{emails.length}</p>
            </div>
          </div>

          {/* Email List */}
          <div className="space-y-3">
            {emails.map(email => (
              <div
                key={email.id}
                className={`p-4 rounded-lg border-2 ${getPriorityColor(email.priority)} ${
                  email.isRead ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-sm font-semibold text-slate-900 flex-1">{email.sender}</p>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityBadgeColor(
                          email.priority
                        )}`}
                      >
                        {getPriorityIcon(email.priority)}
                        {email.priority.charAt(0).toUpperCase() + email.priority.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{email.subject}</p>
                  </div>
                </div>

                <p className="text-sm text-slate-700 mb-4 line-clamp-2">{email.summary}</p>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {email.isRead && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    <span>{email.isRead ? 'Read' : 'Unread'}</span>
                  </div>

                  {!email.isRead && (
                    <Button
                      onClick={() => handleMarkAsRead(email.id)}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      Mark as Read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
            <Button variant="outline" className="w-full">
              Archive All Read
            </Button>
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Refresh Inbox
            </Button>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-900">
              <span className="font-semibold">Tip:</span> AI-powered summaries are generated from email content. Mark emails
              as read to remove them from your priority view.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
