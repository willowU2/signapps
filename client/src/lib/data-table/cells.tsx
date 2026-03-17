/**
 * Cell Renderers for GenericDataTable
 *
 * Composants de rendu de cellules basés sur le type configuré.
 */

"use client";

import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ColumnConfig } from "./types";

// ============================================================================
// Text Cell
// ============================================================================

export function TextCell<TData>({
  value,
  row,
  config,
}: {
  value: unknown;
  row: TData;
  config: ColumnConfig<TData>;
}) {
  const displayValue = config.format ? config.format(value, row) : String(value ?? "");
  return <span className="truncate">{displayValue}</span>;
}

// ============================================================================
// Date Cell
// ============================================================================

export function DateCell<TData>({
  value,
  row,
  config,
}: {
  value: unknown;
  row: TData;
  config: ColumnConfig<TData>;
}) {
  if (!value) return <span className="text-muted-foreground">—</span>;

  const date = typeof value === "string" ? parseISO(value) : value as Date;
  if (!isValid(date)) return <span className="text-muted-foreground">—</span>;

  const displayValue = config.format
    ? config.format(value, row)
    : format(date, "dd MMM yyyy", { locale: fr });

  return <span>{displayValue}</span>;
}

// ============================================================================
// DateTime Cell
// ============================================================================

export function DateTimeCell<TData>({
  value,
  row,
  config,
}: {
  value: unknown;
  row: TData;
  config: ColumnConfig<TData>;
}) {
  if (!value) return <span className="text-muted-foreground">—</span>;

  const date = typeof value === "string" ? parseISO(value) : value as Date;
  if (!isValid(date)) return <span className="text-muted-foreground">—</span>;

  const displayValue = config.format
    ? config.format(value, row)
    : format(date, "dd MMM yyyy HH:mm", { locale: fr });

  const relativeTime = formatDistanceToNow(date, { addSuffix: true, locale: fr });

  return (
    <div className="flex flex-col">
      <span className="text-sm">{displayValue}</span>
      <span className="text-xs text-muted-foreground">{relativeTime}</span>
    </div>
  );
}

// ============================================================================
// Badge Cell
// ============================================================================

export function BadgeCell<TData>({
  value,
  row,
  config,
}: {
  value: unknown;
  row: TData;
  config: ColumnConfig<TData>;
}) {
  const displayValue = config.format ? config.format(value, row) : String(value ?? "");
  const variant = config.badgeVariants?.[String(value)] ?? "outline";

  return <Badge variant={variant}>{displayValue}</Badge>;
}

// ============================================================================
// Avatar Cell
// ============================================================================

export function AvatarCell<TData>({
  value,
  row,
  config,
}: {
  value: unknown;
  row: TData;
  config: ColumnConfig<TData>;
}) {
  const avatarUrl = String(value ?? "");
  const displayName = config.format ? config.format(value, row) : "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarUrl} alt={displayName} />
        <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
      </Avatar>
      {displayName && <span className="truncate">{displayName}</span>}
    </div>
  );
}

// ============================================================================
// Cell Factory
// ============================================================================

export function renderCell<TData>(
  value: unknown,
  row: TData,
  config: ColumnConfig<TData>
): React.ReactNode {
  // Custom renderer takes priority
  if (config.cell) {
    return config.cell({ row, value });
  }

  // Use cell type to determine renderer
  switch (config.cellType) {
    case "date":
      return <DateCell value={value} row={row} config={config} />;
    case "datetime":
      return <DateTimeCell value={value} row={row} config={config} />;
    case "badge":
      return <BadgeCell value={value} row={row} config={config} />;
    case "avatar":
      return <AvatarCell value={value} row={row} config={config} />;
    case "text":
    default:
      return <TextCell value={value} row={row} config={config} />;
  }
}
