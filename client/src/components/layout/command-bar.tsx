'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import { fetchOmniSearch } from '@/lib/api/search';
import {
    Search, FileText, Mail, User, Mic, Monitor, Calendar,
    LayoutDashboard, Building2, FolderOpen, Plus, CheckSquare,
    File, MessageSquare, HardDrive, Settings, Shield, Users,
    Clock, UserPlus, Video, Star, History, Pencil, BookOpen,
    Upload,
} from 'lucide-react';
import { useEntityStore } from '@/stores/entity-hub-store';
import { useUIStore } from '@/lib/store';
import { useCommandBarStore } from '@/stores/command-bar-store';
import { logActivity } from '@/hooks/use-activity-tracker';

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

// ---------------------------------------------------------------------------
// Navigation items: all primary app pages
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
    { label: 'Dashboard',  icon: LayoutDashboard, href: '/dashboard',  shortcut: '⌘D' },
    { label: 'Docs',       icon: FileText,         href: '/docs'                       },
    { label: 'Sheets',     icon: FileText,         href: '/sheets'                     },
    { label: 'Slides',     icon: FileText,         href: '/slides'                     },
    { label: 'Calendar',   icon: Calendar,         href: '/calendar'                   },
    { label: 'Mail',       icon: Mail,             href: '/mail'                       },
    { label: 'Chat',       icon: MessageSquare,    href: '/chat'                       },
    { label: 'Drive',      icon: HardDrive,        href: '/drive'                      },
    { label: 'Tasks',      icon: CheckSquare,      href: '/tasks'                      },
    { label: 'Projects',   icon: FolderOpen,       href: '/projects'                   },
    { label: 'Meet',       icon: Video,            href: '/meet'                       },
    { label: 'Contacts',   icon: User,             href: '/contacts'                   },
    { label: 'App Store',  icon: Monitor,          href: '/apps'                       },
    { label: 'Containers', icon: Monitor,          href: '/containers'                 },
    { label: 'AI Assistant', icon: MessageSquare,   href: '/ai'                        },
    { label: 'Settings',   icon: Settings,         href: '/settings',   shortcut: '⌘,' },
    { label: 'Admin',      icon: Shield,           href: '/admin'                      },
    { label: 'Users',      icon: Users,            href: '/users'                      },
] as const;

// ---------------------------------------------------------------------------
// Action items: quick-create shortcuts
// ---------------------------------------------------------------------------
const ACTION_ITEMS = [
    { label: 'Nouveau document',  icon: FileText,    href: '/docs?new=true'        },
    { label: 'Nouvel email',      icon: Mail,        href: '/mail?compose=true'    },
    { label: 'Nouveau contact',   icon: UserPlus,    href: '/contacts?new=true'    },
    { label: 'Nouvelle tâche',    icon: CheckSquare, action: 'createTask'          },
    { label: 'Nouvelle réunion',  icon: Video,       href: '/meet?new=true'        },
    { label: 'Nouveau tableur',   icon: FileText,    href: '/sheets?new=true'      },
    { label: 'Nouvelle note',     icon: Pencil,      href: '/keep?new=true'        },
    { label: 'Upload fichier',    icon: Upload,      href: '/drive?upload=true'    },
] as const;

