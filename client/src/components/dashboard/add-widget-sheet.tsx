"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, LayoutDashboard } from "lucide-react";
import {
  useDashboardWidgets,
  useDashboardWidgetActions,
  WIDGET_CATALOG,
  WidgetType,
} from "@/stores/dashboard-store";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddWidgetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddWidgetSheet({ open, onOpenChange }: AddWidgetSheetProps) {
  // Granular selectors for optimized re-renders
  const widgets = useDashboardWidgets();
  const { addWidget } = useDashboardWidgetActions();

  const activeTypes = new Set(widgets.map((w) => w.type));

  const handleAdd = (type: WidgetType) => {
    addWidget(type);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
            Add Widget
          </SheetTitle>
          <SheetDescription>
            Choose a widget to add to your dashboard.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 mt-6 min-h-0 bg-muted/10 border rounded-lg overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {WIDGET_CATALOG.map((item) => {
                const isActive = activeTypes.has(item.type);
                return (
                  <div
                    key={item.type}
                    className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{item.label}</p>
                          {isActive && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5 px-1.5"
                            >
                              <Check className="mr-1 h-3 w-3 text-green-500" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex justify-end pt-2 border-t">
                       <Button
                        size="sm"
                        variant={isActive ? "outline" : "default"}
                        onClick={() => handleAdd(item.type)}
                        className="h-8 gap-1.5 px-3"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Widget
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-end pt-6 mt-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
