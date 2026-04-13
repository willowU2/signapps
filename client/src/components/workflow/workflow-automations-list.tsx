"use client";

// Feature 3/6/9/12/15/21: Workflow automation templates listing + management

import { useState } from "react";
import {
  Zap,
  Play,
  Pause,
  Trash2,
  Plus,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useWorkflowAutomations } from "@/hooks/use-workflow-automations";
import { WorkflowBuilder } from "./workflow-builder";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const TRIGGER_LABELS: Record<string, string> = {
  email_received: "📧 Email reçu",
  deal_won: "🏆 Deal gagné",
  form_submitted: "📋 Formulaire soumis",
  task_overdue: "⏰ Tâche en retard",
  calendar_event: "📅 Événement calendrier",
  file_uploaded: "📁 Fichier uploadé",
  approval_requested: "✅ Approbation",
  schedule: "🔄 Planifié",
  manual: "▶️ Manuel",
};

const ACTION_LABELS: Record<string, string> = {
  create_task: "Créer tâche",
  create_invoice: "Créer facture",
  create_contact: "Créer contact",
  send_email: "Envoyer email",
  create_doc: "Créer document",
  auto_tag: "Auto-tagger",
  notify: "Notifier",
};

export function WorkflowAutomationsList() {
  const { automations, templates, toggle, remove, addFromTemplate } =
    useWorkflowAutomations();
  const [builderOpen, setBuilderOpen] = useState(false);

  const handleTemplate = (i: number) => {
    addFromTemplate(i);
    toast.success("Automation créée depuis le modèle");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Automations
          </h2>
          <p className="text-xs text-muted-foreground">
            {automations.filter((a) => a.enabled).length} active(s) sur{" "}
            {automations.length}
          </p>
        </div>
        <Sheet open={builderOpen} onOpenChange={setBuilderOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Créer
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-full max-w-[600px] sm:max-w-[700px] overflow-y-auto"
          >
            <SheetHeader className="mb-4">
              <SheetTitle>Créer une automation</SheetTitle>
            </SheetHeader>
            <WorkflowBuilder onSave={() => setBuilderOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Templates */}
      {automations.length === 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Modèles rapides
          </p>
          <div className="grid grid-cols-2 gap-2">
            {templates.slice(0, 6).map((t, i) => (
              <Card
                key={i}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleTemplate(i)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Zap className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {TRIGGER_LABELS[t.trigger.type]}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {automations.length > 0 && (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2 pr-1">
            {automations.map((a) => (
              <Card
                key={a.id}
                className={`transition-all ${a.enabled ? "border-primary/30" : ""}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={a.enabled}
                      onCheckedChange={() => toggle(a.id)}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        {a.enabled && (
                          <Badge className="h-4 text-xs px-1 bg-green-100 text-green-700">
                            Actif
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-xs h-4 px-1">
                          {TRIGGER_LABELS[a.trigger.type] || a.trigger.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">→</span>
                        {a.actions.slice(0, 2).map((act, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-xs h-4 px-1"
                          >
                            {ACTION_LABELS[act.type] || act.type}
                          </Badge>
                        ))}
                        {a.actions.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{a.actions.length - 2}
                          </span>
                        )}
                      </div>
                      {(a.lastRunAt || a.runCount > 0) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {a.lastRunAt && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {formatDistanceToNow(new Date(a.lastRunAt), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </span>
                          )}
                          {a.runCount > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <CheckCircle className="w-2.5 h-2.5" />
                              {a.runCount}x
                            </span>
                          )}
                          {a.schedule && (
                            <Badge
                              variant="outline"
                              className="text-xs h-4 px-1 font-mono"
                            >
                              {a.schedule}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                      onClick={() => {
                        remove(a.id);
                        toast.success("Automation supprimée");
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
