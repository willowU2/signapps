import { SpinnerInfinity } from 'spinners-react';
/**
 * Universal Sheet Component
 *
 * Panneau latéral réutilisable pour afficher les détails d'une entité
 * avec tabs dynamiques, header configurable et footer d'actions.
 */

"use client";

import * as React from "react";
import { LucideIcon, X, ChevronLeft, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePermissions, type Resource, type ResourceAction } from "@/lib/permissions";

// ============================================================================
// Types
// ============================================================================

export interface TabConfig {
  /** Unique tab identifier */
  id: string;
  /** Tab label */
  label: string;
  /** Tab icon */
  icon?: LucideIcon;
  /** Tab content renderer */
  content: React.ReactNode;
  /** Required permission to see this tab */
  requiredPermission?: string;
  /** Badge to show on tab (e.g., count) */
  badge?: string | number;
  /** Whether tab is disabled */
  disabled?: boolean;
}

export interface SheetAction {
  /** Unique action identifier */
  id: string;
  /** Action label */
  label: string;
  /** Action icon */
  icon?: LucideIcon;
  /** Action handler */
  onClick: () => void;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Button variant */
  variant?: "default" | "secondary" | "outline" | "destructive" | "ghost";
  /** Required permission */
  requiredPermission?: string;
}

export interface UniversalSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Called when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Sheet title */
  title: string;
  /** Sheet subtitle/description */
  description?: string;
  /** Title icon */
  icon?: LucideIcon;
  /** Status badge */
  statusBadge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  /** Tab configurations */
  tabs?: TabConfig[];
  /** Default active tab */
  defaultTab?: string;
  /** Primary actions in header */
  headerActions?: SheetAction[];
  /** Footer actions */
  footerActions?: SheetAction[];
  /** Content when no tabs (simple mode) */
  children?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Sheet side */
  side?: "right" | "left";
  /** Custom class name */
  className?: string;
  /** Show back button */
  showBackButton?: boolean;
  /** Back button handler */
  onBack?: () => void;
  /** Wide mode (larger width) */
  wide?: boolean;
}

// ============================================================================
// Permission Helper
// ============================================================================

function checkPermission(
  requiredPermission: string | undefined,
  can: (resource: Resource, action: ResourceAction | ResourceAction[]) => boolean
): boolean {
  if (!requiredPermission) return true;

  const parts = requiredPermission.split(":");
  if (parts.length !== 2) {
    console.warn(`Invalid permission format: ${requiredPermission}. Expected "resource:action"`);
    return true;
  }

  const [resource, action] = parts as [Resource, ResourceAction];
  return can(resource, action);
}

// ============================================================================
// Loading State
// ============================================================================

