'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  User,
  LogOut,
  Mic,
  Trash2,
  Share2,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { logout } = useAuthStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Type a command or search..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty className="py-6 text-center text-sm">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <p>No results found.</p>
            {search && (
              <button 
                className="flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors mt-1 bg-purple-50 dark:bg-purple-950/30 px-4 py-2 rounded-full font-medium"
                onClick={() => runCommand(() => router.push(`/ai?q=${encodeURIComponent(search)}`))}
              >
                <Sparkles className="h-4 w-4" />
                Ask AI about "{search}"
              </button>
            )}
          </div>
        </CommandEmpty>

        <CommandGroup heading="System">
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/containers'))}>
            <Container className="mr-2 h-4 w-4" />
            <span>Containers</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/monitoring'))}>
            <Activity className="mr-2 h-4 w-4" />
            <span>Monitoring</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Features">
          <CommandItem onSelect={() => runCommand(() => router.push('/storage'))}>
            <HardDrive className="mr-2 h-4 w-4" />
            <span>Storage & Files</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/storage/trash'))}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Trash</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/storage/shares'))}>
            <Share2 className="mr-2 h-4 w-4" />
            <span>Shared Links</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/media'))}>
            <Mic className="mr-2 h-4 w-4" />
            <span>Media Processing</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/ai'))}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>AI Assistant</span>
            <CommandShortcut>⌘A</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Networking & Infrastructure">
          <CommandItem onSelect={() => runCommand(() => router.push('/routes'))}>
            <Network className="mr-2 h-4 w-4" />
            <span>Routes</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/vpn'))}>
            <Shield className="mr-2 h-4 w-4" />
            <span>VPN</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/scheduler'))}>
            <Clock className="mr-2 h-4 w-4" />
            <span>Scheduler</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => router.push('/users'))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Users</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/settings/profile'))}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
          <CommandItem 
            onSelect={() => {
              runCommand(() => {
                logout();
                router.push('/login');
              });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
            <CommandShortcut>⇧⌘Q</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
