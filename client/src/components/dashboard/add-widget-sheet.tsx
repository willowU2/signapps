"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

interface AddWidgetSheetProps {
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

export function AddWidgetSheet({ open, onOpenChange }: AddWidgetSheetProps) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full sm:max-w-lg w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            Personnaliser le Dashboard
          </SheetTitle>
          <SheetDescription>
            Ajoutez des widgets ou appliquez un preset.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col mt-4 min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="widgets" className="gap-2">
              <Plus className="h-4 w-4" />
              Widgets
            </TabsTrigger>
            <TabsTrigger value="presets" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Presets
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
                      <div className="grid gap-2">
                        {items.map((item) => {
                          const isActive = activeTypes.has(item.type);
                          return (
                            <div
                              key={item.type}
                              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {item.label}
                                  </span>
                                  {isActive && (
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.description}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant={isActive ? "outline" : "default"}
                                onClick={() => handleAdd(item.type)}
                                className="shrink-0"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
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
                {dashboardPresets.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <div
                      key={preset.id}
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
                          <p className="text-sm text-muted-foreground mt-1">
                            {preset.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {preset.widgets.length} widgets
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyPreset(preset.id)}
                        className="w-full"
                      >
                        Appliquer ce preset
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 mt-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