function SheetLoadingState() {
  return (
    <div className="flex-1 p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Header Actions Menu
// ============================================================================

function HeaderActionsMenu({
  actions,
  can,
}: {
  actions: SheetAction[];
  can: (resource: Resource, action: ResourceAction | ResourceAction[]) => boolean;
}) {
  const visibleActions = actions.filter((action) =>
    checkPermission(action.requiredPermission, can)
  );

  if (visibleActions.length === 0) return null;

  // If only one action, show as button
  if (visibleActions.length === 1) {
    const action = visibleActions[0];
    const Icon = action.icon;

    return (
      <Button
        variant={action.variant ?? "outline"}
        size="sm"
        onClick={action.onClick}
        disabled={action.disabled || action.loading}
      >
        {action.loading ? (
          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />
        ) : Icon ? (
          <Icon className="mr-2 h-4 w-4" />
        ) : null}
        {action.label}
      </Button>
    );
  }

  // Multiple actions - show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visibleActions.map((action, index) => {
          const Icon = action.icon;
          const isDestructive = action.variant === "destructive";

          return (
            <React.Fragment key={action.id}>
              {index > 0 &&
                isDestructive &&
                visibleActions[index - 1].variant !== "destructive" && (
                  <DropdownMenuSeparator />
                )}
              <DropdownMenuItem
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                className={cn(isDestructive && "text-destructive focus:text-destructive")}
              >
                {action.loading ? (
                  <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />
                ) : Icon ? (
                  <Icon className="mr-2 h-4 w-4" />
                ) : null}
                {action.label}
              </DropdownMenuItem>
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Footer Actions
// ============================================================================

function FooterActions({
  actions,
  can,
}: {
  actions: SheetAction[];
  can: (resource: Resource, action: ResourceAction | ResourceAction[]) => boolean;
}) {
  const visibleActions = actions.filter((action) =>
    checkPermission(action.requiredPermission, can)
  );

  if (visibleActions.length === 0) return null;

  return (
    <SheetFooter className="border-t bg-muted/30 px-6 py-4">
      <div className="flex w-full justify-end gap-2">
        {visibleActions.map((action) => {
          const Icon = action.icon;

          return (
            <Button
              key={action.id}
              variant={action.variant ?? "default"}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
            >
              {action.loading ? (
                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />
              ) : Icon ? (
                <Icon className="mr-2 h-4 w-4" />
              ) : null}
              {action.label}
            </Button>
          );
        })}
      </div>
    </SheetFooter>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UniversalSheet({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  statusBadge,
  tabs,
  defaultTab,
  headerActions,
  footerActions,
  children,
  isLoading,
  side = "right",
  className,
  showBackButton,
  onBack,
  wide,
}: UniversalSheetProps) {
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = React.useState(defaultTab ?? tabs?.[0]?.id ?? "");

  // Filter tabs by permission
  const visibleTabs = React.useMemo(
    () => (tabs ?? []).filter((tab) => checkPermission(tab.requiredPermission, can)),
    [tabs, can]
  );

  // Update active tab when tabs change
  React.useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  // Reset tab when sheet opens
  React.useEffect(() => {
    if (open && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className={cn(
          "flex flex-col p-0 gap-0",
          wide && "sm:max-w-lg md:max-w-xl lg:max-w-2xl",
          className
        )}
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4 space-y-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {showBackButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={onBack ?? (() => onOpenChange(false))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}

              {Icon && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-lg truncate">{title}</SheetTitle>
                  {statusBadge && (
                    <Badge variant={statusBadge.variant ?? "secondary"}>
                      {statusBadge.label}
                    </Badge>
                  )}
                </div>
                {description && (
                  <SheetDescription className="truncate">{description}</SheetDescription>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerActions && headerActions.length > 0 && (
                <HeaderActionsMenu actions={headerActions} can={can} />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <SheetLoadingState />
          ) : visibleTabs.length > 0 ? (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex flex-col h-full"
            >
              {/* Tabs header */}
              <div className="border-b px-6">
                <TabsList className="h-auto p-0 bg-transparent gap-4">
                  {visibleTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        disabled={tab.disabled}
                        className="relative px-1 pb-3 pt-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                      >
                        <span className="flex items-center gap-2">
                          {TabIcon && <TabIcon className="h-4 w-4" />}
                          {tab.label}
                          {tab.badge !== undefined && (
                            <Badge
                              variant="secondary"
                              className="ml-1 h-5 min-w-5 px-1.5 text-xs"
                            >
                              {tab.badge}
                            </Badge>
                          )}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Tabs content */}
              <div className="flex-1 overflow-auto">
                <AnimatePresence mode="wait">
                  {visibleTabs.map((tab) => (
                    <TabsContent
                      key={tab.id}
                      value={tab.id}
                      className="m-0 h-full data-[state=inactive]:hidden"
                      forceMount
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="p-6"
                      >
                        {tab.content}
                      </motion.div>
                    </TabsContent>
                  ))}
                </AnimatePresence>
              </div>
            </Tabs>
          ) : (
            <div className="flex-1 overflow-auto p-6">{children}</div>
          )}
        </div>

        {/* Footer */}
        {footerActions && footerActions.length > 0 && (
          <FooterActions actions={footerActions} can={can} />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// Preset Tab Components
// ============================================================================

interface DetailsSectionProps {
  /** Section title */
  title?: string;
  /** Fields to display */
  fields: Array<{
    label: string;
    value: React.ReactNode;
    icon?: LucideIcon;
  }>;
  /** Section class name */
  className?: string;
}

export function DetailsSection({ title, fields, className }: DetailsSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {title && <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>}
      <div className="space-y-3">
        {fields.map((field, index) => {
          const Icon = field.icon;
          return (
            <div key={index} className="flex items-start gap-3">
              {Icon && (
                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="text-sm mt-0.5">{field.value ?? "—"}</dd>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ActivityItemProps {
  /** Avatar/icon element */
  avatar?: React.ReactNode;
  /** Activity title */
  title: string;
  /** Activity description */
  description?: string;
  /** Timestamp */
  timestamp: string;
}

export function ActivityItem({ avatar, title, description, timestamp }: ActivityItemProps) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
      </div>
    </div>
  );
}

export function ActivityList({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
