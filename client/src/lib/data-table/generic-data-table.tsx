"use client";

/**
 * Generic DataTable Component
 *
 * Composant de table de données générique basé sur TanStack Table.
 * Utilise EntityConfig pour la configuration automatique.
 */

import { SpinnerInfinity } from "spinners-react";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MoreHorizontal,
  LayoutGrid,
  Table as TableIcon,
  Kanban,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  usePermissions,
  type Resource,
  type ResourceAction,
} from "@/lib/permissions";

import type {
  EntityConfig,
  ColumnConfig,
  ActionConfig,
  ViewMode,
  GenericDataTableProps,
} from "./types";
import { renderCell } from "./cells";
import {
  ColumnSelector,
  useColumnPreferences,
  applyPreferencesToVisibility,
  type ColumnPreference,
} from "./column-selector";

// ============================================================================
// Permission Helper
// ============================================================================

/**
 * Parse une permission au format "resource:action" et vérifie si l'utilisateur l'a.
 * @example parsePermission("users:read", can) → can("users", "read")
 */
function checkPermission(
  requiredPermission: string | undefined,
  can: (
    resource: Resource,
    action: ResourceAction | ResourceAction[],
  ) => boolean,
): boolean {
  if (!requiredPermission) return true; // Pas de permission requise = visible

  const parts = requiredPermission.split(":");
  if (parts.length !== 2) {
    console.warn(
      `Invalid permission format: ${requiredPermission}. Expected "resource:action"`,
    );
    return true;
  }

  const [resource, action] = parts as [Resource, ResourceAction];
  return can(resource, action);
}

// ============================================================================
// Column Definition Builder
// ============================================================================

function buildColumnDefs<TData>(
  config: EntityConfig<TData>,
  actions: ActionConfig<TData>[] | undefined,
  can: (
    resource: Resource,
    action: ResourceAction | ResourceAction[],
  ) => boolean,
  columnOrder?: string[],
): ColumnDef<TData>[] {
  const columns: ColumnDef<TData>[] = [];

  // Selection column
  if (config.enableRowSelection) {
    columns.push({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Sélectionner tout"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Sélectionner la ligne"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    });
  }

  // Data columns - filter by permission
  let visibleColumns = config.columns.filter((col) =>
    checkPermission(col.requiredPermission, can),
  );

  // Sort columns by custom order if provided
  if (columnOrder && columnOrder.length > 0) {
    const orderMap = new Map(columnOrder.map((id, index) => [id, index]));
    visibleColumns = [...visibleColumns].sort((a, b) => {
      const orderA = orderMap.get(a.id) ?? 999;
      const orderB = orderMap.get(b.id) ?? 999;
      return orderA - orderB;
    });
  }

  for (const colConfig of visibleColumns) {
    const col: ColumnDef<TData> = {
      id: colConfig.id,
      accessorKey: colConfig.accessorKey,
      accessorFn: colConfig.accessorFn,
      header: ({ column }) => {
        if (!colConfig.sortable) {
          return <span>{colConfig.label}</span>;
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {colConfig.label}
            {column.getIsSorted() === "asc" && (
              <ChevronDown className="ml-1 h-4 w-4 rotate-180" />
            )}
            {column.getIsSorted() === "desc" && (
              <ChevronDown className="ml-1 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row, getValue }) => {
        const value = getValue();
        return renderCell(value, row.original, colConfig);
      },
      enableSorting: colConfig.sortable ?? false,
      enableHiding: colConfig.hideable ?? true,
      size: typeof colConfig.width === "number" ? colConfig.width : undefined,
    };

    columns.push(col);
  }

  // Actions column - filter actions by permission
  const rowActions = actions ?? config.actions;
  const permittedActions = rowActions?.filter((action) =>
    checkPermission(action.requiredPermission, can),
  );

  if (permittedActions && permittedActions.length > 0) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionsCell row={row} actions={permittedActions} />,
      enableSorting: false,
      enableHiding: false,
      size: 60,
    });
  }

  return columns;
}

// ============================================================================
// Actions Cell
// ============================================================================

