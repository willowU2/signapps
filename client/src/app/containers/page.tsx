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
  Plus,
  Search,
  Play,
  Square,
  RotateCcw,
  MoreVertical,
  FileText,
  Trash2,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { containersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LogsDialog } from '@/components/containers/logs-dialog';
import { ContainerDialog } from '@/components/containers/container-dialog';
import { ContainerTerminal } from '@/components/containers/container-terminal';
import { toast } from 'sonner';

interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  state: 'running' | 'stopped' | 'restarting' | 'paused' | 'exited';
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
  const [logsDialog, setLogsDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });
  const [terminalDialog, setTerminalDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    try {
      const response = await containersApi.list();
      // Map API response to Container interface
      // API returns ContainerResponse with optional docker_info
      const mapped = (response.data || []).map((c: any) => {
        const dockerInfo = c.docker_info;
        return {
          id: c.id,
          name: c.name,
          image: c.image,
          status: c.status || dockerInfo?.status || 'unknown',
          state: dockerInfo?.state || 'stopped',
          cpu: dockerInfo?.cpu_percent ? `${dockerInfo.cpu_percent}%` : '-',
          memory: dockerInfo?.memory_usage ? formatBytes(dockerInfo.memory_usage) : '-',
          ports: dockerInfo?.ports?.map((p: any) => `${p.host_port || p.container_port}`) || [],
          created: c.created_at || c.created || '',
        };
      });
      setContainers(mapped);
    } catch (error) {
      console.error('Failed to fetch containers:', error);
      // Show empty list on error - no mock data
      setContainers([]);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart' | 'remove') => {
    try {
      switch (action) {
        case 'start':
          await containersApi.start(id);
          toast.success('Container started');
          break;
        case 'stop':
          await containersApi.stop(id);
          toast.success('Container stopped');
          break;
        case 'restart':
          await containersApi.restart(id);
          toast.success('Container restarting');
          break;
        case 'remove':
          await containersApi.remove(id);
          toast.success('Container removed');
          break;
      }
      fetchContainers();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      toast.error(`Failed to ${action} container`);
    }
  };

  const filteredContainers = containers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' || c.state === filter || (filter === 'stopped' && (c.state === 'stopped' || c.state === 'exited'));
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'running':
        return <Badge className="bg-green-500/10 text-green-600">Running</Badge>;
      case 'stopped':
      case 'exited':
        return <Badge variant="secondary">Stopped</Badge>;
      case 'restarting':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Restarting</Badge>;
      case 'paused':
        return <Badge className="bg-orange-500/10 text-orange-600">Paused</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchContainers}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Container
            </Button>
          </div>
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
                      container.state === 'running'
                        ? 'bg-green-500'
                        : container.state === 'restarting'
                        ? 'bg-yellow-500'
                        : 'bg-gray-400'
                    )}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{container.name}</span>
                      {getStatusBadge(container.state)}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsDialog({ open: true, id: container.id, name: container.name })}
                  >
                    <FileText className="mr-1 h-4 w-4" />
                    Logs
                  </Button>

                  {container.state === 'running' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTerminalDialog({ open: true, id: container.id, name: container.name })}
                    >
                      <Terminal className="mr-1 h-4 w-4" />
                      Terminal
                    </Button>
                  )}

                  {container.state === 'running' ? (
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

        {/* Logs Dialog */}
        <LogsDialog
          open={logsDialog.open}
          onOpenChange={(open) => setLogsDialog({ ...logsDialog, open })}
          containerId={logsDialog.id}
          containerName={logsDialog.name}
        />

        {/* Create Container Dialog */}
        <ContainerDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={fetchContainers}
        />

        {/* Terminal Dialog */}
        <ContainerTerminal
          open={terminalDialog.open}
          onOpenChange={(open) => setTerminalDialog({ ...terminalDialog, open })}
          containerId={terminalDialog.id}
          containerName={terminalDialog.name}
        />
      </div>
    </AppLayout>
  );
}
