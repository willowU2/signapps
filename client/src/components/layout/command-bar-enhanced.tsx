/**
 * Enhanced Command Bar
 *
 * Command palette avec recherche universelle, récents, et commandes admin.
 * Intègre le système Universal Blocks pour une recherche unifiée.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search,
  FileText,
  User,
  Calendar,
  LayoutDashboard,
  Building2,
  FolderOpen,
  Plus,
  CheckSquare,
  Settings,
  Shield,
  Users,
  Box,
  Star,
  Clock,
  ArrowRight,
  Sparkles,
  Upload,
  History,
  Keyboard,
  X,
  SlidersHorizontal,
  Palette,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useEntityStore } from "@/stores/entity-hub-store";
import { useUIStore } from "@/lib/store";
import { useCommandBarStore } from "@/stores/command-bar-store";
import { usePermissions } from "@/lib/permissions";
import { useBlockSearch, BlockInline, type UniversalBlock, getBlockTypeInfo } from "@/lib/blocks";
import { useUniversalSearch } from "@/hooks/use-universal-search";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// ============================================================================
// Types
// ============================================================================

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  adminOnly?: boolean;
}

interface CommandGroup {
  id: string;
  label: string;
  items: QuickAction[];
}

// ============================================================================
// Component
// ============================================================================

export function CommandBarEnhanced() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [search, setSearch] = React.useState("");
  const [selectedSection, setSelectedSection] = React.useState<string | null>(null);

  // Stores
  const { workspaces, projects, setSelectedWorkspace } = useEntityStore();
  const {
    setCreateWorkspaceModalOpen,
    setCreateProjectModalOpen,
    setCreateTaskModalOpen,
  } = useUIStore();
  const { isOpen, setOpen, recentItems, addToHistory, favorites } =
    useCommandBarStore();
  const { isAdmin, isSuperAdmin } = usePermissions();

  // Keyboard shortcut
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!isOpen);
      }
      if (e.key === "Escape" && isOpen) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, setOpen]);

  // Auto-focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedSection(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Run command and close
  const runCommand = React.useCallback(
    (command: () => void, label?: string) => {
      setOpen(false);
      if (label) addToHistory(label);
      command();
    },
    [setOpen, addToHistory]
  );

  // Universal search - fetch real data
  const { blocks: allBlocks, isLoading: isLoadingBlocks } = useUniversalSearch({
    includeUsers: true,
    includeFiles: true,
    includeTasks: true,
    includeEvents: true,
    limitPerType: 30,
  });

  // Combine with recent items for search
  const searchableBlocks = React.useMemo(() => {
    const recentBlockIds = new Set(recentItems.map((item) => item.block.id));
    const combined = [...recentItems.map((item) => item.block)];
    // Add blocks not in recents
    allBlocks.forEach((block) => {
      if (!recentBlockIds.has(block.id)) {
        combined.push(block);
      }
    });
    return combined;
  }, [allBlocks, recentItems]);

  // Block search with actual data
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    isSearching,
  } = useBlockSearch({
    blocks: searchableBlocks,
    threshold: 0.6,
    limit: 15,
  });

  // Sync search state
  React.useEffect(() => {
    setSearchQuery(search);
  }, [search, setSearchQuery]);

  // Quick actions
  const quickActions: QuickAction[] = React.useMemo(
    () => [
      {
        id: "new-document",
        label: "Nouveau document",
        description: "Créer un document texte",
        icon: FileText,
        shortcut: "D",
        action: () => router.push("/docs/new"),
      },
      {
        id: "new-task",
        label: "Nouvelle tâche",
        description: "Créer une tâche",
        icon: CheckSquare,
        shortcut: "T",
        action: () => setCreateTaskModalOpen(true),
      },
      {
        id: "new-project",
        label: "Nouveau projet",
        description: "Créer un projet",
        icon: FolderOpen,
        shortcut: "P",
        action: () => setCreateProjectModalOpen(true),
      },
      {
        id: "upload",
        label: "Uploader un fichier",
        description: "Importer des fichiers",
        icon: Upload,
        shortcut: "U",
        action: () => router.push("/storage?upload=true"),
      },
    ],
    [router, setCreateTaskModalOpen, setCreateProjectModalOpen]
  );

  // Navigation commands
  const navigationCommands: QuickAction[] = React.useMemo(
    () => [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        action: () => router.push("/dashboard"),
      },
      {
        id: "nav-tasks",
        label: "Tâches",
        icon: CheckSquare,
        action: () => router.push("/tasks"),
      },
      {
        id: "nav-calendar",
        label: "Calendrier",
        icon: Calendar,
        action: () => router.push("/cal"),
      },
      {
        id: "nav-storage",
        label: "Fichiers",
        icon: FolderOpen,
        action: () => router.push("/storage"),
      },
      {
        id: "nav-settings",
        label: "Paramètres",
        icon: Settings,
        action: () => router.push("/settings"),
      },
      {
        id: "nav-preferences",
        label: "Préférences",
        description: "Thème, layout, notifications",
        icon: SlidersHorizontal,
        action: () => router.push("/settings/preferences"),
      },
    ],
    [router]
  );

  // Admin commands
  const adminCommands: QuickAction[] = React.useMemo(
    () =>
      isAdmin()
        ? [
            {
              id: "admin-users",
              label: "Gérer les utilisateurs",
              icon: Users,
              adminOnly: true,
              action: () => router.push("/admin/users"),
            },
            {
              id: "admin-groups",
              label: "Gérer les groupes",
              icon: Users,
              adminOnly: true,
              action: () => router.push("/admin/groups"),
            },
            {
              id: "admin-roles",
              label: "Gérer les rôles",
              icon: Shield,
              adminOnly: true,
              action: () => router.push("/admin/roles"),
            },
            {
              id: "admin-workspaces",
              label: "Gérer les workspaces",
              icon: Building2,
              adminOnly: true,
              action: () => router.push("/admin/workspaces"),
            },
            {
              id: "admin-containers",
              label: "Conteneurs",
              icon: Box,
              adminOnly: true,
              action: () => router.push("/containers"),
            },
            {
              id: "admin-tenant",
              label: "Paramètres Tenant",
              description: "Branding, features, sécurité",
              icon: Palette,
              adminOnly: true,
              action: () => router.push("/admin/tenant"),
            },
          ]
        : [],
    [isAdmin, router]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-card/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Command Bar"
          className="w-full"
          shouldFilter={true}
        >
          {/* Input */}
          <div className="flex items-center border-b border-border/50 px-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <Command.Input
              ref={inputRef}
              value={search}
              onValueChange={setSearch}
              placeholder="Rechercher ou taper une commande..."
              className="flex h-14 w-full bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <kbd className="ml-2 pointer-events-none hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>

          <ScrollArea className="max-h-[400px]">
            <Command.List className="p-2">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                {isSearching || isLoadingBlocks ? "Recherche en cours..." : "Aucun résultat trouvé."}
              </Command.Empty>

              {/* Search Results */}
              {search && searchResults.length > 0 && (
                <Command.Group
                  heading={
                    <span className="flex items-center gap-2">
                      <Search className="h-3.5 w-3.5" />
                      Résultats ({searchResults.length})
                    </span>
                  }
                  className="text-xs font-semibold text-muted-foreground px-2 py-2"
                >
                  {searchResults.map((result) => {
                    const typeInfo = getBlockTypeInfo(result.block.type);
                    return (
                      <Command.Item
                        key={result.block.id}
                        value={`${result.block.title} ${result.block.subtitle || ""}`}
                        onSelect={() =>
                          runCommand(() => {
                            // Track in recents
                            useCommandBarStore.getState().addRecentItem(result.block);
                            // Navigate based on block type
                            const routes: Record<string, string> = {
                              document: `/docs/${result.block.id}`,
                              task: `/tasks?id=${result.block.id}`,
                              file: `/storage?file=${result.block.id}`,
                              folder: `/storage?folder=${result.block.id}`,
                              user: `/admin/users?id=${result.block.id}`,
                              event: `/cal?event=${result.block.id}`,
                              container: `/containers?id=${result.block.id}`,
                            };
                            router.push(
                              routes[result.block.type] || `/view/${result.block.id}`
                            );
                          }, result.block.title)
                        }
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm data-[selected=true]:bg-accent"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: result.block.color || typeInfo.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{result.block.title}</div>
                          {result.block.subtitle && (
                            <div className="text-xs text-muted-foreground truncate">
                              {result.block.subtitle}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {typeInfo.displayName}
                        </Badge>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              {/* Quick Actions */}
              {!search && (
                <Command.Group
                  heading={
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      Actions rapides
                    </span>
                  }
                  className="text-xs font-semibold text-muted-foreground px-2 py-2"
                >
                  {quickActions.map((action) => (
                    <Command.Item
                      key={action.id}
                      value={action.label}
                      onSelect={() => runCommand(action.action, action.label)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm data-[selected=true]:bg-accent"
                    >
                      <action.icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span>{action.label}</span>
                        {action.description && (
                          <span className="ml-2 text-muted-foreground text-xs">
                            {action.description}
                          </span>
                        )}
                      </div>
                      {action.shortcut && (
                        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px]">
                          <span className="text-xs">⌘</span>
                          {action.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Recent Items */}
              {!search && recentItems.length > 0 && (
                <Command.Group
                  heading={
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      Récents
                    </span>
                  }
                  className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2"
                >
                  {recentItems.slice(0, 5).map((item) => (
                    <Command.Item
                      key={item.block.id}
                      value={item.block.title}
                      onSelect={() =>
                        runCommand(() => {
                          // Navigate based on block type
                          const routes: Record<string, string> = {
                            document: `/docs/${item.block.id}`,
                            task: `/tasks?id=${item.block.id}`,
                            file: `/storage?file=${item.block.id}`,
                            user: `/admin/users?id=${item.block.id}`,
                            event: `/cal?event=${item.block.id}`,
                          };
                          router.push(
                            routes[item.block.type] || `/view/${item.block.id}`
                          );
                        })
                      }
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm data-[selected=true]:bg-accent"
                    >
                      <BlockInline block={item.block} showPreview={false} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Favorites */}
              {!search && favorites.length > 0 && (
                <Command.Group
                  heading={
                    <span className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5" />
                      Favoris
                    </span>
                  }
                  className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2"
                >
                  {favorites.slice(0, 5).map((block) => (
                    <Command.Item
                      key={block.id}
                      value={block.title}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm data-[selected=true]:bg-accent"
                    >
                      <BlockInline block={block} showPreview={false} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Navigation */}
              <Command.Group
                heading={
                  <span className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Navigation
                  </span>
                }
                className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2"
              >
                {navigationCommands.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.label}
                    onSelect={() => runCommand(cmd.action, cmd.label)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm data-[selected=true]:bg-accent"
                  >
                    <cmd.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{cmd.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>

              {/* Workspaces */}
              {workspaces.length > 0 && (
                <Command.Group
                  heading={
                    <span className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      Workspaces
                    </span>
                  }
                  className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2"
                >
                  {workspaces.map((w) => (
                    <Command.Item
                      key={`ws-${w.id}`}
                      value={`workspace ${w.name}`}
                      onSelect={() =>
                        runCommand(() => {
                          setSelectedWorkspace(w.id);
                          router.push("/dashboard");
                        }, `Switch to ${w.name}`)
                      }
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm data-[selected=true]:bg-accent"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Basculer vers {w.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Admin Commands */}
              {adminCommands.length > 0 && (
                <Command.Group
                  heading={
                    <span className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" />
                      Administration
                      <Badge variant="secondary" className="text-[10px] h-4">
                        Admin
                      </Badge>
                    </span>
                  }
                  className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2"
                >
                  {adminCommands.map((cmd) => (
                    <Command.Item
                      key={cmd.id}
                      value={cmd.label}
                      onSelect={() => runCommand(cmd.action, cmd.label)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm data-[selected=true]:bg-accent"
                    >
                      <cmd.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{cmd.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </ScrollArea>

          {/* Footer with keyboard hints */}
          <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
                  ↑↓
                </kbd>
                naviguer
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
                  ↵
                </kbd>
                sélectionner
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
                  esc
                </kbd>
                fermer
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Keyboard className="h-3.5 w-3.5" />
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
                ⌘K
              </kbd>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
