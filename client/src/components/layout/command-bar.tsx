'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, FileText, Mail, User, Mic, Monitor, Calendar, LayoutDashboard, Building2, FolderOpen, Plus, CheckSquare } from 'lucide-react';
import { useEntityStore } from '@/stores/entity-hub-store';
import { useUIStore } from '@/lib/store';

export function CommandBar() {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    const { workspaces, projects, setSelectedWorkspace } = useEntityStore();
    const { setCreateWorkspaceModalOpen, setCreateProjectModalOpen, setCreateTaskModalOpen } = useUIStore();

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-background/40 backdrop-blur-sm transition-all" onClick={() => setOpen(false)}>
            <div className="w-full max-w-2xl bg-card/60 backdrop-blur-2xl rounded-2xl shadow-premium border border-border/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <Command label="Global Command Menu" className="w-full">
                    <div className="flex items-center border-b border-border/50 px-3" cmdk-input-wrapper="">
                        <Search className="mr-2 h-5 w-5 shrink-0 opacity-50" />
                        <Command.Input
                            autoFocus
                            placeholder="Type a command or search..."
                            className="flex h-14 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                        />
                    </div>
                    <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
                        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No results found.</Command.Empty>

                        <Command.Group heading="Apps" className="text-xs font-semibold text-muted-foreground px-2 py-2">
                            <Command.Item onSelect={() => runCommand(() => router.push('/dashboard'))} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground">
                                <LayoutDashboard className="mr-3 h-4 w-4" />
                                <span>Dashboard</span>
                            </Command.Item>
                            <Command.Item onSelect={() => runCommand(() => router.push('/tasks'))} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground">
                                <FileText className="mr-3 h-4 w-4" />
                                <span>Tasks</span>
                            </Command.Item>
                            <Command.Item onSelect={() => runCommand(() => router.push('/scheduler'))} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground">
                                <Calendar className="mr-3 h-4 w-4" />
                                <span>Calendar</span>
                            </Command.Item>
                        </Command.Group>

                        {workspaces.length > 0 && (
                            <Command.Group heading="Workspaces" className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2">
                                {workspaces.map(w => (
                                    <Command.Item key={`workspace-${w.id}`} onSelect={() => runCommand(() => { setSelectedWorkspace(w.id); router.push('/dashboard'); })} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground">
                                        <Building2 className="mr-3 h-4 w-4" />
                                        <span>Switch to {w.name}</span>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        {projects.length > 0 && (
                            <Command.Group heading="Projects" className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2">
                                {projects.map(p => (
                                    <Command.Item key={`proj-${p.id}`} onSelect={() => runCommand(() => router.push(`/projects/${p.id}`))} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground">
                                        <FolderOpen className="mr-3 h-4 w-4" />
                                        <span>Go to {p.name}</span>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        <Command.Group heading="Quick Actions" className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2">
                            <Command.Item onSelect={() => runCommand(() => setCreateWorkspaceModalOpen(true))} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground">
                                <Plus className="mr-3 h-4 w-4" />
                                <span>Create Workspace...</span>
                            </Command.Item>
                            <Command.Item onSelect={() => runCommand(() => setCreateProjectModalOpen(true))} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground">
                                <FolderOpen className="mr-3 h-4 w-4" />
                                <span>Create Project...</span>
                            </Command.Item>
                            <Command.Item onSelect={() => runCommand(() => setCreateTaskModalOpen(true))} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground">
                                <CheckSquare className="mr-3 h-4 w-4" />
                                <span>Create Task...</span>
                            </Command.Item>
                        </Command.Group>

                        <Command.Group heading="Intelligent Actions" className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2">
                            <Command.Item onSelect={() => runCommand(() => router.push('/chat'))} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary text-foreground hover:bg-primary/10 hover:text-primary">
                                <Mic className="mr-3 h-4 w-4" />
                                <span>Ask AI Assistant...</span>
                            </Command.Item>
                        </Command.Group>

                        <Command.Separator className="h-px bg-border/50 my-2 mx-4" />

                        <Command.Group heading="System" className="text-xs font-semibold text-muted-foreground px-2 py-2">
                            <Command.Item onSelect={() => runCommand(() => router.push('/settings'))} className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground">
                                <Monitor className="mr-3 h-4 w-4" />
                                <span>System Settings</span>
                            </Command.Item>
                        </Command.Group>
                    </Command.List>
                </Command>
            </div>
        </div>
    );
}
