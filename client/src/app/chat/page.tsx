"use client";

import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { EmptyChatState } from "@/components/chat/empty-chat-state";
import {
  Menu,
  MessageSquare,
  Settings,
  Search,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import {
  useSelectedChannel,
  useSelectedChannelName,
  useChatActions,
  useIsDm,
} from "@/lib/store/chat-store";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useUsers } from "@/hooks/use-users";
import { chatApi } from "@/lib/api/chat";
import { FEATURES } from "@/lib/features";

export default function ChatPage() {
  usePageTitle("Chat");
  const selectedChannel = useSelectedChannel();
  const selectedChannelName = useSelectedChannelName();
  const isDm = useIsDm();
  const { setSelectedChannel, setUsersMap } = useChatActions();
  const [isPrivate, setIsPrivate] = useState(false);

  const { data: usersData } = useUsers();

  useEffect(() => {
    if (!usersData) return;
    const map: Record<string, any> = {};
    usersData.forEach((u: any) => {
      map[u.id] = u;
    });
    setUsersMap(map);
  }, [usersData, setUsersMap]);

  // Track privacy of selected channel
  useEffect(() => {
    if (!selectedChannel || isDm) {
      setIsPrivate(false);
      return;
    }
    if (!FEATURES.CHAT_PRIVATE_CHANNELS) return;
    chatApi
      .getChannel(selectedChannel)
      .then((res) => setIsPrivate(res.data?.is_private ?? false))
      .catch(() => setIsPrivate(false));
  }, [selectedChannel, isDm]);

  const handleSelectChannel = (
    id: string,
    name?: string,
    dmFlag?: boolean,
    priv?: boolean,
  ) => {
    setSelectedChannel(id, name, dmFlag);
    setIsPrivate(priv ?? false);
  };

  return (
    <WorkspaceShell
      className="bg-muted/30 dark:bg-background"
      header={
        <header className="h-16 flex items-center justify-between px-4 bg-muted/30 dark:bg-background shrink-0">
          <div className="flex items-center gap-4 w-[250px]">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-muted rounded-full"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <span className="text-xl font-normal text-muted-foreground">
                Chat
              </span>
            </div>
          </div>

          <div className="flex-1 max-w-[720px] px-4">
            <div className="flex items-center bg-muted dark:bg-muted/50 px-4 py-2 rounded-full h-12 w-full">
              <Search className="h-5 w-5 text-muted-foreground mr-4" />
              <input
                type="text"
                placeholder="Rechercher une discussion"
                className="bg-transparent border-none outline-none flex-1 text-base placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center bg-background px-3 py-1.5 rounded-full border shadow-sm mr-2 cursor-pointer hover:bg-muted">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
              <span className="text-sm font-medium text-muted-foreground">
                Actif
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-muted rounded-full"
            >
              <Settings className="h-6 w-6" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium ml-2 cursor-pointer">
              E
            </div>
          </div>
        </header>
      }
      sidebar={
        <div className="w-[260px] flex flex-col shrink-0 mt-2 mr-2">
          <ChatSidebar
            selectedChannel={selectedChannel}
            onSelectChannel={handleSelectChannel}
          />
        </div>
      }
    >
      <div className="flex-1 glass-panel rounded-2xl shadow-premium border border-border/50 overflow-hidden flex flex-col min-w-0 mt-2 mb-2">
        {selectedChannel ? (
          <ChatWindow
            channelId={selectedChannel}
            channelName={selectedChannelName || undefined}
            isDm={isDm}
            isPrivate={isPrivate}
          />
        ) : (
          <EmptyChatState />
        )}
      </div>
    </WorkspaceShell>
  );
}
