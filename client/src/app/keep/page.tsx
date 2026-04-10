"use client";

import { SpinnerInfinity } from "spinners-react";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
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
  Share2,
  ScanText,
  Presentation,
} from "lucide-react";
import { NoteToDoc, NoteToTask } from "@/components/interop/keep-convert";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ShareNote } from "@/components/keep/share-note";
import {
  NoteReminder,
  type NoteReminder as NoteReminderType,
} from "@/components/keep/note-reminder";
import { OcrImage } from "@/components/keep/ocr-image";
import { NotePresentation } from "@/components/keep/note-presentation";
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
  useKeepData,
  useCreateNote,
  useUpdateNote,
  useTogglePin,
  useToggleArchive,
  useMoveToTrash,
  useRestoreFromTrash,
  useDeleteNote,
  useEmptyTrash,
  useChangeColor,
  useToggleChecklistItem,
  selectNotesByView,
  selectPinnedNotes,
  selectUnpinnedNotes,
} from "@/hooks/use-keep";
import type {
  KeepNote,
  ChecklistItem as ChecklistItemType,
} from "@/lib/api/keep";

// Google Keep dark mode colors
const NOTE_COLORS = [
  { id: "default", value: "#202124", name: "Par défaut" },
  { id: "coral", value: "#77172e", name: "Corail" },
  { id: "peach", value: "#692b17", name: "Pêche" },
  { id: "sand", value: "#7c4a03", name: "Sable" },
  { id: "mint", value: "#264d3b", name: "Menthe" },
  { id: "sage", value: "#0d625d", name: "Sauge" },
  { id: "fog", value: "#256377", name: "Brume" },
  { id: "storm", value: "#284255", name: "Orage" },
  { id: "dusk", value: "#472e5b", name: "Crépuscule" },
  { id: "blossom", value: "#6c394f", name: "Fleur" },
  { id: "clay", value: "#4b443a", name: "Argile" },
  { id: "chalk", value: "#232427", name: "Craie" },
] as const;

type SidebarView = "notes" | "reminders" | "archive" | "trash";

const sidebarItems = [
  { id: "notes" as const, icon: Lightbulb, label: "Notes" },
  { id: "reminders" as const, icon: Bell, label: "Rappels" },
  { id: "archive" as const, icon: Archive, label: "Archives" },
  { id: "trash" as const, icon: Trash2, label: "Corbeille" },
];

