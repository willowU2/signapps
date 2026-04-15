"use client";

import { useAuthStore, useUIStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Moon,
  Sun,
  Menu,
  LogOut,
  User as UserIcon,
  Settings,
  PanelLeft,
  PanelRight,
  Clock,
  History,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface EditorHeaderProps {
  documentId: string;
  icon?: React.ReactNode;
}

export function EditorHeader({ documentId, icon }: EditorHeaderProps) {
  const { user, logout } = useAuthStore();
  const {
    toggleSidebar,
    sidebarCollapsed,
    toggleRightSidebar,
    rightSidebarOpen,
  } = useUIStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-4">
        {/* Left Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={`transition-colors ${!sidebarCollapsed ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
          title="Toggle Left Menu"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>

        {/* Document Metadata Area (Word Style) */}
        <div className="flex items-center gap-3 ml-2">
          {icon && (
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-center">
              {icon}
            </div>
          )}
          <div className="flex flex-col">
            <input
              type="text"
              defaultValue={`Document ${documentId}`}
              className="text-lg font-semibold text-foreground bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-1 -ml-1 hover:bg-accent transition-colors w-full max-w-[300px]"
            />
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Saved to cloud
              </span>
              <span>•</span>
              <span className="cursor-pointer hover:text-foreground transition-colors">
                My Drive
              </span>
              <Button variant="ghost" size="icon" className="h-4 w-4 ml-1">
                <History className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Right Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleRightSidebar}
          className={`transition-colors mr-2 ${rightSidebarOpen ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
          title="Toggle Right Menu"
        >
          <PanelRight className="h-5 w-5" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {mounted && theme === "dark" ? (
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
            <DropdownMenuItem onClick={() => router.push("/settings/profile")}>
              <UserIcon className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
