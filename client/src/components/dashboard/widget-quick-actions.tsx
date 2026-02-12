'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Network, Upload, Wifi } from 'lucide-react';
import Link from 'next/link';

export function WidgetQuickActions() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link href="/containers">
          <Button variant="outline" className="w-full justify-start">
            <Plus className="mr-2 h-4 w-4" />
            New Container
          </Button>
        </Link>
        <Link href="/routes">
          <Button variant="outline" className="w-full justify-start">
            <Network className="mr-2 h-4 w-4" />
            Add Route
          </Button>
        </Link>
        <Link href="/storage">
          <Button variant="outline" className="w-full justify-start">
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
        </Link>
        <Link href="/ai">
          <Button variant="outline" className="w-full justify-start">
            <Wifi className="mr-2 h-4 w-4" />
            AI Assistant
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