export default function KeepPage() {
  usePageTitle("Notes");
  // React Query hooks
  const { data: keepData, isLoading, error, refetch } = useKeepData();
  const createNoteMutation = useCreateNote();
  const togglePinMutation = useTogglePin();
  const toggleArchiveMutation = useToggleArchive();
  const moveToTrashMutation = useMoveToTrash();
  const restoreFromTrashMutation = useRestoreFromTrash();
  const deleteNoteMutation = useDeleteNote();
  const emptyTrashMutation = useEmptyTrash();
  const changeColorMutation = useChangeColor();
  const toggleChecklistItemMutation = useToggleChecklistItem();

  // UI State (local)
  const [searchQuery, setSearchQuery] = useState("");
  const [isGridView, setIsGridView] = useState(true);
  const [activeSidebarView, setActiveSidebarView] =
    useState<SidebarView>("notes");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(
    null,
  );

  // Note editing state
  const updateNoteMutation = useUpdateNote();
  const [editingNote, setEditingNote] = useState<KeepNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleOpenEdit = useCallback(
    (note: KeepNote) => {
      if (activeSidebarView === "trash") return; // no edit in trash
      setEditingNote(note);
      setEditTitle(note.title);
      setEditContent(note.content);
    },
    [activeSidebarView],
  );

  const handleSaveEdit = useCallback(() => {
    if (!editingNote) return;
    const title = editTitle.trim();
    const content = editContent.trim();
    if (title !== editingNote.title || content !== editingNote.content) {
      updateNoteMutation.mutate({
        id: editingNote.id,
        updates: { title, content },
      });
    }
    setEditingNote(null);
  }, [editingNote, editTitle, editContent, updateNoteMutation]);

  // New feature states
  const [shareNoteId, setShareNoteId] = useState<string | null>(null);
  const [reminderNoteId, setReminderNoteId] = useState<string | null>(null);
  const [ocrNoteId, setOcrNoteId] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [reminders, setReminders] = useState<NoteReminderType[]>([]);

  const shareNote = shareNoteId
    ? keepData?.notes.find((n) => n.id === shareNoteId)
    : null;
  const reminderNote = reminderNoteId
    ? keepData?.notes.find((n) => n.id === reminderNoteId)
    : null;

  const { sidebarCollapsed, rightSidebarOpen } = useUIStore();

  // Memoized filtered notes (with label filter)
  const filteredNotes = useMemo(
    () =>
      selectNotesByView(
        keepData,
        activeSidebarView,
        searchQuery,
        selectedLabelFilter,
      ),
    [keepData, activeSidebarView, searchQuery, selectedLabelFilter],
  );

  const pinnedNotes = useMemo(
    () => selectPinnedNotes(filteredNotes),
    [filteredNotes],
  );
  const unpinnedNotes = useMemo(
    () => selectUnpinnedNotes(filteredNotes),
    [filteredNotes],
  );
  const labels = useMemo(() => keepData?.labels || [], [keepData?.labels]);

  // New note creation form state
  const [newNoteExpanded, setNewNoteExpanded] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteIsChecklist, setNewNoteIsChecklist] = useState(false);
  const [newChecklistItems, setNewChecklistItems] = useState<
    ChecklistItemType[]
  >([]);
  const [newNoteColor, setNewNoteColor] = useState("#202124");
  const [newNotePinned, setNewNotePinned] = useState(false);

  const newNoteRef = useRef<HTMLDivElement>(null);

  // Create note and reset form
  const handleCreateNote = useCallback(() => {
    const hasContent =
      newNoteTitle.trim() ||
      newNoteContent.trim() ||
      newChecklistItems.some((item) => item.text.trim());

    if (hasContent) {
      createNoteMutation.mutate({
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        color: newNoteColor,
        isPinned: newNotePinned,
        isArchived: false,
        isTrashed: false,
        hasChecklist: newNoteIsChecklist && newChecklistItems.length > 0,
        checklistItems: newNoteIsChecklist
          ? newChecklistItems.filter((item) => item.text.trim())
          : [],
        labels: [],
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
  }, [
    newNoteTitle,
    newNoteContent,
    newChecklistItems,
    newNoteIsChecklist,
    newNoteColor,
    newNotePinned,
    createNoteMutation,
  ]);

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
        item.id === id ? { ...item, text } : item,
      ),
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

  // Action handlers using mutations
  const handleTogglePin = useCallback(
    (note: KeepNote) => {
      togglePinMutation.mutate(note);
    },
    [togglePinMutation],
  );

  const handleToggleArchive = useCallback(
    (note: KeepNote) => {
      toggleArchiveMutation.mutate(note);
    },
    [toggleArchiveMutation],
  );

  const handleMoveToTrash = useCallback(
    (note: KeepNote) => {
      moveToTrashMutation.mutate(note);
    },
    [moveToTrashMutation],
  );

  const handleRestoreFromTrash = useCallback(
    (note: KeepNote) => {
      restoreFromTrashMutation.mutate(note);
    },
    [restoreFromTrashMutation],
  );

  const handlePermanentlyDelete = useCallback(
    (noteId: string) => {
      deleteNoteMutation.mutate(noteId);
    },
    [deleteNoteMutation],
  );

  const handleEmptyTrash = useCallback(() => {
    const trashedNoteIds =
      keepData?.notes.filter((n) => n.isTrashed).map((n) => n.id) || [];
    if (trashedNoteIds.length > 0) {
      emptyTrashMutation.mutate(trashedNoteIds);
    }
  }, [keepData, emptyTrashMutation]);

  const handleChangeColor = useCallback(
    (noteId: string, color: string) => {
      changeColorMutation.mutate({ noteId, color });
    },
    [changeColorMutation],
  );

  const handleToggleChecklistItem = useCallback(
    (note: KeepNote, itemId: string) => {
      toggleChecklistItemMutation.mutate({ note, itemId });
    },
    [toggleChecklistItemMutation],
  );

  // Handle label click from note card chips
  const handleLabelClick = useCallback(
    (labelName: string) => {
      const label = labels.find((l) => l.name === labelName);
      if (label) {
        setActiveSidebarView("notes");
        setSelectedLabelFilter(
          selectedLabelFilter === label.id ? null : label.id,
        );
      }
    },
    [labels, selectedLabelFilter],
  );

  const showTrashActions = activeSidebarView === "trash";
  const showArchiveActions = activeSidebarView === "archive";
  const hasNotes = pinnedNotes.length > 0 || unpinnedNotes.length > 0;

  // Loading state
  if (isLoading) {
    return (
      <TooltipProvider delayDuration={0}>
        <WorkspaceShell
          className="bg-[#202124] text-[#e8eaed] font-['Google_Sans',_Roboto,_sans-serif]"
          header={<div className="h-16" />}
          sidebar={<div className="w-[80px]" />}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="h-12 w-12 text-[#fbbc04]  mb-4"
            />
            <p className="text-[#9aa0a6]">Chargement des notes...</p>
          </div>
        </WorkspaceShell>
      </TooltipProvider>
    );
  }

  // Error state
  if (error) {
    return (
      <TooltipProvider delayDuration={0}>
        <WorkspaceShell
          className="bg-[#202124] text-[#e8eaed] font-['Google_Sans',_Roboto,_sans-serif]"
          header={<div className="h-16" />}
          sidebar={<div className="w-[80px]" />}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-[#ea4335] mb-4">
              Erreur lors du chargement des notes
            </p>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="border-[#5f6368] text-[#e8eaed] hover:bg-[#3c4043]"
            >
              Réessayer
            </Button>
          </div>
        </WorkspaceShell>
      </TooltipProvider>
    );
  }

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
              <span className="text-[22px] font-normal text-[#e8eaed]">
                Keep
              </span>
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
                    onClick={() => refetch()}
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
                    onClick={() => setIsGridView(!isGridView)}
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
                    onClick={() => setPresentationMode(true)}
                  >
                    <Presentation className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                  Mode présentation
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
                  Paramètres
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
              sidebarExpanded ? "w-[280px]" : "w-[80px]",
            )}
          >
            {sidebarItems.map((item) => (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setActiveSidebarView(item.id);
                      setSelectedLabelFilter(null);
                    }}
                    className={cn(
                      "flex items-center gap-5 h-12 px-3 mx-2 rounded-full transition-colors",
                      activeSidebarView === item.id
                        ? "bg-[#41331c] text-[#fbbc04]"
                        : "text-[#9aa0a6] hover:bg-[#3c4043]",
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
                    Libellés
                  </span>
                </div>
                {labels.slice(0, 5).map((label) => {
                  const noteCount =
                    keepData?.notes.filter(
                      (n) =>
                        !n.isArchived &&
                        !n.isTrashed &&
                        n.labels.includes(label.name),
                    ).length ?? 0;
                  return (
                    <button
                      key={label.id}
                      onClick={() => {
                        setActiveSidebarView("notes");
                        setSelectedLabelFilter(
                          selectedLabelFilter === label.id ? null : label.id,
                        );
                      }}
                      className={cn(
                        "flex items-center gap-5 h-10 px-3 mx-2 rounded-full transition-colors",
                        selectedLabelFilter === label.id
                          ? "bg-[#41331c] text-[#fbbc04]"
                          : "text-[#9aa0a6] hover:bg-[#3c4043]",
                      )}
                    >
                      <div className="w-6 h-6 flex items-center justify-center ml-2">
                        <Tag className="h-4 w-4" />
                      </div>
                      <span className="text-sm truncate flex-1 text-left">
                        {label.name}
                      </span>
                      <span className="text-xs text-[#9aa0a6]">
                        {noteCount}
                      </span>
                    </button>
                  );
                })}
                <button className="flex items-center gap-5 h-10 px-3 mx-2 rounded-full text-[#9aa0a6] hover:bg-[#3c4043] transition-colors">
                  <div className="w-6 h-6 flex items-center justify-center ml-2">
                    <Pencil className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Modifier les libellés</span>
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
                    Créer une note...
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
                        : "text-[#9aa0a6] hover:bg-[#3c4043]/50",
                    )}
                    title={newNotePinned ? "Désépingler" : "Épingler"}
                  >
                    <Pin
                      className={cn(
                        "h-[18px] w-[18px]",
                        newNotePinned && "fill-current",
                      )}
                    />
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
                            placeholder="Élément de liste"
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
                        <span className="text-sm">Élément de liste</span>
                      </button>
                    </div>
                  ) : (
                    <textarea
                      placeholder="Créer une note..."
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
                                : "text-[#9aa0a6]",
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
                                    : "border-transparent hover:border-[#5f6368]",
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
                      disabled={createNoteMutation.isPending}
                      className="text-[#e8eaed] hover:bg-[#3c4043] rounded-md px-6 font-medium"
                    >
                      {createNoteMutation.isPending ? (
                        <SpinnerInfinity
                          size={24}
                          secondaryColor="rgba(128,128,128,0.2)"
                          color="currentColor"
                          speed={120}
                          className="h-4 w-4 "
                        />
                      ) : (
                        "Fermer"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active label filter indicator */}
          {selectedLabelFilter && (
            <div className="max-w-[600px] mx-auto mb-4 flex items-center gap-2 px-3 py-2 bg-[#41331c]/40 rounded-lg border border-[#5f6368]/30">
              <Tag className="h-4 w-4 text-[#fbbc04]" />
              <span className="text-sm text-[#e8eaed]">
                Filtrage par :{" "}
                <strong>
                  {labels.find((l) => l.id === selectedLabelFilter)?.name}
                </strong>
              </span>
              <button
                onClick={() => setSelectedLabelFilter(null)}
                className="ml-auto text-[#9aa0a6] hover:text-[#e8eaed] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Trash actions */}
          {showTrashActions && (
            <div className="max-w-[600px] mx-auto mb-6 flex items-center justify-center">
              <p className="text-sm text-[#9aa0a6]">
                Les notes de la corbeille sont supprimées au bout de 7 jours.
              </p>
              {(pinnedNotes.length > 0 || unpinnedNotes.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEmptyTrash}
                  disabled={emptyTrashMutation.isPending}
                  className="ml-4 text-[#e8eaed] hover:bg-[#3c4043]"
                >
                  {emptyTrashMutation.isPending ? (
                    <SpinnerInfinity
                      size={24}
                      secondaryColor="rgba(128,128,128,0.2)"
                      color="currentColor"
                      speed={120}
                      className="h-4 w-4  mr-2"
                    />
                  ) : null}
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
                    : "flex flex-col gap-3 max-w-[600px] mx-auto",
                )}
              >
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isGridView={isGridView}
                    onEdit={() => handleOpenEdit(note)}
                    onTogglePin={() => handleTogglePin(note)}
                    onToggleArchive={() => handleToggleArchive(note)}
                    onMoveToTrash={() => handleMoveToTrash(note)}
                    onRestoreFromTrash={() => handleRestoreFromTrash(note)}
                    onPermanentlyDelete={() => handlePermanentlyDelete(note.id)}
                    onChangeColor={(color) => handleChangeColor(note.id, color)}
                    onToggleChecklistItem={(itemId) =>
                      handleToggleChecklistItem(note, itemId)
                    }
                    showTrashActions={showTrashActions}
                    showArchiveActions={showArchiveActions}
                    onShare={() => setShareNoteId(note.id)}
                    onReminder={() => setReminderNoteId(note.id)}
                    onOcr={() => setOcrNoteId(note.id)}
                    onLabelClick={handleLabelClick}
                    searchQuery={searchQuery}
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
                    : "flex flex-col gap-3 max-w-[600px] mx-auto",
                )}
              >
                {unpinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isGridView={isGridView}
                    onEdit={() => handleOpenEdit(note)}
                    onTogglePin={() => handleTogglePin(note)}
                    onToggleArchive={() => handleToggleArchive(note)}
                    onMoveToTrash={() => handleMoveToTrash(note)}
                    onRestoreFromTrash={() => handleRestoreFromTrash(note)}
                    onPermanentlyDelete={() => handlePermanentlyDelete(note.id)}
                    onChangeColor={(color) => handleChangeColor(note.id, color)}
                    onToggleChecklistItem={(itemId) =>
                      handleToggleChecklistItem(note, itemId)
                    }
                    showTrashActions={showTrashActions}
                    showArchiveActions={showArchiveActions}
                    onShare={() => setShareNoteId(note.id)}
                    onReminder={() => setReminderNoteId(note.id)}
                    onOcr={() => setOcrNoteId(note.id)}
                    onLabelClick={handleLabelClick}
                    searchQuery={searchQuery}
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
                    Vos notes archivées apparaissent ici
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

      {/* Presentation mode */}
      {presentationMode && (
        <NotePresentation
          notes={filteredNotes}
          onClose={() => setPresentationMode(false)}
        />
      )}

      {/* Share dialog */}
      <Dialog
        open={!!shareNoteId}
        onOpenChange={(o) => {
          if (!o) setShareNoteId(null);
        }}
      >
        <DialogContent className="max-w-md">
          {shareNote && (
            <ShareNote
              noteId={shareNote.id}
              noteTitle={shareNote.title}
              onClose={() => setShareNoteId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reminder dialog */}
      <Dialog
        open={!!reminderNoteId}
        onOpenChange={(o) => {
          if (!o) setReminderNoteId(null);
        }}
      >
        <DialogContent className="max-w-md">
          {reminderNote && (
            <NoteReminder
              noteId={reminderNote.id}
              noteTitle={reminderNote.title}
              reminders={reminders}
              onAdd={(r) => setReminders((p) => [...p, r])}
              onDelete={(id) =>
                setReminders((p) => p.filter((r) => r.id !== id))
              }
              onClose={() => setReminderNoteId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* OCR dialog */}
      <Dialog
        open={!!ocrNoteId}
        onOpenChange={(o) => {
          if (!o) setOcrNoteId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <OcrImage
            onTextExtracted={(text) => {
              // The text is extracted — user can copy/insert it
              setOcrNoteId(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Note Edit Dialog */}
      <Dialog
        open={!!editingNote}
        onOpenChange={(o) => {
          if (!o) handleSaveEdit();
        }}
      >
        <DialogContent
          className="max-w-lg border-0 p-0 overflow-hidden"
          style={{ backgroundColor: editingNote?.color || "#202124" }}
        >
          <div className="p-4 space-y-3">
            <input
              className="w-full bg-transparent text-[15px] font-medium text-[#e8eaed] placeholder:text-[#9aa0a6] outline-none border-none resize-none"
              placeholder="Titre"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
            />
            <textarea
              className="w-full bg-transparent text-[13px] text-[#e8eaed] placeholder:text-[#9aa0a6] outline-none border-none resize-none min-h-[120px]"
              placeholder="Note..."
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={6}
            />
          </div>
          <div className="flex justify-end px-4 pb-3">
            <button
              onClick={handleSaveEdit}
              className="text-sm font-medium text-[#e8eaed] hover:text-white px-3 py-1.5 rounded hover:bg-[#3c4043] transition-colors"
            >
              Fermer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

// Highlight search matches in text
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-200/50 text-inherit rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

interface NoteCardProps {
  note: KeepNote;
  isGridView: boolean;
  onEdit: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onMoveToTrash: () => void;
  onRestoreFromTrash: () => void;
  onPermanentlyDelete: () => void;
  onChangeColor: (color: string) => void;
  onToggleChecklistItem: (itemId: string) => void;
  showTrashActions: boolean;
  showArchiveActions: boolean;
  onShare?: () => void;
  onReminder?: () => void;
  onOcr?: () => void;
  onLabelClick?: (labelName: string) => void;
  searchQuery?: string;
}

function NoteCard({
  note,
  isGridView,
  onEdit,
  onTogglePin,
  onToggleArchive,
  onMoveToTrash,
  onRestoreFromTrash,
  onPermanentlyDelete,
  onChangeColor,
  onToggleChecklistItem,
  showTrashActions,
  showArchiveActions,
  onShare,
  onReminder,
  onOcr,
  onLabelClick,
  searchQuery = "",
}: NoteCardProps) {
  const uncheckedItems = note.checklistItems.filter((item) => !item.checked);
  const checkedItems = note.checklistItems.filter((item) => item.checked);

  // Use note color or default dark gray
  const backgroundColor = note.color || "#202124";

  return (
    <div
      onClick={onEdit}
      className={cn(
        "group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200",
        // Masonry layout: break-inside-avoid prevents card splitting across columns
        isGridView && "break-inside-avoid mb-4",
        // List layout: simple margin
        !isGridView && "mb-3",
        // Subtle thin border for dark mode aesthetic
        "border border-[#5f6368]",
        // Hover effects
        "hover:border-[#8a8f94] hover:shadow-[0_2px_8px_rgba(0,0,0,0.4)]",
      )}
      style={{ backgroundColor }}
    >
      {/* Pin Button - toggles pin state via mutation */}
      {!showTrashActions && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              className={cn(
                "absolute top-2 right-2 p-2 rounded-full transition-all z-10",
                note.isPinned
                  ? "opacity-100 text-[#e8eaed]"
                  : "opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:bg-[#3c4043]/50",
              )}
              aria-label={note.isPinned ? "Désépingler" : "Épingler"}
            >
              <Pin
                className={cn(
                  "h-[18px] w-[18px]",
                  note.isPinned && "fill-current",
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
            {note.isPinned ? "Désépingler" : "Épingler"}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Content */}
      <div className="p-3 pr-10">
        {note.title && (
          <h3 className="text-[15px] font-medium text-[#e8eaed] mb-2 leading-tight">
            <HighlightText text={note.title} query={searchQuery} />
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
              <HighlightText text={note.content} query={searchQuery} />
            </p>
          )
        )}

        {/* Labels */}
        {note.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {note.labels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLabelClick?.(label);
                }}
                className="px-2 py-0.5 bg-[#3c4043]/70 text-[11px] text-[#e8eaed] rounded-full font-medium border border-[#5f6368]/30 hover:bg-[#5f6368]/50 transition-colors cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {showTrashActions ? (
          // Actions for notes in Trash view
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPermanentlyDelete();
                  }}
                  aria-label="Supprimer définitivement"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Supprimer définitivement
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
                    onRestoreFromTrash();
                  }}
                  aria-label="Restaurer de la corbeille"
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
          // Actions for notes in Archive view
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveToTrash();
                  }}
                  aria-label="Mettre à la corbeille"
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
                    onToggleArchive();
                  }}
                  aria-label="Désarchiver"
                >
                  <RefreshCw className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Désarchiver
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          // Actions for notes in normal view
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReminder?.();
                  }}
                  aria-label="Me rappeler"
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
                      aria-label="Changer la couleur"
                    >
                      <Palette className="h-[18px] w-[18px]" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                  Couleur d'arrière-plan
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
                      type="button"
                      onClick={() => onChangeColor(color.value)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                        note.color === color.value
                          ? "border-[#a142f4]"
                          : "border-transparent hover:border-[#5f6368]",
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                      aria-label={`Couleur ${color.name}`}
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
                  aria-label="Ajouter une image"
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
                    onToggleArchive();
                  }}
                  aria-label="Archiver la note"
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
                    onMoveToTrash();
                  }}
                  aria-label="Mettre à la corbeille"
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
                    onShare?.();
                  }}
                  aria-label="Partager"
                >
                  <Share2 className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Partager
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
                    onOcr?.();
                  }}
                  aria-label="OCR image"
                >
                  <ScanText className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Extraire texte (OCR)
              </TooltipContent>
            </Tooltip>

            {/* Idea 8+9: Convert note to Doc or Task */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span onClick={(e) => e.stopPropagation()}>
                  <NoteToDoc note={note} />
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Convertir en document
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span onClick={(e) => e.stopPropagation()}>
                  <NoteToTask note={note} />
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-[#3c4043] text-[#e8eaed] border-[#5f6368]">
                Convertir en tâche
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[#9aa0a6] hover:bg-[#3c4043]"
                  aria-label="Plus d'options"
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
