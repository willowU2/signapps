'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Lock, ExternalLink, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Route {
  id: string;
  name: string;
  host: string;
  target: string;
  ssl: boolean;
  status: 'up' | 'down';
}

const mockRoutes: Route[] = [
  { id: '1', name: 'app', host: 'app.example.com', target: 'nginx:80', ssl: true, status: 'up' },
  { id: '2', name: 'api', host: 'api.example.com', target: 'backend:3000', ssl: true, status: 'up' },
  { id: '3', name: 'db', host: 'db.internal', target: 'postgres:5432', ssl: false, status: 'up' },
  { id: '4', name: 'cache', host: 'cache.internal', target: 'redis:6379', ssl: false, status: 'down' },
];

export default function RoutesPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Routes</h1>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Route
          </Button>
        </div>

        {/* Routes Table */}
        <Card>
          <CardHeader>
            <CardTitle>Proxy Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>SSL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRoutes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{route.host}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {route.target}
                    </TableCell>
                    <TableCell>
                      {route.ssl ? (
                        <Lock className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={route.status === 'up' ? 'default' : 'destructive'}
                        className={route.status === 'up' ? 'bg-green-500/10 text-green-600' : ''}
                      >
                        {route.status === 'up' ? 'Up' : 'Down'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* SSL Certificates */}
        <Card>
          <CardHeader>
            <CardTitle>SSL Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">*.example.com</p>
                <p className="text-sm text-muted-foreground">
                  Let&apos;s Encrypt - Expires: Mar 2026
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Renew
                </Button>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
