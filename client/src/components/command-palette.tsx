'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  Sparkles,
  Search,
  FileText,
  Mail,
  Presentation,
  AlignLeft,
  Wand2,
  ListTodo,
  FileAxis3D
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
  const pathname = usePathname();
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

  const dispatchAppEvent = useCallback((eventName: string, payload: any = {}) => {
    setOpen(false);
    // Allows the current App (like `SlideEditor` or `MailEditor`) to intercept this action
    window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
    >
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="custom-scrollbar">
        <CommandEmpty className="py-6 text-center text-sm">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <p>No results found for "{search}".</p>
            {search && (
              <button
                className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors mt-1 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2 rounded-full font-medium shadow-sm hover:shadow"
                onClick={() => runCommand(() => router.push(`/ai?q=${encodeURIComponent(search)}`))}
              >
                <Sparkles className="h-4 w-4" />
                Ask Universal AI to find "{search}"
              </button>
            )}
          </div>
        </CommandEmpty>

        {/* --- Contextual App Actions (Intelligent Sensing) --- */}
        {!search && (
          <CommandGroup heading="Current Context (AI Actions)">
            {pathname.includes('/docs') && (
              <>
                <CommandItem onSelect={() => dispatchAppEvent('app:ai-action', { action: 'summarize' })}>
                  <AlignLeft className="mr-2 h-4 w-4 text-purple-500" />
                  <span>Summarize this document</span>
                </CommandItem>
                <CommandItem onSelect={() => dispatchAppEvent('app:ai-action', { action: 'draft' })}>
                  <Wand2 className="mr-2 h-4 w-4 text-indigo-500" />
                  <span>Help me write...</span>
                </CommandItem>
                <CommandItem onSelect={() => dispatchAppEvent('app:editor-action', { action: 'format-fix' })}>
                  <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                  <span>Fix formatting and spelling</span>
                </CommandItem>
              </>
            )}
            {pathname.includes('/mail') && (
              <>
                <CommandItem onSelect={() => dispatchAppEvent('app:ai-action', { action: 'draft-reply' })}>
                  <Mail className="mr-2 h-4 w-4 text-blue-500" />
                  <span>Draft smart reply</span>
                </CommandItem>
                <CommandItem onSelect={() => dispatchAppEvent('app:ai-action', { action: 'summarize-thread' })}>
                  <ListTodo className="mr-2 h-4 w-4 text-emerald-500" />
                  <span>Extract Task List from thread</span>
                </CommandItem>
              </>
            )}
            {pathname.includes('/slides') && (
              <>
                <CommandItem onSelect={() => dispatchAppEvent('app:ai-action', { action: 'generate-layout' })}>
                  <Presentation className="mr-2 h-4 w-4 text-rose-500" />
                  <span>Generate slide layout from text</span>
                </CommandItem>
                <CommandItem onSelect={() => dispatchAppEvent('app:ai-action', { action: 'simplify-text' })}>
                  <AlignLeft className="mr-2 h-4 w-4 text-indigo-500" />
                  <span>Simplify text for presentation</span>
                </CommandItem>
              </>
            )}
            {!pathname.includes('/docs') && !pathname.includes('/mail') && !pathname.includes('/slides') && (
              <CommandItem onSelect={() => runCommand(() => router.push('/ai'))}>
                <MessageSquare className="mr-2 h-4 w-4 text-indigo-500" />
                <span>Chat with Workspace AI Assistant</span>
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {(pathname.includes('/docs') || pathname.includes('/mail') || pathname.includes('/slides')) && <CommandSeparator />}

        {/* --- Universal Search Mock --- */}
        {search && (
          <>
            <CommandGroup heading="Files (Universal Search)">
              <CommandItem onSelect={() => runCommand(() => router.push('/docs/q4-report'))}>
                <FileText className="mr-2 h-4 w-4 text-blue-500" />
                <span>{search} - Q4 Financial Report</span>
                <span className="ml-auto text-xs text-muted-foreground border rounded px-1.5 py-0.5">Doc</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/slides/pitch'))}>
                <Presentation className="mr-2 h-4 w-4 text-yellow-500" />
                <span>{search} Deck 2026</span>
                <span className="ml-auto text-xs text-muted-foreground border rounded px-1.5 py-0.5">Slide</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

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