function ActionsCell<TData>({
  row,
  actions,
}: {
  row: Row<TData>;
  actions: ActionConfig<TData>[];
}) {
  const visibleActions = actions.filter(
    (action) => !action.visible || action.visible(row.original),
  );

  if (visibleActions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {visibleActions.map((action, index) => {
          const Icon = action.icon;
          const isDisabled = action.disabled?.(row.original) ?? false;

          return (
            <React.Fragment key={action.id}>
              {index > 0 &&
                action.variant === "destructive" &&
                visibleActions[index - 1].variant !== "destructive" && (
                  <DropdownMenuSeparator />
                )}
              <DropdownMenuItem
                onClick={() => action.onClick(row.original)}
                disabled={isDisabled}
                className={cn(
                  action.variant === "destructive" &&
                    "text-destructive focus:text-destructive",
                )}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
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
// View Mode Switcher
// ============================================================================

function ViewModeSwitcher({
  viewModes,
  currentMode,
  onChange,
}: {
  viewModes: ViewMode[];
  currentMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  if (viewModes.length <= 1) return null;

  const icons: Record<ViewMode, React.ReactNode> = {
    table: <TableIcon className="h-4 w-4" />,
    cards: <LayoutGrid className="h-4 w-4" />,
    kanban: <Kanban className="h-4 w-4" />,
  };

  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/50 p-1">
      {viewModes.map((mode) => (
        <Button
          key={mode}
          variant={currentMode === mode ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onChange(mode)}
          title={
            mode === "table"
              ? "Vue tableau"
              : mode === "cards"
                ? "Vue cartes"
                : "Vue Kanban"
          }
        >
          {icons[mode]}
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Cards View
// ============================================================================

function CardsView<TData>({
  data,
  config,
  onRowClick,
}: {
  data: TData[];
  config: EntityConfig<TData>;
  onRowClick?: (row: TData) => void;
}) {
  const Icon = config.icon;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {data.map((row, index) => {
          const id = config.getRowId?.(row) ?? String(index);
          const primaryCol = config.columns.find(
            (c) => c.id === config.primarySearchColumn,
          );
          const title = primaryCol?.accessorKey
            ? String(
                (row as Record<string, unknown>)[primaryCol.accessorKey] ?? "",
              )
            : "";

          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, delay: index * 0.02 }}
              className={cn(
                "rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md",
                onRowClick && "cursor-pointer hover:border-primary/50",
              )}
              onClick={() => onRowClick?.(row)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
                  <h3 className="font-medium">{title}</h3>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {config.columns.slice(1, 4).map((col) => {
                  const value = col.accessorKey
                    ? (row as Record<string, unknown>)[col.accessorKey]
                    : col.accessorFn?.(row);
                  return (
                    <div
                      key={col.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{col.label}</span>
                      <span>{renderCell(value, row, col)}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GenericDataTable<TData>({
  config,
  data,
  isLoading,
  error,
  actions,
  viewMode: controlledViewMode,
  onViewModeChange,
  searchValue: controlledSearchValue,
  onSearchChange,
  emptyState,
  toolbarContent,
  toolbarActions,
  className,
}: GenericDataTableProps<TData>) {
  // Permissions hook
  const { can } = usePermissions();

  // Column preferences (persisted to localStorage)
  const [columnPreferences, setColumnPreferences] = useColumnPreferences(
    config.entityType,
    config.columns,
  );

  // State
  const [internalViewMode, setInternalViewMode] = React.useState<ViewMode>(
    config.defaultViewMode ?? "table",
  );
  const [internalSearchValue, setInternalSearchValue] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>(
    config.defaultSort ? [config.defaultSort] : [],
  );
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [rowSelection, setRowSelection] = React.useState({});

  // Derive visibility from preferences
  const columnVisibility = React.useMemo<VisibilityState>(
    () => applyPreferencesToVisibility(columnPreferences),
    [columnPreferences],
  );

  // Handle visibility change from table
  const handleColumnVisibilityChange = React.useCallback(
    (
      updaterOrValue:
        | VisibilityState
        | ((old: VisibilityState) => VisibilityState),
    ) => {
      const newVisibility =
        typeof updaterOrValue === "function"
          ? updaterOrValue(columnVisibility)
          : updaterOrValue;

      // Update preferences to match new visibility
      const newPreferences = columnPreferences.map((pref) => ({
        ...pref,
        visible: newVisibility[pref.id] ?? pref.visible,
      }));

      setColumnPreferences(newPreferences);
    },
    [columnVisibility, columnPreferences, setColumnPreferences],
  );

  // Controlled vs uncontrolled
  const viewMode = controlledViewMode ?? internalViewMode;
  const handleViewModeChange = (mode: ViewMode) => {
    setInternalViewMode(mode);
    onViewModeChange?.(mode);
  };

  const searchValue = controlledSearchValue ?? internalSearchValue;
  const handleSearchChange = (value: string) => {
    setInternalSearchValue(value);
    onSearchChange?.(value);
    // Apply filter to primary search column
    if (config.primarySearchColumn) {
      table.getColumn(config.primarySearchColumn)?.setFilterValue(value);
    }
  };

  // Get column order from preferences
  const columnOrder = React.useMemo(
    () => columnPreferences.sort((a, b) => a.order - b.order).map((p) => p.id),
    [columnPreferences],
  );

  // Build columns with permission filtering and custom order
  const columns = React.useMemo(
    () => buildColumnDefs(config, actions, can, columnOrder),
    [config, actions, can, columnOrder],
  );

  // Table instance
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    getRowId: config.getRowId,
    initialState: {
      pagination: {
        pageSize: config.defaultPageSize ?? 25,
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // Error state
  if (error) {
    return (
      <div className={cn("rounded-lg border bg-destructive/10 p-8", className)}>
        <EmptyState
          icon={Inbox}
          title="Erreur"
          description={error}
          className="border-none bg-transparent"
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          {/* Search */}
          {config.primarySearchColumn && (
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Rechercher ${config.pluralName.toLowerCase()}...`}
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 bg-background/50 backdrop-blur-sm"
              />
            </div>
          )}
          {toolbarContent}
        </div>

        <div className="flex items-center gap-2">
          {toolbarActions}

          {/* View mode switcher */}
          {config.viewModes && (
            <ViewModeSwitcher
              viewModes={config.viewModes}
              currentMode={viewMode}
              onChange={handleViewModeChange}
            />
          )}

          {/* Column customization */}
          <ColumnSelector
            columns={config.columns}
            preferences={columnPreferences}
            onPreferencesChange={setColumnPreferences}
            entityType={config.entityType}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="rounded-lg border bg-card/40 p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="h-5 w-5 "
            />
            <span>Chargement...</span>
          </div>
        </div>
      ) : viewMode === "cards" ? (
        /* Cards View */
        data.length === 0 ? (
          <EmptyState
            icon={emptyState?.icon ?? config.icon ?? Inbox}
            title={
              emptyState?.title ?? `Aucun ${config.singularName.toLowerCase()}`
            }
            description={
              emptyState?.description ??
              `Il n'y a pas encore de ${config.pluralName.toLowerCase()}.`
            }
            action={
              emptyState?.action ? (
                <Button onClick={emptyState.action.onClick}>
                  {emptyState.action.label}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <CardsView
            data={table.getRowModel().rows.map((r) => r.original)}
            config={config}
            onRowClick={config.onRowClick}
          />
        )
      ) : (
        /* Table View */
        <div className="rounded-xl border bg-card/40 backdrop-blur-md shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="hover:bg-transparent border-b-muted/50"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-muted-foreground font-medium"
                      style={{
                        width:
                          header.getSize() !== 150
                            ? header.getSize()
                            : undefined,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted/50 group",
                        config.onRowClick && "cursor-pointer",
                      )}
                      onClick={() => config.onRowClick?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-64 p-0">
                      <EmptyState
                        icon={emptyState?.icon ?? config.icon ?? Inbox}
                        title={
                          emptyState?.title ??
                          `Aucun ${config.singularName.toLowerCase()}`
                        }
                        description={
                          emptyState?.description ??
                          `Il n'y a pas encore de ${config.pluralName.toLowerCase()}.`
                        }
                        action={
                          emptyState?.action ? (
                            <Button onClick={emptyState.action.onClick}>
                              {emptyState.action.label}
                            </Button>
                          ) : undefined
                        }
                        className="border-none bg-transparent h-full"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && data.length > 0 && (
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {config.enableRowSelection && (
              <span>
                {table.getFilteredSelectedRowModel().rows.length} sur{" "}
                {table.getFilteredRowModel().rows.length} sélectionné(s)
              </span>
            )}
            <span>
              Page {table.getState().pagination.pageIndex + 1} sur{" "}
              {table.getPageCount()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {config.pageSizeOptions && (
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config.pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
