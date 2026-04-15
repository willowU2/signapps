"use client";

import { SpinnerInfinity } from "spinners-react";

import { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  StickyNote,
  CheckCircle2,
  Sparkles,
  X,
  Plus,
  Trash2,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { calendarApi } from "@/lib/api";
import { getClient, ServiceName } from "@/lib/api/factory";

const docsClient = getClient(ServiceName.DOCS);

type AppType = "calendar" | "keep" | "tasks" | "gemini" | null;

interface Note {
  id: string;
  title: string;
  content: string;
  date: number;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
  date: number;
}

export function DriveRightSidebar() {
  const [activeApp, setActiveApp] = useState<AppType>(null);

  // Keep State
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Tasks State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState("");

  // Calendar State
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    // Load notes — API first, localStorage fallback
    const loadNotes = async () => {
      try {
        const res = await docsClient.get<any[]>("/keep/notes");
        const loaded: Note[] = (res.data ?? []).map((n: any) => ({
          id: n.id ?? String(n.created_at ?? Date.now()),
          title: n.title ?? "",
          content: n.content ?? n.body ?? "",
          date: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
        }));
        setNotes(loaded);
        localStorage.setItem("drive_keep_notes", JSON.stringify(loaded));
      } catch {
        const savedNotes = localStorage.getItem("drive_keep_notes");
        if (savedNotes) setNotes(JSON.parse(savedNotes));
      }
    };
    // Load tasks — API first, localStorage fallback
    const loadTasks = async () => {
      try {
        const res = await calendarApi.get<any[]>("/tasks");
        const loaded: Task[] = (res.data ?? []).map((t: any) => ({
          id: t.id ?? String(Date.now()),
          text: t.title ?? t.text ?? "",
          completed: t.completed ?? t.status === "done",
          date: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
        }));
        setTasks(loaded);
        localStorage.setItem("drive_tasks", JSON.stringify(loaded));
      } catch {
        const savedTasks = localStorage.getItem("drive_tasks");
        if (savedTasks) setTasks(JSON.parse(savedTasks));
      }
    };
    loadNotes();
    loadTasks();
  }, []);

  const saveNotes = (n: Note[]) => {
    setNotes(n);
    localStorage.setItem("drive_keep_notes", JSON.stringify(n));
  };

  const saveTasks = (t: Task[]) => {
    setTasks(t);
    localStorage.setItem("drive_tasks", JSON.stringify(t));
  };

  const syncNoteCreate = (note: Note) => {
    docsClient
      .post("/keep/notes", {
        id: note.id,
        title: note.title,
        content: note.content,
      })
      .catch(() => {});
  };

  const syncNoteDelete = (id: string) => {
    docsClient.delete(`/keep/notes/${id}`).catch(() => {});
  };

  const syncTaskCreate = (task: Task) => {
    calendarApi
      .post("/tasks", {
        id: task.id,
        title: task.text,
        completed: task.completed,
      })
      .catch(() => {});
  };

  const syncTaskUpdate = (task: Task) => {
    calendarApi
      .put(`/tasks/${task.id}`, { completed: task.completed })
      .catch(() => {});
  };

  const syncTaskDelete = (id: string) => {
    calendarApi.delete(`/tasks/${id}`).catch(() => {});
  };

  // Keep actions
  const handleAddNote = () => {
    if (!newNoteContent.trim()) {
      setIsCreatingNote(false);
      return;
    }
    const note: Note = {
      id: Date.now().toString(),
      title: newNoteTitle,
      content: newNoteContent,
      date: Date.now(),
    };
    saveNotes([note, ...notes]);
    syncNoteCreate(note);
    setNewNoteTitle("");
    setNewNoteContent("");
    setIsCreatingNote(false);
  };

  const handleDeleteNote = (id: string) => {
    saveNotes(notes.filter((n) => n.id !== id));
    syncNoteDelete(id);
  };

  // Tasks actions
  const handleAddTask = (e?: React.KeyboardEvent) => {
    if (e && e.key !== "Enter") return;
    if (!newTaskText.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      text: newTaskText,
      completed: false,
      date: Date.now(),
    };
    saveTasks([task, ...tasks]);
    syncTaskCreate(task);
    setNewTaskText("");
  };

  const toggleTask = (id: string) => {
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t,
    );
    saveTasks(updated);
    const task = updated.find((t) => t.id === id);
    if (task) syncTaskUpdate(task);
  };

  const handleDeleteTask = (id: string) => {
    saveTasks(tasks.filter((t) => t.id !== id));
    syncTaskDelete(id);
  };

  // Calendar actions
  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      // First calendar
      const cals = await calendarApi.listCalendars();
      if (cals.data && cals.data.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const evs = await calendarApi.listEvents(
          cals.data[0].id,
          today,
          tomorrow,
        );
        setEvents(evs.data || []);
      }
    } catch (e) {
      console.warn("Failed to load events", e);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (activeApp === "calendar") {
      loadEvents();
    }
  }, [activeApp]);

  const uncompletedTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return (
    <div className="flex h-full border-l border-[#e3e3e3] dark:border-[#3c4043] bg-background dark:bg-[#1a1a1a]">
      {/* Expanded App Drawer */}
      {activeApp && (
        <div className="w-[300px] flex flex-col border-r border-[#e3e3e3] dark:border-[#3c4043] bg-background dark:bg-[#1a1a1a]">
          <div className="flex items-center justify-between p-3 border-b border-[#e3e3e3] dark:border-[#3c4043]">
            <h2 className="text-[14px] font-medium text-[#202124] dark:text-[#e8eaed] flex items-center gap-2 uppercase tracking-wider">
              {activeApp === "calendar" && (
                <>
                  <CalendarIcon className="w-4 h-4 text-blue-600" /> Agenda
                </>
              )}
              {activeApp === "keep" && (
                <>
                  <StickyNote className="w-4 h-4 text-yellow-500" /> Keep
                </>
              )}
              {activeApp === "tasks" && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-blue-500" /> Tasks
                </>
              )}
              {activeApp === "gemini" && (
                <>
                  <Sparkles className="w-4 h-4 text-purple-500" /> Gemini
                </>
              )}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => setActiveApp(null)}
            >
              <X className="h-4 w-4 text-[#5f6368] dark:text-[#9aa0a6]" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* KEEP APP */}
            {activeApp === "keep" && (
              <div className="space-y-4">
                {!isCreatingNote ? (
                  <div
                    className="border border-[#dadce0] dark:border-[#5f6368] rounded-lg p-3 cursor-text shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 text-[#5f6368]"
                    onClick={() => setIsCreatingNote(true)}
                  >
                    <Plus className="w-4 h-4 font-bold" />
                    <span className="text-[13px] font-medium">
                      Créer une note...
                    </span>
                  </div>
                ) : (
                  <div className="border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-md overflow-hidden bg-background dark:bg-[#202124]">
                    <Input
                      placeholder="Titre"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      className="border-none focus-visible:ring-0 text-[14px] font-medium px-3 pt-3 pb-1 bg-transparent"
                    />
                    <Textarea
                      placeholder="Créer une note..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="border-none focus-visible:ring-0 resize-none min-h-[80px] text-[13px] px-3 py-2 bg-transparent"
                      autoFocus
                    />
                    <div className="flex justify-end p-2 border-t border-[#f1f3f4] dark:border-[#3c4043]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsCreatingNote(false);
                          setNewNoteTitle("");
                          setNewNoteContent("");
                        }}
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 dark:text-blue-400 font-medium"
                        onClick={handleAddNote}
                      >
                        Fermer
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-3 mt-4">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="group border border-[#dadce0] dark:border-[#5f6368] rounded-lg p-3 hover:shadow-md transition-shadow relative bg-background dark:bg-[#202124]"
                    >
                      {note.title && (
                        <h4 className="font-medium text-[14px] text-[#202124] dark:text-[#e8eaed] mb-1">
                          {note.title}
                        </h4>
                      )}
                      <p className="text-[13px] text-[#444746] dark:text-[#bdc1c6] whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <button
                        className="absolute top-2 right-2 p-1.5 bg-background dark:bg-[#202124] rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted dark:hover:bg-[#3c4043] transition-all"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#5f6368]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TASKS APP */}
            {activeApp === "tasks" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-bold text-[#202124] dark:text-[#e8eaed]">
                    Mes tâches
                  </h3>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ajouter une tâche"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={handleAddTask}
                    className="h-8 text-[13px] rounded-full border-[#dadce0] dark:border-[#5f6368] dark:bg-[#202124] focus-visible:ring-1 focus-visible:ring-blue-500"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full shrink-0"
                    onClick={() => handleAddTask()}
                  >
                    <Plus className="w-5 h-5 text-blue-600" />
                  </Button>
                </div>

                <div className="space-y-1">
                  {uncompletedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="group flex items-start gap-3 py-2 px-1 hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] rounded-lg transition-colors"
                    >
                      <button
                        className="mt-0.5 w-[18px] h-[18px] rounded-full border-2 border-[#5f6368] dark:border-[#9aa0a6] flex items-center justify-center shrink-0 hover:border-blue-600 dark:hover:border-blue-400 transition-colors"
                        onClick={() => toggleTask(task.id)}
                      />
                      <span className="text-[13px] text-[#202124] dark:text-[#e8eaed] leading-5 flex-1">
                        {task.text}
                      </span>
                    </div>
                  ))}
                </div>

                {completedTasks.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-[12px] font-medium text-[#5f6368] dark:text-[#9aa0a6] px-1 mb-2">
                      Terminées ({completedTasks.length})
                    </h4>
                    <div className="space-y-1">
                      {completedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="group flex items-start gap-3 py-2 px-1 hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] rounded-lg transition-colors"
                        >
                          <button
                            className="mt-0.5 w-[18px] h-[18px] rounded-full bg-blue-500 flex items-center justify-center shrink-0"
                            onClick={() => toggleTask(task.id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </button>
                          <span className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6] line-through leading-5 flex-1">
                            {task.text}
                          </span>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#e8eaed] dark:hover:bg-[#5f6368] rounded-full transition-all"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#5f6368] dark:text-[#9aa0a6]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CALENDAR APP */}
            {activeApp === "calendar" && (
              <div className="space-y-4">
                <div className="text-center pb-4 border-b border-[#dadce0] dark:border-[#5f6368]">
                  <h3 className="text-[18px] font-normal text-[#202124] dark:text-[#e8eaed]">
                    {new Date().toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </h3>
                  <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] mt-1">
                    Aujourd'hui
                  </p>
                </div>

                <div className="pt-2 relative">
                  {loadingEvents ? (
                    <div className="flex flex-col items-center justify-center py-10 text-[#5f6368]">
                      <SpinnerInfinity
                        size={24}
                        secondaryColor="rgba(128,128,128,0.2)"
                        color="currentColor"
                        speed={120}
                        className="w-6 h-6  mb-2"
                      />
                      <span className="text-sm">Chargement...</span>
                    </div>
                  ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-[#5f6368]">
                      <CalendarCheck className="w-10 h-10 mb-3 text-[#dadce0] dark:text-[#5f6368]" />
                      <p className="text-[13px]">
                        Aucun événement prévu aujourd'hui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Minimalistic event list */}
                      {events.map((ev, i) => (
                        <div
                          key={i}
                          className="flex gap-3 p-2 rounded-lg hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] transition-colors cursor-pointer border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                        >
                          <div className="text-[12px] font-medium text-[#5f6368] dark:text-[#9aa0a6] w-12 shrink-0 pt-0.5">
                            {new Date(ev.start_time).toLocaleTimeString(
                              "fr-FR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-[#202124] dark:text-[#e8eaed] truncate">
                              {ev.title}
                            </div>
                            <div className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] truncate">
                              {ev.location || "Sans lieu"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GEMINI APP */}
            {activeApp === "gemini" && (
              <div className="flex flex-col h-full">
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <Sparkles className="w-10 h-10 text-[#1a73e8]" />
                  <div>
                    <h3 className="text-[16px] font-medium text-[#202124] dark:text-[#e8eaed]">
                      Demander à Gemini
                    </h3>
                    <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6] mt-2 max-w-[200px] mx-auto">
                      Posez des questions sur vos fichiers ou demandez à Gemini
                      de créer du contenu pour vous.
                    </p>
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="relative">
                    <Input
                      placeholder="Que peut faire Gemini..."
                      className="pr-10 rounded-full bg-[#f1f3f4] dark:bg-[#303134] border-none focus-visible:ring-1 focus-visible:ring-[#1a73e8] shadow-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-8 w-8 rounded-full text-[#1a73e8]"
                    >
                      <Sparkles className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-center text-[#5f6368] mt-3 pb-2">
                    Gemini peut faire des erreurs.{" "}
                    <a href="#" className="underline">
                      En savoir plus
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* App Icons Sidebar */}
      <div className="w-[56px] flex flex-col items-center py-4 bg-background dark:bg-[#1a1a1a] shadow-sm z-10 shrink-0 border-l border-[#e3e3e3] dark:border-[#3c4043]">
        <div className="flex flex-col gap-4">
          <AppIcon
            icon={
              <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            }
            tooltip="Agenda"
            active={activeApp === "calendar"}
            onClick={() =>
              setActiveApp(activeApp === "calendar" ? null : "calendar")
            }
          />
          <AppIcon
            icon={<StickyNote className="w-5 h-5 text-yellow-500" />}
            tooltip="Keep"
            active={activeApp === "keep"}
            onClick={() => setActiveApp(activeApp === "keep" ? null : "keep")}
          />
          <AppIcon
            icon={<CheckCircle2 className="w-5 h-5 text-blue-500" />}
            tooltip="Tasks"
            active={activeApp === "tasks"}
            onClick={() => setActiveApp(activeApp === "tasks" ? null : "tasks")}
          />

          <div className="w-6 h-px bg-[#dadce0] dark:bg-[#5f6368] my-1 mx-auto" />

          <AppIcon
            icon={
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            }
            tooltip="Gemini"
            active={activeApp === "gemini"}
            onClick={() =>
              setActiveApp(activeApp === "gemini" ? null : "gemini")
            }
          />
        </div>

        {/* Bouton "Ajouter modules" retiré - feature non implémentée (NO DEAD ENDS) */}
      </div>
    </div>
  );
}

function AppIcon({
  icon,
  tooltip,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  tooltip: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center transition-all group relative",
        active
          ? "bg-[#e8f0fe] dark:bg-[#3c4043]"
          : "hover:bg-[#f1f3f4] dark:hover:bg-[#303134]",
      )}
      onClick={onClick}
      title={tooltip}
    >
      {icon}
    </button>
  );
}
