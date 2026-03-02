import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Share, Star, MessageSquarePlus, Clock, FileText, Folder, Cloud, Video, User as UserIcon, Settings, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface DocumentHeaderProps {
    title?: string;
    onTitleChange?: (title: string) => void;
    isSynced: boolean;
    awarenessStates: any[];
    menuBar?: React.ReactNode;
}

export function DocumentHeader({
    title = 'Document sans titre',
    onTitleChange,
    isSynced,
    awarenessStates,
    menuBar,
}: DocumentHeaderProps) {
    const [localTitle, setLocalTitle] = useState(title);
    const { user, logout } = useAuthStore();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="flex items-center justify-between px-4 py-2 bg-[#f9fbfd] dark:bg-background border-b border-transparent">
            <div className="flex items-start gap-3">
                {/* Logo Box (Mimics Google Docs blue doc icon) */}
                <div className="w-10 h-10 mt-1 flex items-center justify-center text-[#1a73e8] shadow-sm shrink-0 cursor-pointer">
                    <FileText className="w-9 h-9" fill="#1a73e8" stroke="white" strokeWidth={1.5} />
                </div>

                <div className="flex flex-col gap-0.5 mt-0.5">
                    <div className="flex items-center gap-2">
                        <Input
                            value={localTitle}
                            onChange={(e) => setLocalTitle(e.target.value)}
                            onBlur={() => onTitleChange?.(localTitle)}
                            className="h-6 text-[18px] font-medium border-transparent hover:border-[#dadce0] focus-visible:ring-2 focus-visible:ring-[#1a73e8] px-1 py-0 w-[200px] bg-transparent shadow-none !outline-none text-[#202124] dark:text-[#e8eaed]"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-[#5f6368] hover:text-[#202124] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]">
                            <Star className="h-[14px] w-[14px]" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-[#5f6368] hover:text-[#202124] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]">
                            <Folder className="h-[14px] w-[14px]" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-[#5f6368] hover:text-[#202124] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]">
                            <Cloud className="h-[14px] w-[14px]" />
                        </Button>
                    </div>
                    {/* Inject the Menu Bar right under the title */}
                    <div className="-ml-1.5">
                        {menuBar}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* History / Status */}
                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground hover:underline cursor-pointer">
                    <Clock className="h-3 w-3" />
                    <span>Dernière modification il y a quelques secondes</span>
                </div>

                {/* Sync indicator */}
                <div className="flex items-center gap-1.5 px-2 bg-muted/30 rounded-full py-1 border border-border/50">
                    <div
                        className={`w-2 h-2 rounded-full ${isSynced ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'
                            }`}
                    />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
                        {isSynced ? 'Synced' : 'Syncing'}
                    </span>
                </div>

                {/* Collaborators */}
                {awarenessStates.length > 0 && (
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5 -space-x-2 *:ring-2 *:ring-background overflow-hidden px-2">
                            {awarenessStates.map((state: any, idx) => (
                                <div
                                    key={idx}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm hover:scale-110 transition-transform cursor-default relative group"
                                    style={{
                                        backgroundColor: state.user?.color || '#ccc',
                                    }}
                                >
                                    {state.user?.name?.[0]?.toUpperCase() || '?'}
                                    <div className="absolute -top-8 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                        {state.user?.name || 'Unknown'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#5f6368] hover:bg-[#f1f3f4] dark:text-[#9aa0a6] dark:hover:bg-[#303134]">
                        <MessageSquarePlus className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#5f6368] hover:bg-[#f1f3f4] dark:text-[#9aa0a6] dark:hover:bg-[#303134] mr-2">
                        <Video className="h-5 w-5" />
                    </Button>
                    
                    <Button className="bg-[#c2e7ff] hover:bg-[#a8d3f1] text-[#001d35] font-medium rounded-full px-6 h-9 transition-colors shadow-none dark:bg-[#004a77] dark:text-[#c2e7ff] dark:hover:bg-[#005a92] mr-2">
                        <Share className="h-4 w-4 mr-2" />
                        Partager
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary/10 text-primary">
                                        {getInitials(user?.display_name || user?.username)}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>
                                <div className="flex flex-col">
                                    <span>{user?.display_name || user?.username}</span>
                                    <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
                                <UserIcon className="mr-2 h-4 w-4" /> Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/settings')}>
                                <Settings className="mr-2 h-4 w-4" /> Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                                <LogOut className="mr-2 h-4 w-4" /> Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
