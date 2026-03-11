"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  StickyNote,
  Mail,
  CheckSquare,
  MessageCircle,
  FileText,
  Calendar,
  Settings,
  Search,
  ArrowRight,
  Sparkles,
  Bot,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useOmniStore, useOmniIsOpen, useOmniActions } from "@/stores/omni-store";
import { usePageContext } from "@/lib/store/page-context";
import { toast } from "sonner";

interface AppLink {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

const apps: AppLink[] = [
  {
    id: "keep",
    name: "Keep",
    description: "Notes et listes",
    href: "/keep",
    icon: StickyNote,
    shortcut: "K",
  },
  {
    id: "mail",
    name: "Mail",
    description: "Messagerie",
    href: "/mail",
    icon: Mail,
    shortcut: "M",
  },
  {
    id: "tasks",
    name: "Tasks",
    description: "Gestion des tâches",
    href: "/tasks",
    icon: CheckSquare,
    shortcut: "T",
  },
  {
    id: "chat",
    name: "Chat",
    description: "Conversations IA",
    href: "/chat",
    icon: MessageCircle,
    shortcut: "C",
  },
  {
    id: "docs",
    name: "Docs",
    description: "Documents collaboratifs",
    href: "/docs",
    icon: FileText,
    shortcut: "D",
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Agenda et événements",
    href: "/calendar",
    icon: Calendar,
  },
];

const quickActions = [
  {
    id: "new-note",
    name: "Nouvelle note",
    description: "Créer une note rapidement",
    icon: StickyNote,
    keywords: ["note", "créer", "nouveau"],
  },
  {
    id: "new-task",
    name: "Nouvelle tâche",
    description: "Ajouter une tâche",
    icon: CheckSquare,
    keywords: ["tâche", "todo", "créer"],
  },
  {
    id: "ai-chat",
    name: "Discuter avec l'IA",
    description: "Démarrer une conversation",
    icon: Sparkles,
    keywords: ["ia", "ai", "chat", "assistant"],
  },
  {
    id: "settings",
    name: "Paramètres",
    description: "Configuration de l'application",
    icon: Settings,
    keywords: ["config", "préférences", "options"],
  },
];

export function OmniSearch() {
  const router = useRouter();
  const isOpen = useOmniIsOpen();
  const { close, setQuery, addRecentSearch } = useOmniActions();
  const query = useOmniStore((state) => state.query);
  const [isExecuting, setIsExecuting] = React.useState(false);
  const pageContext = usePageContext();

  const executeAIAction = async () => {
    close();
    setIsExecuting(true);
    const loadingToast = toast.loading(`Exécution de : "${query}"...`);
    try {
      const res = await fetch('/api/v1/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: query,
          context_id: pageContext.activeContext
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Succès (${Math.round(data.confidence * 100)}% confiant)`, {
          description: data.result_message,
          id: loadingToast
        });
      } else {
        toast.error('Échec de l\'action', {
          description: data.result_message,
          id: loadingToast
        });
      }
    } catch (e) {
      toast.error('Erreur', { description: 'Impossible de contacter l\'orchestrateur IA', id: loadingToast });
    } finally {
      setIsExecuting(false);
      setQuery("");
    }
  };

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        useOmniStore.getState().toggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = (href: string, searchTerm?: string) => {
    if (searchTerm) {
      addRecentSearch(searchTerm);
    }
    close();
    router.push(href);
  };

  const handleAction = (actionId: string) => {
    close();
    switch (actionId) {
      case "new-note":
        router.push("/keep?action=new");
        break;
      case "new-task":
        router.push("/tasks?action=new");
        break;
      case "ai-chat":
        router.push("/chat");
        break;
      case "settings":
        router.push("/settings");
        break;
    }
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Recherche rapide"
      description="Recherchez des applications, des notes, des tâches..."
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Rechercher une application, note, tâche..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6">
            <Search className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Aucun résultat pour &quot;{query}&quot;
            </p>
          </div>
        </CommandEmpty>

        {query.length > 3 && (
          <>
            <CommandGroup heading="SignApps Autopilot">
              <CommandItem onSelect={executeAIAction} disabled={isExecuting}>
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                Demander à l'IA d'agir : "{query}"
              </CommandItem>
            </CommandGroup>
            
            <CommandGroup heading="Assistant (RAG)">
              <CommandItem onSelect={() => {
                close();
                router.push(`/chat?q=${encodeURIComponent(query)}`);
              }}>
                <Bot className="mr-2 h-4 w-4 text-primary" />
                Interroger l'IA sur : "{query}"
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Applications">
          {apps.map((app) => (
            <CommandItem
              key={app.id}
              value={`${app.name} ${app.description}`}
              onSelect={() => handleSelect(app.href, app.name)}
              className="flex items-center gap-3 py-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <app.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{app.name}</span>
                <span className="text-xs text-muted-foreground">
                  {app.description}
                </span>
              </div>
              {app.shortcut && (
                <CommandShortcut className="ml-auto">
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    <span className="text-xs">⌘</span>
                    {app.shortcut}
                  </kbd>
                </CommandShortcut>
              )}
              <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground/50" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions rapides">
          {quickActions.map((action) => (
            <CommandItem
              key={action.id}
              value={`${action.name} ${action.description} ${action.keywords?.join(" ")}`}
              onSelect={() => handleAction(action.id)}
              className="flex items-center gap-3 py-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <action.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{action.name}</span>
                <span className="text-xs text-muted-foreground">
                  {action.description}
                </span>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            ↵
          </kbd>
          <span>Sélectionner</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            esc
          </kbd>
          <span>Fermer</span>
        </div>
      </div>
    </CommandDialog>
  );
}
