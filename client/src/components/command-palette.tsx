'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  LayoutDashboard,
  Container,
  HardDrive,
  Network,
  Shield,
  Clock,
  Activity,
  MessageSquare,
  Users,
  Settings,
  Search,
  User,
  LogOut,
  Mic,
  Trash2,
  Share2,
  FileText,
  Volume2,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  name: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { logout } = useAuthStore();

  const commands: CommandItem[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      description: 'View system overview',
      icon: LayoutDashboard,
      action: () => router.push('/dashboard'),
      keywords: ['home', 'overview', 'stats'],
    },
    {
      id: 'containers',
      name: 'Containers',
      description: 'Manage Docker containers',
      icon: Container,
      action: () => router.push('/containers'),
      keywords: ['docker', 'services'],
    },
    {
      id: 'storage',
      name: 'Storage',
      description: 'Browse files and buckets',
      icon: HardDrive,
      action: () => router.push('/storage'),
      keywords: ['files', 'buckets', 's3', 'minio', 'nas'],
    },
    {
      id: 'trash',
      name: 'Trash',
      description: 'View deleted files',
      icon: Trash2,
      action: () => router.push('/storage/trash'),
      keywords: ['deleted', 'recycle', 'bin', 'restore'],
    },
    {
      id: 'shares',
      name: 'Shared Links',
      description: 'Manage shared file links',
      icon: Share2,
      action: () => router.push('/storage/shares'),
      keywords: ['share', 'link', 'public', 'download'],
    },
    {
      id: 'media',
      name: 'Media Processing',
      description: 'OCR, TTS, and STT tools',
      icon: Mic,
      action: () => router.push('/media'),
      keywords: ['ocr', 'tts', 'stt', 'speech', 'text', 'audio', 'transcribe'],
    },
    {
      id: 'routes',
      name: 'Routes',
      description: 'Configure proxy routes',
      icon: Network,
      action: () => router.push('/routes'),
      keywords: ['proxy', 'traefik', 'ssl', 'certificates'],
    },
    {
      id: 'vpn',
      name: 'VPN',
      description: 'Manage VPN devices',
      icon: Shield,
      action: () => router.push('/vpn'),
      keywords: ['nebula', 'network', 'secure'],
    },
    {
      id: 'scheduler',
      name: 'Scheduler',
      description: 'Manage CRON jobs',
      icon: Clock,
      action: () => router.push('/scheduler'),
      keywords: ['cron', 'jobs', 'tasks', 'automation'],
    },
    {
      id: 'monitoring',
      name: 'Monitoring',
      description: 'View system metrics',
      icon: Activity,
      action: () => router.push('/monitoring'),
      keywords: ['metrics', 'cpu', 'memory', 'disk'],
    },
    {
      id: 'ai',
      name: 'AI Assistant',
      description: 'Chat with documents',
      icon: MessageSquare,
      action: () => router.push('/ai'),
      keywords: ['chat', 'rag', 'search', 'documents'],
    },
    {
      id: 'users',
      name: 'Users',
      description: 'Manage user accounts',
      icon: Users,
      action: () => router.push('/users'),
      keywords: ['accounts', 'permissions', 'roles'],
    },
    {
      id: 'settings',
      name: 'Settings',
      description: 'Configure system settings',
      icon: Settings,
      action: () => router.push('/settings'),
      keywords: ['config', 'ldap', 'webhooks', 'groups'],
    },
    {
      id: 'profile',
      name: 'Profile',
      description: 'Edit your profile',
      icon: User,
      action: () => router.push('/settings/profile'),
      keywords: ['account', 'mfa', '2fa', 'password'],
    },
    {
      id: 'logout',
      name: 'Logout',
      description: 'Sign out of your account',
      icon: LogOut,
      action: () => {
        logout();
        router.push('/login');
      },
      keywords: ['signout', 'exit'],
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some((k) => k.includes(searchLower))
    );
  });

  // Keyboard shortcut to open palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Navigation within palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          selected.action();
          setOpen(false);
          setSearch('');
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    },
    [filteredCommands, selectedIndex]
  );

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-lg overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 h-12"
            autoFocus
          />
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </p>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((cmd, index) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      index === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    )}
                    onClick={() => {
                      cmd.action();
                      setOpen(false);
                      setSearch('');
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-60" />
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium truncate">{cmd.name}</p>
                      {cmd.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {cmd.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            <kbd className="rounded bg-muted px-1">↑</kbd>{' '}
            <kbd className="rounded bg-muted px-1">↓</kbd> to navigate
          </span>
          <span>
            <kbd className="rounded bg-muted px-1">Enter</kbd> to select
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
