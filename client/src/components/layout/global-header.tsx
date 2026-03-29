'use client';

import { LanguageSwitcher } from '@/components/i18n/language-switcher';
function LanguageSwitcherCompact() { return <LanguageSwitcher compact />; }

import { useAuthStore, useUIStore } from '@/lib/store';
import { useTenantStore } from '@/stores/tenant-store';
import { usePresenceStore } from '@/stores/presence-store';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarGroup, AvatarMore } from '@/components/shadcnblocks/avatar-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import {
    LogOut, User as UserIcon, Settings, PanelLeft, PanelRight,
    Share2, MessageSquare, History, HardDrive, Mail, CheckSquare,
    Video, Activity, Route, Calendar, Shield, Users, MessageCircle, Search, SlidersHorizontal, FileText,
    Clock, HelpCircle, Star, Copy, Check, Palette
} from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { ChangelogDialog } from '@/components/onboarding/ChangelogDialog';
import { RecentHistory } from '@/components/recent-history';
import { NotificationBadge } from '@/components/notifications/notification-badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import Link from 'next/link';
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher';
import { SessionIndicator } from '@/components/layout/session-indicator';

export function GlobalHeader() {
    const { user, logout } = useAuthStore();
    const { toggleSidebar, sidebarCollapsed, toggleRightSidebar, rightSidebarOpen } = useUIStore();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const { currentWorkspace, members, fetchMembers } = useTenantStore();
    const presenceUsers = usePresenceStore((state) => state.users);

    const [linkCopied, setLinkCopied] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleCopyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {
            // Clipboard not available
        }
    }, []);

    useEffect(() => {
        if (currentWorkspace?.id) {
            fetchMembers(currentWorkspace.id);
        }
    }, [currentWorkspace?.id, fetchMembers]);

    // Only show users who are connected
    const onlineUserIds = Array.from(presenceUsers.values())
        .filter(u => u.isOnline)
        .map(u => u.userId);

    const otherMembers = members.filter(m => 
        m.user_id !== user?.id && onlineUserIds.includes(m.user_id)
    );
    const displayedMembers = otherMembers.slice(0, 3);
    const hiddenMembers = otherMembers.slice(3);

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

    const searchParams = useSearchParams();
    const docName = searchParams.get('name');

    // --- Contextual Logic ---
    let headerTitle = "App";
    let HeaderIcon = null;
    let showDocActions = false;

    if (pathname.startsWith('/docs')) {
        if (pathname.includes('/editor')) {
            showDocActions = true;
            headerTitle = docName || 'Document sans titre';
        } else {
            headerTitle = "Documents";
            HeaderIcon = <FileText className="h-5 w-5 text-blue-500" />;
        }
    } else if (pathname.startsWith('/sheets')) {
        if (pathname.includes('/editor')) {
            showDocActions = true;
            headerTitle = docName || 'Tableur sans titre';
        } else {
            headerTitle = "Tableurs";
            HeaderIcon = <FileText className="h-5 w-5 text-green-500" />;
        }
    } else if (pathname.startsWith('/slides')) {
        if (pathname.includes('/editor')) {
            showDocActions = true;
            headerTitle = docName || 'Présentation sans titre';
        } else {
            headerTitle = "Présentations";
            HeaderIcon = <FileText className="h-5 w-5 text-yellow-500" />;
        }
    } else if (pathname.startsWith('/chat')) {
        headerTitle = "Chat";
        HeaderIcon = <MessageCircle className="h-5 w-5 text-primary" />;
    } else if (pathname.startsWith('/mail')) {
        headerTitle = "Mail";
        HeaderIcon = <Mail className="h-5 w-5 text-blue-500" />;
    } else if (pathname.startsWith('/drive')) {
        headerTitle = "Drive";
        HeaderIcon = <HardDrive className="h-5 w-5 text-indigo-500" />;
    } else if (pathname.startsWith('/storage')) {
        headerTitle = "Stockage (Infra)";
        HeaderIcon = <HardDrive className="h-5 w-5 text-gray-500" />;
    } else if (pathname.startsWith('/tasks')) {
        headerTitle = "Tâches";
        HeaderIcon = <CheckSquare className="h-5 w-5 text-green-500" />;
    } else if (pathname.startsWith('/meet')) {
        headerTitle = "Réunions";
        HeaderIcon = <Video className="h-5 w-5 text-teal-500" />;
    } else if (pathname.startsWith('/settings')) {
        headerTitle = "Paramètres";
        HeaderIcon = <Settings className="h-5 w-5 text-gray-500" />;
    } else if (pathname.startsWith('/monitoring')) {
        headerTitle = "Supervision";
        HeaderIcon = <Activity className="h-5 w-5 text-orange-500" />;
    } else if (pathname.startsWith('/routes')) {
        headerTitle = "Routes";
        HeaderIcon = <Route className="h-5 w-5 text-purple-500" />;
    } else if (pathname.startsWith('/scheduler')) {
        headerTitle = "Planificateur";
        HeaderIcon = <Calendar className="h-5 w-5 text-rose-500" />;
    } else if (pathname.startsWith('/vpn')) {
        headerTitle = "VPN";
        HeaderIcon = <Shield className="h-5 w-5 text-red-500" />;
    } else if (pathname.startsWith('/users')) {
        headerTitle = "Annuaire";
        HeaderIcon = <Users className="h-5 w-5 text-cyan-500" />;
    } else if (pathname.startsWith('/dashboard')) {
        headerTitle = "Tableau de bord";
    } else if (pathname.startsWith('/calendar')) {
        headerTitle = "Calendrier";
        HeaderIcon = <Calendar className="h-5 w-5 text-blue-500" />;
    } else if (pathname.startsWith('/keep')) {
        headerTitle = "Notes";
    } else if (pathname.startsWith('/design')) {
        headerTitle = "Design";
    } else if (pathname.startsWith('/social')) {
        headerTitle = "Social";
        HeaderIcon = <Share2 className="h-5 w-5 text-pink-500" />;
    } else if (pathname.startsWith('/containers')) {
        headerTitle = "Conteneurs";
    } else if (pathname.startsWith('/backups')) {
        headerTitle = "Sauvegardes";
    } else if (pathname.startsWith('/apps')) {
        headerTitle = "App Store";
    } else if (pathname.startsWith('/it-assets')) {
        headerTitle = "Parc informatique";
    } else if (pathname.startsWith('/resources')) {
        headerTitle = "Ressources";
    } else if (pathname.startsWith('/ai')) {
        headerTitle = "IA";
        HeaderIcon = <MessageSquare className="h-5 w-5 text-violet-500" />;
    } else if (pathname.startsWith('/billing')) {
        headerTitle = "Facturation";
    } else if (pathname.startsWith('/analytics')) {
        headerTitle = "Analytique";
    } else if (pathname.startsWith('/workforce')) {
        headerTitle = "Effectifs";
    } else if (pathname.startsWith('/admin')) {
        headerTitle = "Administration";
        HeaderIcon = <Shield className="h-5 w-5 text-amber-500" />;
    } else if (pathname.startsWith('/media')) {
        headerTitle = "Média";
    } else if (pathname.startsWith('/contacts')) {
        headerTitle = "Contacts";
    } else if (pathname.startsWith('/forms')) {
        headerTitle = "Formulaires";
    } else if (pathname.startsWith('/pxe')) {
        headerTitle = "Déploiement PXE";
    } else if (pathname.startsWith('/remote')) {
        headerTitle = "Accès distant";
    } else if (pathname.startsWith('/help')) {
        headerTitle = "Aide";
        HeaderIcon = <HelpCircle className="h-5 w-5 text-blue-500" />;
    } else if (pathname.startsWith('/bookmarks')) {
        headerTitle = "Favoris";
        HeaderIcon = <Star className="h-5 w-5 text-yellow-500" />;
    }

    // Generate Contextual Breadcrumbs
    const labelMap: Record<string, string> = {
        cal: 'Calendrier',
        dashboard: 'Tableau de bord',
        docs: 'Documents',
        sheets: 'Tableurs',
        slides: 'Présentations',
        tasks: 'Tâches',
        settings: 'Paramètres',
        calendar: 'Calendrier',
        keep: 'Notes',
        design: 'Design',
        chat: 'Chat',
        mail: 'Mail',
        meet: 'Meet',
        social: 'Social',
        containers: 'Conteneurs',
        drive: 'Drive',
        routes: 'Routes',
        vpn: 'VPN',
        backups: 'Sauvegardes',
        apps: 'App Store',
        'it-assets': 'Parc informatique',
        ai: 'IA',
        scheduler: 'Planificateur',
        monitoring: 'Supervision',
        billing: 'Facturation',
        analytics: 'Analytique',
        workforce: 'Effectifs',
        admin: 'Administration',
        users: 'Utilisateurs',
        workspaces: 'Espaces de travail',
        resources: 'Ressources',
        storage: 'Stockage',
        media: 'Média',
        contacts: 'Contacts',
        forms: 'Formulaires',
        pxe: 'Déploiement PXE',
        remote: 'Accès distant',
        help: 'Aide',
        bookmarks: 'Favoris',
        profile: 'Profil',
        preferences: 'Préférences',
        notifications: 'Notifications',
        webhooks: 'Webhooks',
        appearance: 'Apparence',
        editor: 'Éditeur',
        'email-signature': 'Signature',
        'ai-routing': 'Routage IA',
        accessibility: 'Accessibilité',
    };

    // Section grouping: maps a top-level path to its section name and URL
    const sectionGroupMap: Record<string, { section: string; sectionUrl: string }> = {
        docs: { section: 'Productivité', sectionUrl: '/dashboard' },
        sheets: { section: 'Productivité', sectionUrl: '/dashboard' },
        slides: { section: 'Productivité', sectionUrl: '/dashboard' },
        keep: { section: 'Productivité', sectionUrl: '/dashboard' },
        design: { section: 'Productivité', sectionUrl: '/dashboard' },
        tasks: { section: 'Productivité', sectionUrl: '/dashboard' },
        mail: { section: 'Communication', sectionUrl: '/dashboard' },
        chat: { section: 'Communication', sectionUrl: '/dashboard' },
        meet: { section: 'Communication', sectionUrl: '/dashboard' },
        calendar: { section: 'Productivité', sectionUrl: '/dashboard' },
        contacts: { section: 'Communication', sectionUrl: '/dashboard' },
        containers: { section: 'Infrastructure', sectionUrl: '/dashboard' },
        routes: { section: 'Infrastructure', sectionUrl: '/dashboard' },
        vpn: { section: 'Infrastructure', sectionUrl: '/dashboard' },
        monitoring: { section: 'Infrastructure', sectionUrl: '/dashboard' },
        scheduler: { section: 'Infrastructure', sectionUrl: '/dashboard' },
        backups: { section: 'Infrastructure', sectionUrl: '/dashboard' },
        pxe: { section: 'Infrastructure', sectionUrl: '/dashboard' },
        remote: { section: 'Infrastructure', sectionUrl: '/dashboard' },
        settings: { section: 'Administration', sectionUrl: '/settings' },
        admin: { section: 'Administration', sectionUrl: '/admin' },
        users: { section: 'Administration', sectionUrl: '/settings' },
        ai: { section: 'Intelligence', sectionUrl: '/ai' },
        social: { section: 'Réseaux sociaux', sectionUrl: '/social' },
        storage: { section: 'Stockage', sectionUrl: '/storage' },
        drive: { section: 'Stockage', sectionUrl: '/drive' },
    };

    const pathSegments = pathname.split('/').filter(Boolean);

    // Build breadcrumb items with optional section group
    const rawBreadcrumbItems = pathSegments.map((segment, index) => {
        const url = `/${pathSegments.slice(0, index + 1).join('/')}`;
        const isLast = index === pathSegments.length - 1;
        const label = labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

        // Shorten long IDs
        const displayLabel = label.length > 20 && index > 0 ? `${label.substring(0, 8)}...` : label;

        return { label: displayLabel, url, isLast };
    });

    // Insert section group crumb if the first segment has a group mapping
    const firstSegment = pathSegments[0];
    const sectionGroup = firstSegment ? sectionGroupMap[firstSegment] : undefined;
    const breadcrumbItems = sectionGroup && pathSegments.length > 0
        ? [
              { label: sectionGroup.section, url: sectionGroup.sectionUrl, isLast: false },
              ...rawBreadcrumbItems,
          ]
        : rawBreadcrumbItems;

    return (
        <header className="sticky top-0 z-30 flex min-h-[4rem] flex-wrap items-center justify-between gap-y-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 px-4 md:px-6">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                {/* Left Sidebar Toggle — mobile */}
                <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSidebar}
                            className={`transition-colors lg:hidden ${mounted && !sidebarCollapsed ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
                        >
                            <PanelLeft className="h-5 w-5" />
                            <span className="sr-only">Basculer le menu latéral</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Basculer le menu latéral</TooltipContent>
                </Tooltip>
                </TooltipProvider>

                {/* Desktop Toggle */}
                <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSidebar}
                            className={`transition-colors hidden lg:flex ${mounted && !sidebarCollapsed ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
                        >
                            <PanelLeft className="h-5 w-5" />
                            <span className="sr-only">Basculer le menu latéral</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Basculer le menu latéral</TooltipContent>
                </Tooltip>
                </TooltipProvider>

                        {/* AQ-SHWK: Workspace switcher */}
                <WorkspaceSwitcher />

                {/* Contextual App Metadata Area */}
                <div className="flex items-center gap-3 ml-2">
                    {HeaderIcon && (
                        <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-center shadow-sm">
                            {HeaderIcon}
                        </div>
                    )}
                    <div className="flex flex-col">
                        {/* Dynamic Breadcrumbs */}
                        <div className="flex items-center gap-1 mb-0.5 hidden sm:flex">
                            <Breadcrumb>
                                <BreadcrumbList className="gap-1 sm:gap-1.5 min-h-[20px]">
                                    <BreadcrumbItem>
                                        <BreadcrumbLink asChild>
                                            <Link href="/dashboard" className="text-xs">Accueil</Link>
                                        </BreadcrumbLink>
                                    </BreadcrumbItem>
                                    {breadcrumbItems.map((item, index) => (
                                        <div key={item.url} className="flex items-center gap-1 sm:gap-1.5">
                                            <BreadcrumbSeparator className="[&>svg]:size-3" />
                                            <BreadcrumbItem>
                                                {item.isLast ? (
                                                    <BreadcrumbPage className="text-xs font-semibold">{item.label}</BreadcrumbPage>
                                                ) : (
                                                    <BreadcrumbLink asChild>
                                                        <Link href={item.url || '#'} className="text-xs">{item.label}</Link>
                                                    </BreadcrumbLink>
                                                )}
                                            </BreadcrumbItem>
                                        </div>
                                    ))}
                                </BreadcrumbList>
                            </Breadcrumb>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleCopyLink}
                                            className="ml-1 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
                                            title="Copier le lien de cette page"
                                        >
                                            {linkCopied ? (
                                                <Check className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                        {linkCopied ? 'Lien copié !' : 'Copier le lien'}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {showDocActions ? (
                            <input
                                type="text"
                                defaultValue={headerTitle}
                                className="text-lg font-semibold text-foreground bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-1 -ml-1 hover:bg-accent transition-colors w-full max-w-[300px]"
                            />
                        ) : (
                            <span className="text-lg font-bold tracking-tight text-foreground px-1 -ml-1">
                                {headerTitle}
                            </span>
                        )}

                        {showDocActions && (
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-medium">
                                <span className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                    Enregistré dans le cloud
                                </span>
                                <span>•</span>
                                <span className="cursor-pointer hover:text-foreground transition-colors">Mon Drive</span>
                                <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-1">
                                            <History className="h-3 w-3" />
                                            <span className="sr-only">Historique</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">Historique des versions</TooltipContent>
                                </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {headerTitle === 'Mail' && (
                <div className="flex-1 max-w-[720px] mx-8 relative hidden md:block">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher dans les messages"
                        className="w-full pl-12 pr-12 h-12 bg-[#f1f3f4] dark:bg-[#1f1f1f] border-transparent hover:bg-background hover:dark:bg-[#202124] hover:shadow-sm focus-visible:bg-background focus-visible:dark:bg-[#202124] focus-visible:ring-0 focus-visible:shadow-md transition-all rounded-full text-base"
                    />
                    <SlidersHorizontal className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer hover:text-foreground" />
                </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
                {/* Action Items Based on Context */}
                {showDocActions && (
                    <>
                        {/* Comments and Share buttons removed per user request for a cleaner UI */}
                    </>
                )}

                {!showDocActions && (
                    <div className="mr-2 flex items-center gap-2">
                        <ChangelogDialog />
                        <RecentHistory />
                        <NotificationPopover />
                    </div>
                )}

                {/* Right Sidebar Toggle */}
                {showDocActions && (
                    <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleRightSidebar}
                                className={`transition-colors mr-2 ${mounted && rightSidebarOpen ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
                            >
                                <PanelRight className="h-5 w-5" />
                                <span className="sr-only">Basculer le panneau droit</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Basculer le panneau droit</TooltipContent>
                    </Tooltip>
                    </TooltipProvider>
                )}

                {/* Connecté Workspace Users */}
                <div className="hidden sm:flex items-center mr-2">
                    <TooltipProvider>
                        <AvatarGroup>
                            {displayedMembers.map((m, index) => (
                                <Tooltip key={m.user_id}>
                                    <TooltipTrigger asChild>
                                        <Avatar 
                                            className="h-8 w-8 border-2 border-background relative cursor-pointer hover:!z-50 transition-transform hover:scale-110"
                                            style={{ zIndex: 40 - index }}
                                        >
                                            {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                                {m.display_name?.charAt(0).toUpperCase() || m.username.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{m.display_name || m.username}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}

                            {hiddenMembers.length > 0 && (
                                <Popover>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <PopoverTrigger asChild>
                                                <AvatarMore count={hiddenMembers.length} className="cursor-pointer transition-transform hover:scale-110 hover:z-50" />
                                            </PopoverTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Voir les {hiddenMembers.length} autres membres</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    
                                    <PopoverContent className="w-56 p-2" align="end">
                                        <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Autres membres du workspace</p>
                                        <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto w-full">
                                            {hiddenMembers.map(m => (
                                                <div key={m.user_id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded-md cursor-pointer transition-colors">
                                                    <Avatar className="h-7 w-7 flex-shrink-0">
                                                        {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                                                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                                                            {m.display_name?.charAt(0).toUpperCase() || m.username.charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm font-medium truncate">{m.display_name || m.username}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </AvatarGroup>
                    </TooltipProvider>
                </div>

                {/* Language Switcher */}
                <LanguageSwitcherCompact />

                {/* Theme Toggle — Light / Dark / System */}
                <ThemeToggle />

                {/* Session Activity Indicator */}
                <SessionIndicator />

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="gap-2" aria-label="Menu utilisateur">
                            <Avatar className="h-8 w-8">
                                {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.username} />}
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
                                {user?.last_login && (
                                    <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 mt-1">
                                        <Clock className="h-3 w-3" />
                                        Dernière connexion : {formatDistanceToNow(new Date(user.last_login), { addSuffix: true, locale: fr })}
                                    </span>
                                )}
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
                            <UserIcon className="mr-2 h-4 w-4" />
                            Profil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/settings')}>
                            <Settings className="mr-2 h-4 w-4" />
                            Paramètres
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/settings/appearance')}>
                            <Palette className="mr-2 h-4 w-4" />
                            Apparence
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            Déconnexion
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
