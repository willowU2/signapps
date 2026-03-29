'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface Ticket {
  id: string;
  title: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  createdDate: string;
}

interface TicketListProps {
  tickets?: Ticket[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open':
      return 'bg-blue-100 text-blue-800';
    case 'in-progress':
      return 'bg-yellow-100 text-yellow-800';
    case 'resolved':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-muted text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-orange-100 text-orange-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-muted text-gray-800';
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function TicketList({ tickets = [] }: TicketListProps) {
  const [displayTickets] = useState<Ticket[]>(tickets);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Support Tickets</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">ID</TableHead>
              <TableHead className="w-80">Title</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead className="w-40">Assignee</TableHead>
              <TableHead className="w-32">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              displayTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-mono text-sm">{ticket.id}</TableCell>
                  <TableCell className="font-medium truncate">{ticket.title}</TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(ticket.status)} capitalize`}>
                      {ticket.status.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getPriorityColor(ticket.priority)} capitalize`}>
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {ticket.assignee || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(ticket.createdDate)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