// ---------------------------------------------------------------------------
// CommandBar
// ---------------------------------------------------------------------------
export function CommandBar() {
    const router = useRouter();
    const { isOpen: open, setOpen, toggle, recentItems } = useCommandBarStore();
    const [query, setQuery] = React.useState('');
    const debouncedQuery = useDebounce(query, 300);

    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['omni-search', debouncedQuery],
        queryFn: () => fetchOmniSearch(debouncedQuery),
        enabled: debouncedQuery.length > 0,
    });

    // Register Cmd+K / Ctrl+K global shortcut
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                toggle();
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [toggle]);

    // Reset query when closed
    React.useEffect(() => {
        if (!open) setQuery('');
    }, [open]);

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, [setOpen]);

    const { workspaces, projects, setSelectedWorkspace } = useEntityStore();
    const { setCreateWorkspaceModalOpen, setCreateProjectModalOpen, setCreateTaskModalOpen } = useUIStore();

    if (!open) return null;

    const itemCls = 'flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground';

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-background/40 backdrop-blur-sm transition-all"
            onClick={() => setOpen(false)}
        >
            <div
                className="w-full max-w-2xl bg-card/60 backdrop-blur-2xl rounded-2xl shadow-premium border border-border/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <Command label="Global Command Menu" className="w-full">
                    {/* Search input */}
                    <div className="flex items-center border-b border-border/50 px-3" cmdk-input-wrapper="">
                        <Search className="mr-2 h-5 w-5 shrink-0 opacity-50" />
                        <Command.Input
                            autoFocus
                            placeholder="Type a command or search everywhere..."
                            className="flex h-14 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                            value={query}
                            onValueChange={setQuery}
                        />
                        {/* Keyboard hint */}
                        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0 ml-2">
                            ESC
                        </kbd>
                    </div>

                    <Command.List className="max-h-[420px] overflow-y-auto overflow-x-hidden p-2">
                        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                            No results found.
                        </Command.Empty>

                        {/* Live search results (federated) */}
                        {isLoading && debouncedQuery.length > 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">
                                Searching everywhere...
                            </div>
                        )}

                        {searchResults?.results && searchResults.results.length > 0 && (
                            <Command.Group heading="Search Results" className="text-xs font-semibold text-muted-foreground px-2 py-2">
                                {searchResults.results.map(r => (
                                    <Command.Item
                                        key={r.id}
                                        onSelect={() => runCommand(() => router.push(r.url))}
                                        className={itemCls}
                                    >
                                        {r.entity_type === 'document' && <FileText className="mr-3 h-4 w-4 text-blue-500 shrink-0" />}
                                        {r.entity_type === 'mail'     && <Mail     className="mr-3 h-4 w-4 text-red-500 shrink-0" />}
                                        {r.entity_type === 'file'     && <File     className="mr-3 h-4 w-4 text-orange-500 shrink-0" />}
                                        {r.entity_type === 'user'     && <User     className="mr-3 h-4 w-4 text-green-500 shrink-0" />}
                                        <div className="flex flex-col items-start overflow-hidden">
                                            <span className="truncate w-full">{r.title}</span>
                                            {r.snippet && (
                                                <span className="text-xs text-muted-foreground truncate w-full">{r.snippet}</span>
                                            )}
                                        </div>
                                        {r.entity_type && (
                                            <span className="ml-auto text-xs text-muted-foreground border rounded px-1.5 py-0.5 capitalize shrink-0">
                                                {r.entity_type}
                                            </span>
                                        )}
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        {/* Deep search shortcut – always visible when user has typed a query */}
                        {debouncedQuery.length > 0 && (
                            <Command.Group heading="Recherche avancée" className="text-xs font-semibold text-muted-foreground px-2 py-2">
                                <Command.Item
                                    value={`search documents ai ${debouncedQuery}`}
                                    onSelect={() => runCommand(() => {
                                        logActivity('search', debouncedQuery, 'AI deep search');
                                        router.push(`/ai/search?q=${encodeURIComponent(debouncedQuery)}`);
                                    })}
                                    className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary text-foreground hover:bg-primary/10 hover:text-primary"
                                >
                                    <BookOpen className="mr-3 h-4 w-4 shrink-0" />
                                    <span>Rechercher &laquo;{debouncedQuery}&raquo; dans les documents (IA)...</span>
                                </Command.Item>
                            </Command.Group>
                        )}

                        {/* Navigation */}
                        <Command.Group heading="Navigation" className="text-xs font-semibold text-muted-foreground px-2 py-2">
                            {NAV_ITEMS.map(item => (
                                <Command.Item
                                    key={item.href}
                                    value={item.label}
                                    onSelect={() => { logActivity('navigated', item.label, item.href); runCommand(() => router.push(item.href)); }}
                                    className={itemCls}
                                >
                                    <item.icon className="mr-3 h-4 w-4 shrink-0" />
                                    <span>{item.label}</span>
                                    {'shortcut' in item && item.shortcut && (
                                        <kbd className="ml-auto text-[10px] text-muted-foreground tracking-widest">
                                            {item.shortcut}
                                        </kbd>
                                    )}
                                </Command.Item>
                            ))}
                        </Command.Group>

                        <Command.Separator className="h-px bg-border/50 my-2 mx-4" />

                        {/* Actions */}
                        <Command.Group heading="Actions" className="text-xs font-semibold text-muted-foreground px-2 py-2">
                            {ACTION_ITEMS.map(item => (
                                <Command.Item
                                    key={item.label}
                                    value={item.label}
                                    onSelect={() => {
                                        logActivity('created', item.label, 'Via command bar');
                                        if ('action' in item && item.action === 'createTask') {
                                            runCommand(() => setCreateTaskModalOpen(true));
                                        } else if ('href' in item) {
                                            runCommand(() => router.push(item.href));
                                        }
                                    }}
                                    className={itemCls}
                                >
                                    <item.icon className="mr-3 h-4 w-4 shrink-0 text-primary" />
                                    <span>{item.label}</span>
                                    <Plus className="ml-auto h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                </Command.Item>
                            ))}
                        </Command.Group>

                        <Command.Separator className="h-px bg-border/50 my-2 mx-4" />

                        {/* Recent files from store */}
                        {recentItems.length > 0 && (
                            <Command.Group heading="Recent Files" className="text-xs font-semibold text-muted-foreground px-2 py-2">
                                {recentItems.slice(0, 5).map((item, idx) => {
                                    const block = item.block;
                                    const title =
                                        (block as any).data?.name ||
                                        (block as any).data?.title ||
                                        (block as any).data?.displayName ||
                                        block.id;
                                    return (
                                        <Command.Item
                                            key={`recent-${block.id || idx}`}
                                            value={`recent ${title}`}
                                            onSelect={() => runCommand(() => router.push(`/storage?preview=${block.id}`))}
                                            className={itemCls}
                                        >
                                            <History className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="truncate">{title}</span>
                                        </Command.Item>
                                    );
                                })}
                            </Command.Group>
                        )}

                        {/* Workspaces */}
                        {workspaces.length > 0 && (
                            <Command.Group heading="Workspaces" className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2">
                                {workspaces.map(w => (
                                    <Command.Item
                                        key={`workspace-${w.id}`}
                                        value={`workspace ${w.name}`}
                                        onSelect={() => runCommand(() => { setSelectedWorkspace(w.id); router.push('/dashboard'); })}
                                        className={itemCls}
                                    >
                                        <Building2 className="mr-3 h-4 w-4 shrink-0" />
                                        <span>Switch to {w.name}</span>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        {/* Projects */}
                        {projects.length > 0 && (
                            <Command.Group heading="Projects" className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2">
                                {projects.map(p => (
                                    <Command.Item
                                        key={`proj-${p.id}`}
                                        value={`project ${p.name}`}
                                        onSelect={() => runCommand(() => router.push(`/projects/${p.id}`))}
                                        className={itemCls}
                                    >
                                        <FolderOpen className="mr-3 h-4 w-4 shrink-0" />
                                        <span>Go to {p.name}</span>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        <Command.Separator className="h-px bg-border/50 my-2 mx-4" />

                        {/* Quick actions (workspace/project creation) */}
                        <Command.Group heading="Quick Actions" className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2">
                            <Command.Item
                                value="create workspace"
                                onSelect={() => runCommand(() => setCreateWorkspaceModalOpen(true))}
                                className={itemCls}
                            >
                                <Plus className="mr-3 h-4 w-4 shrink-0" />
                                <span>Create Workspace...</span>
                            </Command.Item>
                            <Command.Item
                                value="create project"
                                onSelect={() => runCommand(() => setCreateProjectModalOpen(true))}
                                className={itemCls}
                            >
                                <FolderOpen className="mr-3 h-4 w-4 shrink-0" />
                                <span>Create Project...</span>
                            </Command.Item>
                            <Command.Item
                                value="create task"
                                onSelect={() => runCommand(() => setCreateTaskModalOpen(true))}
                                className={itemCls}
                            >
                                <CheckSquare className="mr-3 h-4 w-4 shrink-0" />
                                <span>Create Task...</span>
                            </Command.Item>
                        </Command.Group>

                        <Command.Separator className="h-px bg-border/50 my-2 mx-4" />

                        {/* AI / System */}
                        <Command.Group heading="AI & System" className="text-xs font-semibold text-muted-foreground px-2 py-2">
                            <Command.Item
                                value="ai assistant ask"
                                onSelect={() => runCommand(() => router.push('/chat'))}
                                className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary text-foreground hover:bg-primary/10 hover:text-primary"
                            >
                                <Mic className="mr-3 h-4 w-4 shrink-0" />
                                <span>Ask AI Assistant...</span>
                            </Command.Item>
                            <Command.Item
                                value="system settings"
                                onSelect={() => runCommand(() => router.push('/settings'))}
                                className={itemCls}
                            >
                                <Monitor className="mr-3 h-4 w-4 shrink-0" />
                                <span>System Settings</span>
                            </Command.Item>
                        </Command.Group>
                    </Command.List>

                    {/* Footer hint */}
                    <div className="border-t border-border/50 px-3 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span><kbd className="font-sans">↑↓</kbd> navigate</span>
                        <span><kbd className="font-sans">↵</kbd> select</span>
                        <span><kbd className="font-sans">Esc</kbd> close</span>
                        <span className="ml-auto opacity-60">Cmd+K to reopen</span>
                    </div>
                </Command>
            </div>
        </div>
    );
}
