'use client';

import { useState } from 'react';
import {
  Calendar as CalendarIcon,
  StickyNote,
  CheckSquare,
  Contact,
  Plus,
  X,
  Circle,
  CheckCircle2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotesStore, useQuickTasksStore } from '@/lib/store';

type PanelId = 'calendar' | 'notes' | 'tasks' | 'contacts' | null;

const iconButtons = [
  { id: 'calendar' as const, icon: CalendarIcon, label: 'Calendrier' },
  { id: 'notes' as const, icon: StickyNote, label: 'Notes' },
  { id: 'tasks' as const, icon: CheckSquare, label: 'Tâches' },
  { id: 'contacts' as const, icon: Contact, label: 'Contacts' },
];

// ────────────── Calendar Panel ──────────────
function CalendarPanel() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday start

  const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isToday = (day: number) =>
    today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize">{monthName}</h3>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="rounded p-1 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={nextMonth} className="rounded p-1 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((d) => (
          <div key={d} className="py-1 font-semibold text-muted-foreground">{d}</div>
        ))}
        {[...Array(startOffset)].map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {[...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          return (
            <button
              key={day}
              className={cn(
                'rounded-full py-1.5 text-xs transition-colors hover:bg-muted',
                isToday(day) && 'bg-primary text-white hover:bg-primary/90 font-semibold'
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────── Notes Panel ──────────────
function NotesPanel() {
  const { notes, addNote, updateNote, removeNote } = useNotesStore();
  const [newNote, setNewNote] = useState('');

  const handleAdd = () => {
    if (!newNote.trim()) return;
    addNote(newNote.trim());
    setNewNote('');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Nouvelle note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="h-8 text-xs"
        />
        <Button size="sm" onClick={handleAdd} className="h-8 w-8 shrink-0 p-0">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2">
        {notes.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Aucune note</p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="group rounded-lg border border-border bg-muted/30 p-2">
            <div className="flex items-start justify-between gap-1">
              <textarea
                value={note.content}
                onChange={(e) => updateNote(note.id, e.target.value)}
                className="flex-1 resize-none border-none bg-transparent p-0 text-xs text-foreground focus:outline-none focus:ring-0"
                rows={2}
              />
              <button
                onClick={() => removeNote(note.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {new Date(note.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────── Tasks Panel ──────────────
function TasksPanel() {
  const { tasks, addTask, toggleTask, removeTask } = useQuickTasksStore();
  const [newTask, setNewTask] = useState('');

  const handleAdd = () => {
    if (!newTask.trim()) return;
    addTask(newTask.trim());
    setNewTask('');
  };

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{doneCount}/{tasks.length} terminées</span>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Nouvelle tâche..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="h-8 text-xs"
        />
        <Button size="sm" onClick={handleAdd} className="h-8 w-8 shrink-0 p-0">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-1">
        {tasks.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Aucune tâche</p>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted"
          >
            <button onClick={() => toggleTask(task.id)} className="shrink-0">
              {task.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <span className={cn('flex-1 text-xs', task.done && 'text-muted-foreground line-through')}>
              {task.label}
            </span>
            <button
              onClick={() => removeTask(task.id)}
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────── Contacts Panel ──────────────
const mockContacts = [
  { name: 'Admin', role: 'Administrateur', online: true },
  { name: 'System', role: 'Service Account', online: true },
  { name: 'Backup Agent', role: 'Scheduler', online: false },
];

function ContactsPanel() {
  return (
    <div className="space-y-2">
      {mockContacts.map((contact) => (
        <div key={contact.name} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted">
          <div className="relative">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            {contact.online && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{contact.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{contact.role}</p>
          </div>
        </div>
      ))}
      <p className="pt-2 text-center text-[10px] text-muted-foreground">
        Gérer les utilisateurs →
      </p>
    </div>
  );
}

// ────────────── Main Component ──────────────
const panelTitles: Record<string, string> = {
  calendar: 'Calendrier',
  notes: 'Notes rapides',
  tasks: 'Tâches',
  contacts: 'Contacts',
};

export function RightSidebar() {
  const [activePanel, setActivePanel] = useState<PanelId>(null);

  const togglePanel = (id: PanelId) => {
    setActivePanel((prev) => (prev === id ? null : id));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full shrink-0">
        {/* Panel */}
        <div
          className={cn(
            'overflow-hidden border-l border-border bg-card transition-all duration-200',
            activePanel ? 'w-72' : 'w-0'
          )}
        >
          {activePanel && (
            <div className="flex h-full w-72 flex-col">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {panelTitles[activePanel]}
                </h2>
                <button
                  onClick={() => setActivePanel(null)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activePanel === 'calendar' && <CalendarPanel />}
                {activePanel === 'notes' && <NotesPanel />}
                {activePanel === 'tasks' && <TasksPanel />}
                {activePanel === 'contacts' && <ContactsPanel />}
              </div>
            </div>
          )}
        </div>

        {/* Icon strip */}
        <aside className="flex w-14 shrink-0 flex-col items-center border-l border-border bg-card dark:bg-background py-4">
          <div className="flex flex-col items-center gap-3">
            {iconButtons.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => togglePanel(item.id)}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                      activePanel === item.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">{item.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="mt-auto w-full border-t border-border pt-4 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <Plus className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Ajouter</TooltipContent>
            </Tooltip>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
