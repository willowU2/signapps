"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Trash2, Copy, Save, CheckSquare } from "lucide-react";
import { toast } from "sonner";

interface ActionItem {
  id: string;
  task: string;
  owner: string;
  due: string;
  done: boolean;
}

interface MeetingNote {
  date: string;
  title: string;
  attendees: string;
  objective: string;
  agenda: string;
  notes: string;
  decisions: string;
  actions: ActionItem[];
}

const emptyNote = (): MeetingNote => ({
  date: new Date().toISOString().slice(0, 10),
  title: "",
  attendees: "",
  objective: "",
  agenda: "",
  notes: "",
  decisions: "",
  actions: [],
});

export function MeetingNotesTemplate() {
  const [note, setNote] = useState<MeetingNote>(emptyNote());

  const addAction = () => {
    setNote((p) => ({
      ...p,
      actions: [
        ...p.actions,
        {
          id: Date.now().toString(),
          task: "",
          owner: "",
          due: "",
          done: false,
        },
      ],
    }));
  };

  const updateAction = (
    id: string,
    field: keyof ActionItem,
    value: string | boolean,
  ) => {
    setNote((p) => ({
      ...p,
      actions: p.actions.map((a) =>
        a.id === id ? { ...a, [field]: value } : a,
      ),
    }));
  };

  const removeAction = (id: string) =>
    setNote((p) => ({ ...p, actions: p.actions.filter((a) => a.id !== id) }));

  const exportMarkdown = () => {
    const md = [
      `# ${note.title || "Meeting Notes"}`,
      `**Date:** ${note.date}  `,
      `**Attendees:** ${note.attendees}  `,
      "",
      `## Objective`,
      note.objective,
      "",
      `## Agenda`,
      note.agenda,
      "",
      `## Notes`,
      note.notes,
      "",
      `## Decisions`,
      note.decisions,
      "",
      `## Action Items`,
      ...note.actions.map(
        (a) => `- [ ] **${a.task}** — ${a.owner} (due: ${a.due})`,
      ),
    ].join("\n");
    navigator.clipboard.writeText(md);
    toast.success("Markdown copié dans le presse-papier");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Meeting Notes Template
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportMarkdown}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Export MD
            </Button>
            <Button
              size="sm"
              onClick={() => {
                toast.success("Notes enregistrées");
              }}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Enregistrer
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Meeting Title</Label>
            <Input
              value={note.title}
              onChange={(e) =>
                setNote((p) => ({ ...p, title: e.target.value }))
              }
              placeholder="Weekly standup"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={note.date}
              onChange={(e) => setNote((p) => ({ ...p, date: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Attendees</Label>
          <Input
            value={note.attendees}
            onChange={(e) =>
              setNote((p) => ({ ...p, attendees: e.target.value }))
            }
            placeholder="Alice, Bob, Charlie"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Objective</Label>
          <Textarea
            value={note.objective}
            onChange={(e) =>
              setNote((p) => ({ ...p, objective: e.target.value }))
            }
            rows={2}
            placeholder="What we want to achieve..."
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Textarea
            value={note.notes}
            onChange={(e) => setNote((p) => ({ ...p, notes: e.target.value }))}
            rows={4}
            placeholder="Discussion notes..."
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Decisions Made</Label>
          <Textarea
            value={note.decisions}
            onChange={(e) =>
              setNote((p) => ({ ...p, decisions: e.target.value }))
            }
            rows={2}
            placeholder="Decisions agreed upon..."
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" />
              Action Items
              <Badge variant="secondary" className="text-[10px]">
                {note.actions.length}
              </Badge>
            </Label>
            <Button
              size="sm"
              variant="outline"
              onClick={addAction}
              className="h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {note.actions.map((action) => (
              <div
                key={action.id}
                className="grid grid-cols-12 gap-1.5 items-center"
              >
                <button
                  className={`col-span-1 h-4 w-4 rounded border-2 flex items-center justify-center ${action.done ? "bg-green-500 border-green-500" : "border-muted-foreground"}`}
                  onClick={() => updateAction(action.id, "done", !action.done)}
                >
                  {action.done && (
                    <span className="text-white text-[8px]">✓</span>
                  )}
                </button>
                <Input
                  value={action.task}
                  onChange={(e) =>
                    updateAction(action.id, "task", e.target.value)
                  }
                  placeholder="Task"
                  className={`col-span-5 h-7 text-xs ${action.done ? "line-through opacity-50" : ""}`}
                />
                <Input
                  value={action.owner}
                  onChange={(e) =>
                    updateAction(action.id, "owner", e.target.value)
                  }
                  placeholder="Owner"
                  className="col-span-3 h-7 text-xs"
                />
                <Input
                  type="date"
                  value={action.due}
                  onChange={(e) =>
                    updateAction(action.id, "due", e.target.value)
                  }
                  className="col-span-2 h-7 text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="col-span-1 h-7 w-7 text-destructive"
                  onClick={() => removeAction(action.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
