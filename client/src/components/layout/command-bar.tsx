'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, FileText, Mail, User, Mic, Monitor, Calendar, LayoutDashboard } from 'lucide-react';

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

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm transition-all" onClick={() => setOpen(false)}>
            <div className="w-full max-w-2xl bg-background dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-100" onClick={(e) => e.stopPropagation()}>
                <Command label="Global Command Menu" className="w-full">
                    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                        <Search className="mr-2 h-5 w-5 shrink-0 opacity-50" />
                        <Command.Input
                            autoFocus
                            placeholder="Type a command or search..."
                            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100"
                        />
                    </div>
                    <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
                        <Command.Empty className="py-6 text-center text-sm text-gray-500">No results found.</Command.Empty>

                        <Command.Group heading="Apps" className="text-xs font-medium text-gray-500 px-2 py-1.5">
                            <Command.Item onSelect={() => runCommand(() => router.push('/dashboard'))} className="flex items-center px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-900 dark:text-gray-100 data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                <span>Dashboard</span>
                            </Command.Item>
                            <Command.Item onSelect={() => runCommand(() => router.push('/docs'))} className="flex items-center px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-900 dark:text-gray-100 data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800">
                                <FileText className="mr-2 h-4 w-4" />
                                <span>Docs</span>
                            </Command.Item>
                            <Command.Item onSelect={() => runCommand(() => router.push('/mail'))} className="flex items-center px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-900 dark:text-gray-100 data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800">
                                <Mail className="mr-2 h-4 w-4" />
                                <span>Mail</span>
                            </Command.Item>
                            <Command.Item onSelect={() => runCommand(() => router.push('/calendar'))} className="flex items-center px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-900 dark:text-gray-100 data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800">
                                <Calendar className="mr-2 h-4 w-4" />
                                <span>Calendar</span>
                            </Command.Item>
                        </Command.Group>

                        <Command.Group heading="Intelligent Actions" className="text-xs font-medium text-gray-500 px-2 py-1.5 mt-2">
                            <Command.Item onSelect={() => runCommand(() => router.push('/ai'))} className="flex items-center px-2 py-2 rounded-lg cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors text-sm text-gray-900 dark:text-gray-100 data-[selected=true]:bg-purple-100 dark:data-[selected=true]:bg-purple-900/20">
                                <Mic className="mr-2 h-4 w-4 text-purple-500" />
                                <span>Ask AI Assistant...</span>
                            </Command.Item>
                        </Command.Group>

                        <Command.Separator className="h-px bg-gray-200 dark:bg-gray-800 my-2" />

                        <Command.Group heading="System" className="text-xs font-medium text-gray-500 px-2 py-1.5">
                            <Command.Item onSelect={() => runCommand(() => router.push('/settings'))} className="flex items-center px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-900 dark:text-gray-100 data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800">
                                <Monitor className="mr-2 h-4 w-4" />
                                <span>System Settings</span>
                            </Command.Item>
                        </Command.Group>
                    </Command.List>
                </Command>
            </div>
        </div>
    );
}
