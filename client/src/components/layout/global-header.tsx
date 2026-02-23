'use client';

import { useAuthStore, useUIStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Moon, Sun, LogOut, User as UserIcon, Settings, PanelLeft, PanelRight,
    Share2, MessageSquare, History, HardDrive, Mail, CheckSquare,
    Video, Activity, Route, Calendar, Shield, Users, MessageCircle
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { NotificationBadge } from '@/components/notifications/notification-badge';

export function GlobalHeader() {
    const { user, logout } = useAuthStore();
    const { theme, setTheme, toggleSidebar, sidebarCollapsed, toggleRightSidebar, rightSidebarOpen } = useUIStore();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // --- Contextual Logic ---
    let headerTitle = "App";
    let HeaderIcon = null;
    let showDocActions = false;

    if (pathname.startsWith('/docs') || pathname.startsWith('/sheets') || pathname.startsWith('/slides')) {
        const parts = pathname.split('/');
        const id = parts[parts.length - 1];
        headerTitle = id && id !== 'docs' && id !== 'sheets' && id !== 'slides' ? `Document ${id}` : 'Untitled Document';
        showDocActions = true;
    } else if (pathname.startsWith('/chat')) {
        headerTitle = "Chat";
        HeaderIcon = <MessageCircle className="h-5 w-5 text-primary" />;
    } else if (pathname.startsWith('/mail')) {
        headerTitle = "Mail";
        HeaderIcon = <Mail className="h-5 w-5 text-blue-500" />;
    } else if (pathname.startsWith('/storage')) {
        headerTitle = "Drive";
        HeaderIcon = <HardDrive className="h-5 w-5 text-indigo-500" />;
    } else if (pathname.startsWith('/tasks')) {
        headerTitle = "Tasks";
        HeaderIcon = <CheckSquare className="h-5 w-5 text-green-500" />;
    } else if (pathname.startsWith('/meet')) {
        headerTitle = "Meet";
        HeaderIcon = <Video className="h-5 w-5 text-teal-500" />;
    } else if (pathname.startsWith('/settings')) {
        headerTitle = "Settings";
        HeaderIcon = <Settings className="h-5 w-5 text-gray-500" />;
    } else if (pathname.startsWith('/monitoring')) {
        headerTitle = "Monitoring";
        HeaderIcon = <Activity className="h-5 w-5 text-orange-500" />;
    } else if (pathname.startsWith('/routes')) {
        headerTitle = "Routes";
        HeaderIcon = <Route className="h-5 w-5 text-purple-500" />;
    } else if (pathname.startsWith('/scheduler')) {
        headerTitle = "Scheduler";
        HeaderIcon = <Calendar className="h-5 w-5 text-rose-500" />;
    } else if (pathname.startsWith('/vpn')) {
        headerTitle = "VPN";
        HeaderIcon = <Shield className="h-5 w-5 text-red-500" />;
    } else if (pathname.startsWith('/users')) {
        headerTitle = "Directory";
        HeaderIcon = <Users className="h-5 w-5 text-cyan-500" />;
    }

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <div className="flex items-center gap-4">
                {/* Left Sidebar Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className={`transition-colors lg:hidden ${!sidebarCollapsed ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
                    title="Toggle Left Menu"
                >
                    <PanelLeft className="h-5 w-5" />
                </Button>

                {/* Desktop Toggle (Always visible if we want the Editor behavior, but standard layout has it hidden on lg) */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className={`transition-colors hidden lg:flex ${!sidebarCollapsed ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
                    title="Toggle Left Menu"
                >
                    <PanelLeft className="h-5 w-5" />
                </Button>

                {/* Contextual App Metadata Area */}
                <div className="flex items-center gap-3 ml-2">
                    {HeaderIcon && (
                        <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-center shadow-sm">
                            {HeaderIcon}
                        </div>
                    )}
                    <div className="flex flex-col">
                        {showDocActions ? (
                            <input
                                type="text"
                                defaultValue={headerTitle}
                                className="text-lg font-semibold text-foreground bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-1 -ml-1 hover:bg-accent transition-colors w-full max-w-[300px]"
                            />
                        ) : (
                            <span className="text-lg font-semibold text-foreground px-1 -ml-1">
                                {headerTitle}
                            </span>
                        )}

                        {showDocActions && (
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-medium">
                                <span className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                    Saved to cloud
                                </span>
                                <span>•</span>
                                <span className="cursor-pointer hover:text-foreground transition-colors">My Drive</span>
                                <Button variant="ghost" size="icon" className="h-4 w-4 ml-1">
                                    <History className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Action Items Based on Context */}
                {showDocActions && (
                    <>
                        <Button variant="outline" size="sm" className="hidden sm:flex gap-2 h-9">
                            <MessageSquare className="h-4 w-4" />
                            <span className="hidden lg:inline">Comments</span>
                        </Button>

                        <Button variant="default" size="sm" className="hidden sm:flex gap-2 h-9 mr-2">
                            <Share2 className="h-4 w-4" />
                            <span>Share</span>
                        </Button>
                    </>
                )}

                {!showDocActions && (
                    <div className="mr-2 flex items-center gap-2">
                        <NotificationPopover />
                        <NotificationBadge className="cursor-pointer" />
                    </div>
                )}

                {/* Right Sidebar Toggle */}
                {showDocActions && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleRightSidebar}
                        className={`transition-colors mr-2 ${rightSidebarOpen ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
                        title="Toggle Right Menu"
                    >
                        <PanelRight className="h-5 w-5" />
                    </Button>
                )}

                {/* Theme Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                    {mounted && theme === 'dark' ? (
                        <Sun className="h-5 w-5" />
                    ) : (
                        <Moon className="h-5 w-5" />
                    )}
                </Button>

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                    {getInitials(user?.display_name || user?.username)}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            <div className="flex flex-col">
                                <span>{user?.display_name || user?.username}</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    {user?.email}
                                </span>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
                            <UserIcon className="mr-2 h-4 w-4" />
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/settings')}>
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
