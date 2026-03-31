"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Check,
  LayoutDashboard,
  BarChart3,
  CheckSquare,
  Activity,
  FileText,
  Users,
  Sparkles,
  Bot,
} from "lucide-react";
import {
  useDashboardStore,
  useDashboardWidgets,
  useDashboardWidgetActions,
  WIDGET_CATALOG,
  WidgetType,
} from "@/stores/dashboard-store";
import { dashboardPresets } from "@/lib/dashboard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  analytics: BarChart3,
  productivity: CheckSquare,
  system: Activity,
  content: FileText,
  social: Users,
  agentiq: Bot,
};

const categoryLabels: Record<string, string> = {
  analytics: "Analytique",
  productivity: "Productivité",
  system: "Système",
  content: "Contenu",
  social: "Social",
  agentiq: "AgentIQ",
};

function WidgetCard({ item, isActive, onAdd }: { item: any; isActive: boolean; onAdd: () => void }) {
  const [clicked, setClicked] = React.useState(false);

  const handleClick = () => {
    if (isActive) return;
    setClicked(true);
    onAdd();
    setTimeout(() => setClicked(false), 800);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex flex-col gap-3 p-3 rounded-lg border bg-card transition-colors",
        !isActive && "hover:border-primary/50"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm flex-1">{item.label}</span>
        {isActive && <Check className="h-3.5 w-3.5 text-green-500" />}
      </div>
      <p className="text-xs text-muted-foreground flex-1">{item.description}</p>
      <Button
        size="sm"
        disabled={isActive}
        variant={isActive ? "secondary" : clicked ? "secondary" : "default"}
        onClick={handleClick}
        className={cn(
          "w-full mt-auto transition-all relative overflow-hidden",
          clicked && "bg-green-500/10 text-green-600 border-green-500/20",
          isActive && "opacity-80 cursor-not-allowed bg-muted text-muted-foreground border-transparent hover:bg-muted"
        )}
      >
        <AnimatePresence mode="wait">
          {clicked ? (
            <motion.div key="check" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center absolute">
              <Check className="h-3.5 w-3.5 mr-2" /> Ajouté !
            </motion.div>
          ) : isActive ? (
            <motion.div key="added" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center absolute">
              <Check className="h-3.5 w-3.5 mr-2" /> Déjà ajouté
            </motion.div>
          ) : (
            <motion.div key="add" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center absolute">
              <Plus className="h-3.5 w-3.5 mr-2" /> Ajouter
            </motion.div>
          )}
        </AnimatePresence>
        <div className="invisible flex items-center">
          <Plus className="h-3.5 w-3.5 mr-2" /> Déjà ajouté
        </div>
      </Button>
    </motion.div>
  );
}

function PresetCard({ preset, onApply }: { preset: any; onApply: () => void }) {
  const [applying, setApplying] = React.useState(false);
  const Icon = preset.icon;

  const handleApply = () => {
    setApplying(true);
    setTimeout(() => {
      onApply();
      setApplying(false);
    }, 600);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-card hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{preset.name}</span>
            {preset.targetRole && preset.targetRole !== "all" && (
              <Badge variant="outline" className="text-[10px]">
                {preset.targetRole}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{preset.description}</p>
          <p className="text-xs text-muted-foreground mt-2">{preset.widgets.length} widgets</p>
        </div>
      </div>
      <Button
        variant={applying ? "secondary" : "outline"}
        size="sm"
        onClick={handleApply}
        className={cn(
          "w-full transition-all relative overflow-hidden",
          applying && "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20"
        )}
      >
        <AnimatePresence mode="wait">
          {applying ? (
            <motion.div key="applying" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center absolute">
              <Check className="h-4 w-4 mr-2" /> Appliqué !
            </motion.div>
          ) : (
            <motion.div key="apply" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center absolute">
              Appliquer ce preset
            </motion.div>
          )}
        </AnimatePresence>
        <div className="invisible flex items-center">
          Appliquer ce preset
        </div>
      </Button>
    </motion.div>
  );
}

export function AddWidgetDialog({ open, onOpenChange }: AddWidgetDialogProps) {
  const widgets = useDashboardWidgets();
  const { addWidget } = useDashboardWidgetActions();
  const setWidgets = useDashboardStore((state) => state.setWidgets);
  const [activeTab, setActiveTab] = React.useState("widgets");

  const activeTypes = new Set(widgets.map((w) => w.type));

  const handleAdd = (type: WidgetType) => {
    addWidget(type);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = dashboardPresets.find((p) => p.id === presetId);
    if (!preset) return;

    const newWidgets = preset.widgets.map((w, i) => ({
      ...w,
      id: `${w.type}-${Date.now()}-${i}`,
      type: w.type as WidgetType,
    }));
    setWidgets(newWidgets);
    onOpenChange(false);
  };

  // Group widgets by category
  const groupedWidgets = React.useMemo(() => {
    const groups: Record<string, typeof WIDGET_CATALOG> = {};
    WIDGET_CATALOG.forEach((widget) => {
      const category = widget.category || "other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(widget);
    });
    return groups;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col h-[85vh] sm:max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            Personnaliser le Dashboard
          </DialogTitle>
          <DialogDescription>
            Ajoutez des widgets ou appliquez un preset.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col mt-4 min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2 p-1">
            <TabsTrigger
              value="widgets"
              className={cn(
                "relative gap-2 py-1.5 transition-colors",
                "data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
              )}
            >
              <span className="relative z-10 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Widgets
              </span>
              {activeTab === "widgets" && (
                <motion.div
                  layoutId="dialog-tabs-active"
                  className="absolute inset-0 bg-background dark:bg-input/30 dark:border dark:border-input rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="presets"
              className={cn(
                "relative gap-2 py-1.5 transition-colors",
                "data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
              )}
            >
              <span className="relative z-10 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Presets
              </span>
              {activeTab === "presets" && (
                <motion.div
                  layoutId="dialog-tabs-active"
                  className="absolute inset-0 bg-background dark:bg-input/30 dark:border dark:border-input rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="widgets" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                {Object.entries(groupedWidgets).map(([category, items]) => {
                  const Icon = categoryIcons[category] || LayoutDashboard;
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">
                          {categoryLabels[category] || category}
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          {items.length}
                        </Badge>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {items.map((item) => (
                          <WidgetCard
                            key={item.type}
                            item={item}
                            isActive={activeTypes.has(item.type)}
                            onAdd={() => handleAdd(item.type)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="presets" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-3">
                {dashboardPresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onApply={() => handleApplyPreset(preset.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
