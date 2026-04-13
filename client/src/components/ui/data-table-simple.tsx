"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Input } from "./input";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Column<T> {
  /** Unique column key (also used as fallback property accessor) */
  key: string;
  /** Column header label */
  label: string;
  /** Custom cell renderer — falls back to String(item[key]) */
  render?: (item: T) => React.ReactNode;
  /** Additional className for both th and td */
  className?: string;
}

interface DataTableSimpleProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Row data */
  data: T[];
  /** Show skeleton loading state */
  isLoading?: boolean;
  /** Show error state */
  isError?: boolean;
  /** Retry handler shown in error state */
  onRetry?: () => void;
  /** Controlled search value */
  searchValue?: string;
  /** Search input change handler (renders search bar when provided) */
  onSearchChange?: (value: string) => void;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Icon shown in the empty state */
  emptyIcon?: React.ReactNode;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Toolbar actions (right side, shown alongside search) */
  actions?: React.ReactNode;
  /** Stable key extractor for rows */
  getRowKey: (item: T) => string;
  /** Optional row click handler — adds cursor-pointer */
  onRowClick?: (item: T) => void;
  /** Additional className for the root wrapper */
  className?: string;
}

/**
 * Generic typed data table with toolbar, loading, error, and empty states.
 *
 * Provides a consistent table layout across all admin pages.
 * Pair with {@link LoadingState} and {@link ErrorState} for full lifecycle coverage.
 *
 * @example
 * ```tsx
 * <DataTableSimple
 *   columns={[
 *     { key: "name", label: "Nom" },
 *     { key: "email", label: "Email" },
 *     { key: "role", label: "Rôle", render: (u) => <Badge>{u.role}</Badge> },
 *   ]}
 *   data={users}
 *   isLoading={isLoading}
 *   isError={isError}
 *   onRetry={refetch}
 *   getRowKey={(u) => u.id}
 *   searchValue={search}
 *   onSearchChange={setSearch}
 *   emptyTitle="Aucun utilisateur"
 *   actions={<Button>Ajouter</Button>}
 * />
 * ```
 */
export function DataTableSimple<T>({
  columns,
  data,
  isLoading,
  isError,
  onRetry,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  emptyIcon,
  emptyTitle = "Aucune donnée",
  emptyDescription,
  actions,
  getRowKey,
  onRowClick,
  className,
}: DataTableSimpleProps<T>) {
  if (isLoading) {
    return <LoadingState variant="skeleton" />;
  }

  if (isError) {
    return <ErrorState onRetry={onRetry} />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      {(onSearchChange ?? actions) && (
        <div className="flex items-center justify-between gap-4">
          {onSearchChange && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 pl-9"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Empty state */}
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          {emptyIcon && <div className="mb-3 opacity-30">{emptyIcon}</div>}
          <p className="text-sm font-medium">{emptyTitle}</p>
          {emptyDescription && (
            <p className="text-xs mt-1">{emptyDescription}</p>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn("text-xs", col.className)}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow
                  key={getRowKey(item)}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn("text-sm", col.className)}
                    >
                      {col.render
                        ? col.render(item)
                        : String(
                            (item as Record<string, unknown>)[col.key] ?? "",
                          )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Row count */}
      {data.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {data.length} élément{data.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
