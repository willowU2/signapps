"use client";

/**
 * Employee List Component
 *
 * Data table for employee management with filtering and actions.
 */

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
} from "@tanstack/react-table";
import {
  MoreHorizontal,
  ArrowUpDown,
  UserCircle,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Edit,
  Trash2,
  Link,
  Unlink,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EmployeeWithDetails,
  EmployeeStatus,
  ContractType,
} from "@/types/workforce";

// Status badge variants
const STATUS_VARIANTS: Record<
  EmployeeStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  active: { label: "Actif", variant: "default" },
  on_leave: { label: "En congé", variant: "secondary" },
  suspended: { label: "Suspendu", variant: "destructive" },
  terminated: { label: "Terminé", variant: "outline" },
};

// Contract type labels
const CONTRACT_LABELS: Record<ContractType, string> = {
  "full-time": "CDI",
  "part-time": "Temps partiel",
  contract: "CDD",
  intern: "Stage",
  temporary: "Intérim",
};

interface EmployeeListProps {
  employees: EmployeeWithDetails[];
  onEdit?: (employee: EmployeeWithDetails) => void;
  onDelete?: (employee: EmployeeWithDetails) => void;
  onSelect?: (employee: EmployeeWithDetails | null) => void;
  onLinkUser?: (employee: EmployeeWithDetails) => void;
  onUnlinkUser?: (employee: EmployeeWithDetails) => void;
  className?: string;
}

export function EmployeeList({
  employees,
  onEdit,
  onDelete,
  onSelect,
  onLinkUser,
  onUnlinkUser,
  className,
}: EmployeeListProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // Column definitions
  const columns: ColumnDef<EmployeeWithDetails>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Tout sélectionner"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Sélectionner la ligne"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Employé
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const employee = row.original;
        const initials =
          `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {employee.first_name} {employee.last_name}
              </div>
              {employee.employee_number && (
                <div className="text-xs text-muted-foreground">
                  #{employee.employee_number}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "org_node_name",
      header: "Unité",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          {row.getValue("org_node_name")}
        </div>
      ),
    },
    {
      accessorKey: "function_names",
      header: "Fonctions",
      cell: ({ row }) => {
        const functions = row.getValue("function_names") as string[];
        return (
          <div className="flex flex-wrap gap-1">
            {functions.slice(0, 2).map((fn) => (
              <Badge key={fn} variant="secondary" className="text-xs">
                {fn}
              </Badge>
            ))}
            {functions.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{functions.length - 2}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "contract_type",
      header: "Contrat",
      cell: ({ row }) => {
        const type = row.getValue("contract_type") as ContractType;
        return <span className="text-sm">{CONTRACT_LABELS[type] || type}</span>;
      },
    },
    {
      accessorKey: "fte_ratio",
      header: "ETP",
      cell: ({ row }) => {
        const ratio = row.getValue("fte_ratio") as number;
        return (
          <span className="text-sm font-medium">
            {Math.round(ratio * 100)}%
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => {
        const status = row.getValue("status") as EmployeeStatus;
        const config = STATUS_VARIANTS[status];
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      accessorKey: "user_id",
      header: "Compte",
      cell: ({ row }) => {
        const hasUser = !!row.original.user_id;
        return (
          <Badge variant={hasUser ? "default" : "outline"} className="gap-1">
            {hasUser ? (
              <>
                <Link className="h-3 w-3" />
                Lié
              </>
            ) : (
              <>
                <Unlink className="h-3 w-3" />
                Non lié
              </>
            )}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEdit?.(employee)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              {employee.user_id ? (
                <DropdownMenuItem onClick={() => onUnlinkUser?.(employee)}>
                  <Unlink className="mr-2 h-4 w-4" />
                  Délier le compte
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onLinkUser?.(employee)}>
                  <Link className="mr-2 h-4 w-4" />
                  Lier un compte
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete?.(employee)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: employees,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => onSelect?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold">Aucun employe</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Aucun employe ne correspond aux criteres de recherche.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} sur{" "}
          {table.getFilteredRowModel().rows.length} ligne(s) sélectionnée(s)
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}

export type { EmployeeListProps };
