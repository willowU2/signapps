"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  Menu,
  Settings,
  Grid,
  List,
  RefreshCw,
  Lightbulb,
  Bell,
  Pencil,
  Archive,
  Trash2,
  Image,
  Palette,
  MoreVertical,
  Pin,
  CheckSquare,
  Check,
  X,
  Plus,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/store";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import {
  useKeepStore,
  useKeepUIState,
  useKeepUIActions,
  useKeepNoteActions,
  useKeepLabels,
  selectPinnedNotes,
  selectUnpinnedNotes,
  NOTE_COLORS,
  type KeepNote,
  type ChecklistItem,
} from "@/lib/store/keep-store";

const sidebarItems = [
  { id: "notes" as const, icon: Lightbulb, label: "Notes" },
  { id: "reminders" as const, icon: Bell, label: "Rappels" },
  { id: "archive" as const, icon: Archive, label: "Archives" },
  { id: "trash" as const, icon: Trash2, label: "Corbeille" },
];

export default function KeepPage() {
  // Optimized selectors to prevent unnecessary re-renders
  const { searchQuery, isGridView, activeSidebarView, sidebarExpanded } = useKeepUIState();
  const { setSearchQuery, setGridView, setActiveSidebarView, setSidebarExpanded } = useKeepUIActions();
  const {
    addNote,
    togglePin,
    archiveNote,
    trashNote,
    restoreNote,
    permanentlyDeleteNote,
    emptyTrash,
    setNoteColor,
    toggleChecklistItem,
  } = useKeepNoteActions();
  const labels = useKeepLabels();

  const { sidebarCollapsed, rightSidebarOpen } = useUIStore();

  const pinnedNotes = useKeepStore(selectPinnedNotes);
  const unpinnedNotes = useKeepStore(selectUnpinnedNotes);

  // New note creation form state
  const [newNoteExpanded, setNewNoteExpanded] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteIsChecklist, setNewNoteIsChecklist] = useState(false);
  const [newChecklistItems, setNewChecklistItems] = useState<ChecklistItem[]>([]);
  const [newNoteColor, setNewNoteColor] = useState("#202124");
  const [newNotePinned, setNewNotePinned] = useState(false);

  const newNoteRef = useRef<HTMLDivElement>(null);

  // Create note and reset form - defined before useEffect to avoid dependency issues
  const handleCreateNote = useCallback(() => {
    const hasContent =
      newNoteTitle.trim() ||
      newNoteContent.trim() ||
      newChecklistItems.some((item) => item.text.trim());

    if (hasContent) {
      addNote({
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        color: newNoteColor,
        isPinned: newNotePinned,
        hasChecklist: newNoteIsChecklist && newChecklistItems.length > 0,
        checklistItems: newNoteIsChecklist
          ? newChecklistItems.filter((item) => item.text.trim())
          : [],
      });
    }

    // Reset form to initial state
    setNewNoteTitle("");
    setNewNoteContent("");
    setNewNoteIsChecklist(false);
    setNewChecklistItems([]);
    setNewNoteColor("#202124");
    setNewNotePinned(false);
    setNewNoteExpanded(false);
  }, [newNoteTitle, newNoteContent, newChecklistItems, newNoteIsChecklist, newNoteColor, newNotePinned, addNote]);

  // Close new note on outside click and save if has content
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        newNoteRef.current &&
        !newNoteRef.current.contains(event.target as Node)
      ) {
        handleCreateNote();
      }
    };

    if (newNoteExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [newNoteExpanded, handleCreateNote]);

  const addNewChecklistItem = () => {
    setNewChecklistItems([
      ...newChecklistItems,
      { id: crypto.randomUUID(), text: "", checked: false },
    ]);
  };

  const updateNewChecklistItem = (id: string, text: string) => {
    setNewChecklistItems(
      newChecklistItems.map((item) =>
        item.id === id ? { ...item, text } : item
      )
    );
  };

  const removeNewChecklistItem = (id: string) => {
    setNewChecklistItems(newChecklistItems.filter((item) => item.id !== id));
  };

  const toggleNewChecklistMode = () => {
    if (!newNoteIsChecklist) {
      setNewNoteIsChecklist(true);
      if (newChecklistItems.length === 0) {
        addNewChecklistItem();
      }
    }
  };

  const showTrashActions = activeSidebarView === "trash";
  const showArchiveActions = activeSidebarView === "archive";
  const hasNotes = pinnedNotes.length > 0 || unpinnedNotes.length > 0;

  return (
    <TooltipProvider delayDuration={0}>
      <WorkspaceShell
        className="bg-[#202124] text-[#e8eaed] font-['Google_Sans',_Roboto,_sans-serif]"
        header={
          <header className="h-16 shrink-0 flex items-center px-2 border-b border-[#5f6368]/30">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full text-[#9aa0a6] hover:bg-[#3c4043] mr-1"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          {/* Logo */}
          <div className="flex items-center gap-2 px-2">
            <div className="w-10 h-10 flex items-center justify-center">
              <Lightbulb className="h-7 w-7 text-[#fbbc04]" />
            </div>
            <span className="text-[22px] font-normal text-[#e8eaed]">Keep</span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-[720px] mx-4 relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Search className="h-5 w-5 text-[#9aa0a6]" />
            </div>
            <Input
              placeholder="Rechercher"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 h-12 bg-[#525355] border-transparent text-[#e8eaed] placeholder:text-[#9aa0a6] rounded-lg focus-visible:bg-[#3c4043] focus-visible:ring-0 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#e8eaed]"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                >
                  <RefreshCw className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Actualiser
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={() => setGridView(!isGridView)}
                >
                  {isGridView ? (
                    <List className="h-5 w-5" />
                  ) : (
                    <Grid className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                {isGridView ? "Affichage liste" : "Affichage grille"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Param\u00e8tres
              </TooltipContent>
            </Tooltip>

            <div className="mx-3">
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" />
                <AvatarFallback className="bg-[#1a73e8] text-white">
                  AD
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>
        }
        sidebar={
          <nav
            className={cn(
              "shrink-0 flex flex-col py-2 transition-all duration-200",
              sidebarExpanded ? "w-[280px]" : "w-[80px]"
            )}
          >
            {sidebarItems.map((item) => (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveSidebarView(item.id)}
                    className={cn(
                      "flex items-center gap-5 h-12 px-3 mx-2 rounded-full transition-colors",
                      activeSidebarView === item.id
                        ? "bg-[#41331c] text-[#fbbc04]"
                        : "text-[#9aa0a6] hover:bg-[#3c4043]"
                    )}
                  >
                    <div className="w-6 h-6 flex items-center justify-center ml-2">
                      <item.icon className="h-5 w-5" />
                    </div>
                    {sidebarExpanded && (
                      <span className="text-sm font-medium whitespace-nowrap">
                        {item.label}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                {!sidebarExpanded && (
                  <TooltipContent
                    side="right"
                    className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]"
                  >
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}

            {/* Labels section */}
            {sidebarExpanded && labels.length > 0 && (
              <>
                <div className="h-px bg-[#5f6368]/30 mx-4 my-2" />
                <div className="px-4 py-2">
                  <span className="text-xs font-medium text-[#9aa0a6] uppercase tracking-wider">
                    Libell\u00e9s
                  </span>
                </div>
                {labels.slice(0, 5).map((label) => (
                  <button
                    key={label.id}
                    className="flex items-center gap-5 h-10 px-3 mx-2 rounded-full text-[#9aa0a6] hover:bg-[#3c4043] transition-colors"
                  >
                    <div className="w-6 h-6 flex items-center justify-center ml-2">
                      <Tag className="h-4 w-4" />
                    </div>
                    <span className="text-sm truncate">{label.name}</span>
                  </button>
                ))}
                <button className="flex items-center gap-5 h-10 px-3 mx-2 rounded-full text-[#9aa0a6] hover:bg-[#3c4043] transition-colors">
                  <div className="w-6 h-6 flex items-center justify-center ml-2">
                    <Pencil className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Modifier les libell\u00e9s</span>
                </button>
              </>
            )}
          </nav>
        }
      >
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto px-4 py-6">
            {/* Create Note Input - Only show in notes view */}
            {activeSidebarView === "notes" && (
              <div className="max-w-[600px] mx-auto mb-8" ref={newNoteRef}>
                {!newNoteExpanded ? (
                  <button
                    onClick={() => setNewNoteExpanded(true)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 bg-[#202124] border border-[#5f6368]/50 rounded-lg shadow-[0_1px_2px_0_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)] hover:shadow-[0_1px_3px_0_rgba(0,0,0,0.3),0_4px_8px_3px_rgba(0,0,0,0.15)] transition-shadow text-left"
                  >
                    <span className="text-[#9aa0a6] text-[15px]">
                      Cr\u00e9er une note...
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                      <CheckSquare className="h-5 w-5 text-[#9aa0a6]" />
                      <Image className="h-5 w-5 text-[#9aa0a6]" />
                    </div>
                  </button>
                ) : (
                  <div
                    className="relative border border-[#5f6368]/50 rounded-lg shadow-[0_1px_2px_0_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)] overflow-hidden transition-colors"
                    style={{ backgroundColor: newNoteColor }}
                  >
                    {/* Pin button in expanded form */}
                    <button
                      type="button"
                      onClick={() => setNewNotePinned(!newNotePinned)}
                      className={cn(
                        "absolute top-2 right-2 p-2 rounded-full transition-all z-10",
                        newNotePinned
                          ? "text-[#e8eaed] bg-[#3c4043]/50"
                          : "text-[#9aa0a6] hover:bg-[#3c4043]/50"
                      )}
                      title={newNotePinned ? "Désépingler" : "Épingler"}
                    >
                      <Pin className={cn("h-[18px] w-[18px]", newNotePinned && "fill-current")} />
                    </button>

                    <Input
                      placeholder="Titre"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      className="border-0 bg-transparent text-[#e8eaed] placeholder:text-[#9aa0a6] text-base font-medium px-4 py-3 pr-12 h-auto focus-visible:ring-0"
                    />

                    {newNoteIsChecklist ? (
                      <div className="px-4 py-2 space-y-1">
                        {newChecklistItems.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 group"
                          >
                            <div className="w-5 h-5 rounded-sm border border-[#5f6368] flex items-center justify-center shrink-0">
                              {item.checked && (
                                <Check className="h-3.5 w-3.5 text-[#9aa0a6]" />
                              )}
                            </div>
                            <input
                              type="text"
                              value={item.text}
                              onChange={(e) =>
                                updateNewChecklistItem(item.id, e.target.value)
                              }
                              placeholder="\u00c9l\u00e9ment de liste"
                              className="flex-1 bg-transparent text-[#e8eaed] placeholder:text-[#5f6368] text-sm py-1 focus:outline-none"
                              autoFocus={index === newChecklistItems.length - 1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addNewChecklistItem();
                                }
                              }}
                            />
                            <button
                              onClick={() => removeNewChecklistItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#e8eaed] transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={addNewChecklistItem}
                          className="flex items-center gap-2 text-[#9aa0a6] hover:text-[#e8eaed] py-1"
                        >
                          <Plus className="h-4 w-4" />
                          <span className="text-sm">\u00c9l\u00e9ment de liste</span>
                        </button>
                      </div>
                    ) : (
                      <textarea
                        placeholder="Cr\u00e9er une note..."
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        className="w-full bg-transparent text-[#e8eaed] placeholder:text-[#9aa0a6] text-[14px] px-4 py-2 min-h-[60px] resize-none focus:outline-none"
                        autoFocus
                      />
                    )}

                    <div className="flex items-center justify-between px-2 py-2">
                      <div className="flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8 rounded-full hover:bg-[#3c4043]",
                                newNoteIsChecklist
                                  ? "text-[#fbbc04]"
                                  : "text-[#9aa0a6]"
                              )}
                              onClick={toggleNewChecklistMode}
                            >
                              <CheckSquare className="h-[18px] w-[18px]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                            Nouvelle liste
                          </TooltipContent>
                        </Tooltip>
                        {/* Color picker for new note */}
                        <Popover>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                                >
                                  <Palette className="h-[18px] w-[18px]" />
                                </Button>
                              </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                              Couleur d'arrière-plan
                            </TooltipContent>
                          </Tooltip>
                          <PopoverContent className="w-auto p-2 bg-[#3c4043] border-[#5f6368]">
                            <div className="grid grid-cols-4 gap-1">
                              {NOTE_COLORS.map((color) => (
                                <button
                                  key={color.id}
                                  type="button"
                                  onClick={() => setNewNoteColor(color.value)}
                                  className={cn(
                                    "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                                    newNoteColor === color.value
                                      ? "border-[#a142f4]"
                                      : "border-transparent hover:border-[#5f6368]"
                                  )}
                                  style={{ backgroundColor: color.value }}
                                  title={color.name}
                                />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                            >
                              <Image className="h-[18px] w-[18px]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                            Ajouter une image
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCreateNote}
                        className="text-[#e8eaed] hover:bg-[#3c4043] rounded-md px-6 font-medium"
                      >
                        Fermer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Trash actions */}
            {showTrashActions && (
              <div className="max-w-[600px] mx-auto mb-6 flex items-center justify-center">
                <p className="text-sm text-[#9aa0a6]">
                  Les notes de la corbeille sont supprim\u00e9es au bout de 7 jours.
                </p>
                {(pinnedNotes.length > 0 || unpinnedNotes.length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={emptyTrash}
                    className="ml-4 text-[#e8eaed] hover:bg-[#3c4043]"
                  >
                    Vider la corbeille
                  </Button>
                )}
              </div>
            )}

            {/* Pinned Notes Section */}
            {pinnedNotes.length > 0 && (
              <div className="mb-8">
                <div className="text-[11px] font-medium text-[#9aa0a6] uppercase tracking-wider px-2 mb-3">
                  Épinglées
                </div>
                <div
                  className={cn(
                    isGridView
                      ? "columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4"
                      : "flex flex-col gap-3 max-w-[600px] mx-auto"
                  )}
                >
                  {pinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isGridView={isGridView}
                      onTogglePin={() => togglePin(note.id)}
                      onArchive={() => archiveNote(note.id)}
                      onTrash={() => trashNote(note.id)}
                      onRestore={() => restoreNote(note.id)}
                      onDelete={() => permanentlyDeleteNote(note.id)}
                      onColorChange={(color) => setNoteColor(note.id, color)}
                      onToggleChecklistItem={(itemId) =>
                        toggleChecklistItem(note.id, itemId)
                      }
                      showTrashActions={showTrashActions}
                      showArchiveActions={showArchiveActions}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other Notes Section */}
            {unpinnedNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <div className="text-[11px] font-medium text-[#9aa0a6] uppercase tracking-wider px-2 mb-3">
                    Autres
                  </div>
                )}
                <div
                  className={cn(
                    isGridView
                      ? "columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4"
                      : "flex flex-col gap-3 max-w-[600px] mx-auto"
                  )}
                >
                  {unpinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isGridView={isGridView}
                      onTogglePin={() => togglePin(note.id)}
                      onArchive={() => archiveNote(note.id)}
                      onTrash={() => trashNote(note.id)}
                      onRestore={() => restoreNote(note.id)}
                      onDelete={() => permanentlyDeleteNote(note.id)}
                      onColorChange={(color) => setNoteColor(note.id, color)}
                      onToggleChecklistItem={(itemId) =>
                        toggleChecklistItem(note.id, itemId)
                      }
                      showTrashActions={showTrashActions}
                      showArchiveActions={showArchiveActions}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!hasNotes && (
              <div className="flex flex-col items-center justify-center py-20">
                {activeSidebarView === "notes" && (
                  <>
                    <Lightbulb className="h-28 w-28 text-[#5f6368] mb-4 opacity-50" />
                    <p className="text-[22px] text-[#9aa0a6]">
                      Les notes que vous ajoutez apparaissent ici
                    </p>
                  </>
                )}
                {activeSidebarView === "archive" && (
                  <>
                    <Archive className="h-28 w-28 text-[#5f6368] mb-4 opacity-50" />
                    <p className="text-[22px] text-[#9aa0a6]">
                      Vos notes archiv\u00e9es apparaissent ici
                    </p>
                  </>
                )}
                {activeSidebarView === "trash" && (
                  <>
                    <Trash2 className="h-28 w-28 text-[#5f6368] mb-4 opacity-50" />
                    <p className="text-[22px] text-[#9aa0a6]">
                      Aucune note dans la corbeille
                    </p>
                  </>
                )}
                {activeSidebarView === "reminders" && (
                  <>
                    <Bell className="h-28 w-28 text-[#5f6368] mb-4 opacity-50" />
                    <p className="text-[22px] text-[#9aa0a6]">
                      Les notes avec rappel apparaissent ici
                    </p>
                  </>
                )}
              </div>
            )}
          </main>
      </WorkspaceShell>
    </TooltipProvider>
  );
}

interface NoteCardProps {
  note: KeepNote;
  isGridView: boolean;
  onTogglePin: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
  onToggleChecklistItem: (itemId: string) => void;
  showTrashActions: boolean;
  showArchiveActions: boolean;
}

function NoteCard({
  note,
  isGridView,
  onTogglePin,
  onArchive,
  onTrash,
  onRestore,
  onDelete,
  onColorChange,
  onToggleChecklistItem,
  showTrashActions,
  showArchiveActions,
}: NoteCardProps) {
  const uncheckedItems = note.checklistItems.filter((item) => !item.checked);
  const checkedItems = note.checklistItems.filter((item) => item.checked);

  // Use note color or default dark gray
  const backgroundColor = note.color || "#202124";

  return (
    <div
      className={cn(
        "group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200",
        // Masonry layout: break-inside-avoid prevents card splitting across columns
        isGridView && "break-inside-avoid mb-4",
        // List layout: simple margin
        !isGridView && "mb-3",
        // Subtle thin border for dark mode aesthetic
        "border border-[#5f6368]",
        // Hover effects
        "hover:border-[#8a8f94] hover:shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
      )}
      style={{ backgroundColor }}
    >
      {/* Pin Button */}
      {!showTrashActions && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={cn(
            "absolute top-2 right-2 p-2 rounded-full transition-all z-10",
            note.isPinned
              ? "opacity-100 text-[#e8eaed]"
              : "opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:bg-[#3c4043]/50"
          )}
        >
          <Pin
            className={cn("h-[18px] w-[18px]", note.isPinned && "fill-current")}
          />
        </button>
      )}

      {/* Content */}
      <div className="p-3 pr-10">
        {note.title && (
          <h3 className="text-[15px] font-medium text-[#e8eaed] mb-2 leading-tight">
            {note.title}
          </h3>
        )}

        {note.hasChecklist && note.checklistItems.length > 0 ? (
          <div className="space-y-0.5">
            {/* Unchecked items - normal text */}
            {uncheckedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 py-0.5 group/item"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleChecklistItem(item.id);
                  }}
                  className="w-[18px] h-[18px] rounded-sm border border-[#5f6368] flex items-center justify-center shrink-0 mt-0.5 hover:border-[#9aa0a6] transition-colors"
                  aria-label={`Marquer "${item.text}" comme terminé`}
                />
                <span className="text-[13px] text-[#e8eaed] leading-5">
                  {item.text}
                </span>
              </div>
            ))}
            {/* Separator between unchecked and checked */}
            {checkedItems.length > 0 && uncheckedItems.length > 0 && (
              <div className="h-px bg-[#5f6368]/40 my-2" />
            )}
            {/* Checked items - strikethrough with muted color */}
            {checkedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 py-0.5 group/item"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleChecklistItem(item.id);
                  }}
                  className="w-[18px] h-[18px] rounded-sm border border-[#5f6368] bg-transparent flex items-center justify-center shrink-0 mt-0.5 hover:border-[#9aa0a6] transition-colors"
                  aria-label={`Marquer "${item.text}" comme non terminé`}
                >
                  <Check className="h-3 w-3 text-[#9aa0a6]" />
                </button>
                <span className="text-[13px] text-[#9aa0a6] line-through decoration-[#9aa0a6]/60 leading-5">
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          note.content && (
            <p className="text-[13px] text-[#e8eaed] whitespace-pre-wrap leading-5">
              {note.content}
            </p>
          )
        )}

        {/* Labels */}
        {note.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {note.labels.map((label) => (
              <span
                key={label}
                className="px-2 py-0.5 bg-[#3c4043]/70 text-[11px] text-[#e8eaed] rounded-full font-medium border border-[#5f6368]/30"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {showTrashActions ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Supprimer d\u00e9finitivement
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore();
                  }}
                >
                  <RefreshCw className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Restaurer
              </TooltipContent>
            </Tooltip>
          </>
        ) : showArchiveActions ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrash();
                  }}
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Supprimer
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore();
                  }}
                >
                  <RefreshCw className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                D\u00e9sarchiver
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                >
                  <Bell className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Me rappeler
              </TooltipContent>
            </Tooltip>

            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Palette className="h-[18px] w-[18px]" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                  Couleur d'arri\u00e8re-plan
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                className="w-auto p-2 bg-[#3c4043] border-[#5f6368]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-4 gap-1">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => onColorChange(color.value)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                        note.color === color.value
                          ? "border-[#a142f4]"
                          : "border-transparent hover:border-[#5f6368]"
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                >
                  <Image className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Ajouter une image
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive();
                  }}
                >
                  <Archive className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Archiver
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrash();
                  }}
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Supprimer
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                >
                  <MoreVertical className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Plus
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
