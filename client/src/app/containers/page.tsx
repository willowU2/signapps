'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  Play,
  Square,
  RotateCcw,
  MoreVertical,
  FileText,
  Trash2,
} from 'lucide-react';
import { containersApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Container {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'restarting';
  cpu: string;
  memory: string;
  ports: string[];
  created: string;
}

export default function ContainersPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newContainer, setNewContainer] = useState({ name: '', image: '' });

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    try {
      const response = await containersApi.list();
      setContainers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch containers:', error);
      // Mock data for development
      setContainers([
        {
          id: '1',
          name: 'nginx',
          image: 'nginx:alpine',
          status: 'running',
          cpu: '2%',
          memory: '128MB',
          ports: ['80', '443'],
          created: '3 days ago',
        },
        {
          id: '2',
          name: 'postgres',
          image: 'postgres:16',
          status: 'running',
          cpu: '5%',
          memory: '512MB',
          ports: ['5432'],
          created: '7 days ago',
        },
        {
          id: '3',
          name: 'redis',
          image: 'redis:7',
          status: 'stopped',
          cpu: '-',
          memory: '64MB',
          ports: ['6379'],
          created: '2 hours ago',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart' | 'remove') => {
    try {
      switch (action) {
        case 'start':
          await containersApi.start(id);
          break;
        case 'stop':
          await containersApi.stop(id);
          break;
        case 'restart':
          await containersApi.restart(id);
          break;
        case 'remove':
          await containersApi.remove(id);
          break;
      }
      fetchContainers();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
    }
  };

  const handleCreate = async () => {
    try {
      await containersApi.create({
        name: newContainer.name,
        image: newContainer.image,
      });
      setCreateDialogOpen(false);
      setNewContainer({ name: '', image: '' });
      fetchContainers();
    } catch (error) {
      console.error('Failed to create container:', error);
    }
  };

  const filteredContainers = containers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500/10 text-green-600">Running</Badge>;
      case 'stopped':
        return <Badge variant="secondary">Stopped</Badge>;
      case 'restarting':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Restarting</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Containers</h1>
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Containers</h1>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Container
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Container</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Container Name</Label>
                  <Input
                    id="name"
                    placeholder="my-container"
                    value={newContainer.name}
                    onChange={(e) =>
                      setNewContainer({ ...newContainer, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image">Image</Label>
                  <Input
                    id="image"
                    placeholder="nginx:latest"
                    value={newContainer.image}
                    onChange={(e) =>
                      setNewContainer({ ...newContainer, image: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search containers..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'running', 'stopped'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Container List */}
        <div className="space-y-4">
          {filteredContainers.map((container) => (
            <Card key={container.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full',
                      container.status === 'running'
                        ? 'bg-green-500'
                        : container.status === 'restarting'
                        ? 'bg-yellow-500'
                        : 'bg-gray-400'
                    )}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{container.name}</span>
                      {getStatusBadge(container.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{container.image}</span>
                      <span>CPU {container.cpu}</span>
                      <span>RAM {container.memory}</span>
                      {container.ports.length > 0 && (
                        <span>Ports: {container.ports.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <FileText className="mr-1 h-4 w-4" />
                    Logs
                  </Button>

                  {container.status === 'running' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(container.id, 'stop')}
                    >
                      <Square className="mr-1 h-4 w-4" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(container.id, 'start')}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      Start
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleAction(container.id, 'restart')}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restart
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleAction(container.id, 'remove')}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredContainers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No containers found
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
