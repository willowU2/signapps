"use client";

import { SpinnerInfinity } from "spinners-react";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableSkeleton } from "@/components/ui/skeleton-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Key,
  Shield,
  User as UserIcon,
  Users,
  Link as LinkIcon,
  Check,
  X,
  RefreshCw,
  Download,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileWarning,
  History,
} from "lucide-react";
import {
  usersApi,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  auditApi,
  AuditLog,
  AuditAction,
  AuditLogFilters,
  UserImportRow,
  UserImportResult,
} from "@/lib/api";
import { toast } from "sonner";
import { useUsers } from "@/hooks/use-users";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { UserSheet } from "@/components/admin/user-sheet";
import { usePageTitle } from "@/hooks/use-page-title";

const roleLabels: Record<number, string> = {
  0: "Admin",
  1: "User",
  2: "Viewer",
};

const roleFromString = (role: string): number => {
  const lower = role.toLowerCase().trim();
  if (lower === "admin" || lower === "0") return 0;
  if (lower === "viewer" || lower === "2") return 2;
  return 1; // Default to User
};

const actionLabels: Record<AuditAction, string> = {
  login: "Login",
  logout: "Logout",
  login_failed: "Login Failed",
  mfa_enabled: "MFA Enabled",
  mfa_disabled: "MFA Disabled",
  password_changed: "Password Changed",
  password_reset: "Password Reset",
  user_created: "User Created",
  user_updated: "User Updated",
  user_deleted: "User Supprimé",
  role_changed: "Role Changed",
  group_created: "Group Created",
  group_updated: "Group Updated",
  group_deleted: "Group Supprimé",
  member_added: "Member Added",
  member_removed: "Member Retiré",
  permission_changed: "Permission Changed",
  api_key_created: "API Key Created",
  api_key_revoked: "API Key Revoked",
};

const allActions: AuditAction[] = [
  "login",
  "logout",
  "login_failed",
  "mfa_enabled",
  "mfa_disabled",
  "password_changed",
  "password_reset",
  "user_created",
  "user_updated",
  "user_deleted",
  "role_changed",
  "group_created",
  "group_updated",
  "group_deleted",
  "member_added",
  "member_removed",
  "permission_changed",
  "api_key_created",
  "api_key_revoked",
];

// CSV parsing helper
function parseCSV(text: string): string[][] {
  const lines = text.split("\n").filter((line) => line.trim());
  return lines.map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
}

// CSV generation helper
function generateCSV(users: User[]): string {
  const headers = ["username", "email", "role", "mfa_enabled", "created_at"];
  const rows = users.map((user) => [
    user.username,
    user.email,
    roleLabels[user.role] || "User",
    user.mfa_enabled ? "true" : "false",
    user.id, // Using ID as placeholder since User type doesn't have created_at
  ]);

  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");
}

// Import Users Dialog Component
interface ImportUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  existingUsers: User[];
}

function ImportUsersDialog({
  open,
  onOpenChange,
  onImportComplete,
  existingUsers,
}: ImportUsersDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedUsers, setParsedUsers] = useState<UserImportRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    { row: number; field: string; error: string }[]
  >([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<UserImportResult | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".csv")) {
      processFile(droppedFile);
    } else {
      toast.error("Please upload a CSV file");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (csvFile: File) => {
    setFile(csvFile);
    setImportResult(null);

    try {
      const text = await csvFile.text();
      const rows = parseCSV(text);

      if (rows.length < 2) {
        toast.error(
          "CSV file must have a header row and at least one data row",
        );
        return;
      }

      const headers = rows[0].map((h) => h.toLowerCase().trim());
      const usernameIdx = headers.indexOf("username");
      const emailIdx = headers.indexOf("email");
      const roleIdx = headers.indexOf("role");
      const displayNameIdx = headers.indexOf("display_name");

      if (usernameIdx === -1 || emailIdx === -1) {
        toast.error('CSV must have "username" and "email" columns');
        return;
      }

      const users: UserImportRow[] = [];
      const errors: { row: number; field: string; error: string }[] = [];
      const existingUsernames = new Set(
        existingUsers.map((u) => u.username.toLowerCase()),
      );
      const existingEmails = new Set(
        existingUsers.filter((u) => u.email).map((u) => u.email!.toLowerCase()),
      );
      const seenUsernames = new Set<string>();
      const seenEmails = new Set<string>();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const username = row[usernameIdx]?.trim() || "";
        const email = row[emailIdx]?.trim() || "";
        const role = roleIdx !== -1 ? row[roleIdx]?.trim() || "User" : "User";
        const displayName =
          displayNameIdx !== -1 ? row[displayNameIdx]?.trim() : undefined;

        // Validation
        if (!username) {
          errors.push({
            row: i + 1,
            field: "username",
            error: "Username is required",
          });
        } else if (existingUsernames.has(username.toLowerCase())) {
          errors.push({
            row: i + 1,
            field: "username",
            error: `Username "${username}" already exists`,
          });
        } else if (seenUsernames.has(username.toLowerCase())) {
          errors.push({
            row: i + 1,
            field: "username",
            error: `Duplicate username "${username}" in file`,
          });
        }

        if (!email) {
          errors.push({
            row: i + 1,
            field: "email",
            error: "Email is required",
          });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({
            row: i + 1,
            field: "email",
            error: "Email invalide format",
          });
        } else if (existingEmails.has(email.toLowerCase())) {
          errors.push({
            row: i + 1,
            field: "email",
            error: `Email "${email}" already exists`,
          });
        } else if (seenEmails.has(email.toLowerCase())) {
          errors.push({
            row: i + 1,
            field: "email",
            error: `Duplicate email "${email}" in file`,
          });
        }

        seenUsernames.add(username.toLowerCase());
        seenEmails.add(email.toLowerCase());

        users.push({
          username,
          email,
          role,
          display_name: displayName,
        });
      }

      setParsedUsers(users);
      setValidationErrors(errors);
    } catch {
      toast.error("Failed to parse CSV file");
    }
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      toast.error("Please fix validation errors before importing");
      return;
    }

    setImporting(true);
    const result: UserImportResult = {
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    for (let i = 0; i < parsedUsers.length; i++) {
      const user = parsedUsers[i];
      try {
        // Generate a temporary password
        const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;

        await usersApi.create({
          username: user.username,
          email: user.email,
          password: tempPassword,
          display_name: user.display_name,
          role: roleFromString(user.role),
        });
        result.success++;
      } catch (error: unknown) {
        result.failed++;
        const errorMessage =
          error instanceof Error
            ? error.message
            : (error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message || "Unknown error";
        if (
          errorMessage.includes("duplicate") ||
          errorMessage.includes("exists")
        ) {
          result.duplicates++;
        }
        result.errors.push({
          row: i + 2,
          username: user.username,
          error: errorMessage,
        });
      }
    }

    setImportResult(result);
    setImporting(false);

    if (result.success > 0) {
      toast.success(`Successfully imported ${result.success} user(s)`);
      onImportComplete();
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedUsers([]);
    setValidationErrors([]);
    setImportResult(null);
    onOpenChange(false);
  };

  const validUsers = parsedUsers.filter(
    (_, i) => !validationErrors.some((e) => e.row === i + 2),
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Users from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: username, email, role (optional),
            display_name (optional)
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
            `}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop your CSV file here, or
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              CSV format: username, email, role, display_name
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* File Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {parsedUsers.length} user(s) found, {validUsers} valid
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setParsedUsers([]);
                  setValidationErrors([]);
                  setImportResult(null);
                }}
              >
                Change File
              </Button>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {validationErrors.length} validation error(s)
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {validationErrors.slice(0, 10).map((error, i) => (
                    <p key={i} className="text-xs text-destructive">
                      Row {error.row}: {error.error}
                    </p>
                  ))}
                  {validationErrors.length > 10 && (
                    <p className="text-xs text-destructive">
                      ...and {validationErrors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div
                className={`rounded-lg border p-3 ${
                  importResult.failed > 0
                    ? "border-yellow-500/50 bg-yellow-500/10"
                    : "border-green-500/50 bg-green-500/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {importResult.failed > 0 ? (
                    <FileWarning className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-sm font-medium">Import Complete</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-green-600 font-medium">
                      {importResult.success}
                    </span>{" "}
                    imported
                  </div>
                  <div>
                    <span className="text-red-600 font-medium">
                      {importResult.failed}
                    </span>{" "}
                    failed
                  </div>
                  <div>
                    <span className="text-yellow-600 font-medium">
                      {importResult.duplicates}
                    </span>{" "}
                    duplicates
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 max-h-24 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((error, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        Row {error.row} ({error.username}): {error.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Preview Table */}
            {parsedUsers.length > 0 && !importResult && (
              <div className="flex-1 overflow-auto overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedUsers.slice(0, 50).map((user, i) => {
                      const rowErrors = validationErrors.filter(
                        (e) => e.row === i + 2,
                      );
                      const hasError = rowErrors.length > 0;
                      return (
                        <TableRow
                          key={i}
                          className={hasError ? "bg-destructive/5" : ""}
                        >
                          <TableCell className="text-muted-foreground">
                            {i + 1}
                          </TableCell>
                          <TableCell
                            className={hasError ? "text-destructive" : ""}
                          >
                            {user.username || "-"}
                          </TableCell>
                          <TableCell
                            className={hasError ? "text-destructive" : ""}
                          >
                            {user.email || "-"}
                          </TableCell>
                          <TableCell>{user.role}</TableCell>
                          <TableCell>
                            {hasError ? (
                              <Badge variant="destructive" className="text-xs">
                                Error
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Valid
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {parsedUsers.length > 50 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    Showing first 50 of {parsedUsers.length} users
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? "Fermer" : "Annuler"}
          </Button>
          {!importResult && file && (
            <Button
              onClick={handleImport}
              disabled={importing || validUsers === 0}
            >
              {importing && (
                <SpinnerInfinity
                  size={24}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="mr-2 h-4 w-4 "
                />
              )}
              Import {validUsers} User(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export Users Button Component
interface ExportUsersButtonProps {
  users: User[];
}

function ExportUsersButton({ users }: ExportUsersButtonProps) {
  const handleExport = () => {
    const csv = generateCSV(users);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Users exported successfully");
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={users.length === 0}
    >
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}

// Audit Log Table Component
interface AuditLogTableProps {
  users: User[];
}

function AuditLogTable({ users }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 20,
    offset: 0,
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await auditApi.list(filters);
      setLogs(response.data?.logs || []);
      setTotal(response.data?.total || 0);
    } catch {
      // Show empty list on error
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newOffset: number) => {
    setFilters((prev) => ({ ...prev, offset: newOffset }));
  };

  const handleFilterChange = (
    key: keyof AuditLogFilters,
    value: string | undefined,
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      offset: 0, // Reset to first page on filter change
    }));
  };

  const clearFilters = () => {
    setFilters({ limit: 20, offset: 0 });
  };

  const currentPage =
    Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1;
  const totalPages = Math.ceil(total / (filters.limit || 20));

  const getActionBadgeVariant = (action: AuditAction) => {
    if (action.includes("failed") || action.includes("deleted"))
      return "destructive";
    if (action.includes("created") || action === "login") return "default";
    return "secondary";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? "bg-muted" : ""}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
        {(filters.username ||
          filters.action ||
          filters.start_date ||
          filters.end_date) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-2">
                <Label>User</Label>
                <Select
                  value={filters.username || "all"}
                  onValueChange={(v) =>
                    handleFilterChange("username", v === "all" ? undefined : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.username}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select
                  value={filters.action || "all"}
                  onValueChange={(v) =>
                    handleFilterChange(
                      "action",
                      v === "all" ? undefined : (v as AuditAction),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {allActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {actionLabels[action]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={filters.start_date || ""}
                  onChange={(e) =>
                    handleFilterChange("start_date", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={filters.end_date || ""}
                  onChange={(e) =>
                    handleFilterChange("end_date", e.target.value)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mb-4" />
              <p>No audit logs found</p>
              {(filters.username ||
                filters.action ||
                filters.start_date ||
                filters.end_date) && (
                <Button variant="link" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {formatDate(log.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                          <UserIcon className="h-3 w-3 text-primary" />
                        </div>
                        {log.username}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.ip_address}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {log.details ? (
                        <span className="text-sm text-muted-foreground truncate block">
                          {JSON.stringify(log.details).slice(0, 50)}
                          {JSON.stringify(log.details).length > 50 && "..."}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(filters.offset || 0) + 1} to{" "}
            {Math.min((filters.offset || 0) + (filters.limit || 20), total)} of{" "}
            {total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handlePageChange((filters.offset || 0) - (filters.limit || 20))
              }
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handlePageChange((filters.offset || 0) + (filters.limit || 20))
              }
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  usePageTitle("Utilisateurs");
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: loading } = useUsers();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    user: User | null;
  }>({
    open: false,
    user: null,
  });
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    open: boolean;
    user: User | null;
  }>({
    open: false,
    user: null,
  });
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("users");

  const refreshUsers = () =>
    queryClient.invalidateQueries({ queryKey: ["users"] });

  const handleCreate = () => {
    setEditingUser(null);
    setSheetOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setSheetOpen(true);
  };

  const handleSave = async (data: CreateUserRequest | UpdateUserRequest) => {
    setSaving(true);
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, data as UpdateUserRequest);
        toast.success("User updated successfully");
      } else {
        await usersApi.create(data as CreateUserRequest);
        toast.success("User created successfully");
      }
      setSheetOpen(false);
      refreshUsers();
    } catch {
      toast.error(
        editingUser
          ? "Impossible de mettre à jour user"
          : "Impossible de créer user",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.user) return;

    try {
      await usersApi.delete(deleteDialog.user.id);
      toast.success("User deleted successfully");
      refreshUsers();
    } catch {
      toast.error("Impossible de supprimer user");
    } finally {
      setDeleteDialog({ open: false, user: null });
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordDialog.user || !newPassword) return;

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setResettingPassword(true);
    try {
      await usersApi.update(resetPasswordDialog.user.id, {
        password: newPassword,
      });
      toast.success("Password reset successfully");
      setResetPasswordDialog({ open: false, user: null });
      setNewPassword("");
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const openResetPasswordDialog = (user: User) => {
    setNewPassword("");
    setResetPasswordDialog({ open: true, user });
  };

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "username",
      header: "User",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <UserIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {user.display_name || user.username}
              </p>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.original.role;
        return (
          <Badge
            variant={role === 0 ? "default" : "secondary"}
            className={role === 0 ? "bg-red-500/10 text-red-600" : ""}
          >
            {roleLabels[role] || "Unknown"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "auth_provider",
      header: "Provider",
      cell: ({ row }) => {
        return row.original.auth_provider === "ldap" ? (
          <Badge variant="outline" className="gap-1">
            <LinkIcon className="h-3 w-3" />
            LDAP
          </Badge>
        ) : (
          <Badge variant="outline">Local</Badge>
        );
      },
    },
    {
      accessorKey: "mfa_enabled",
      header: "MFA",
      cell: ({ row }) => {
        return row.original.mfa_enabled ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(user)}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openResetPasswordDialog(user)}
                disabled={user.auth_provider === "ldap"}
              >
                <Key className="mr-2 h-4 w-4" />
                Réinitialiser le mot de passe
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteDialog({ open: true, user })}
                disabled={user.username === "admin"}
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

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === 0).length,
    mfaEnabled: users.filter((u) => u.mfa_enabled).length,
    ldapUsers: users.filter((u) => u.auth_provider === "ldap").length,
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Users</h1>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <DataTableSkeleton count={8} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Users</h1>
          <div className="flex gap-2 flex-wrap">
            <ExportUsersButton users={users} />
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button variant="outline" onClick={refreshUsers}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <Shield className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold">{stats.admins}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <Key className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MFA Enabled</p>
                <p className="text-2xl font-bold">{stats.mfaEnabled}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <LinkIcon className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LDAP Users</p>
                <p className="text-2xl font-bold">{stats.ldapUsers}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="audit">
              <History className="mr-2 h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <DataTable
              columns={columns}
              data={users}
              searchKey="username"
              searchPlaceholder="Search users by username..."
            />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogTable users={users} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Import Users Dialog */}
      <ImportUsersDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={refreshUsers}
        existingUsers={users}
      />

      {/* User Sheet Form */}
      <UserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editingUser}
        onSubmit={handleSave}
        isLoading={saving}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, user: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;utilisateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l&apos;utilisateur &quot;
              {deleteDialog.user?.username}&quot; ? Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={resetPasswordDialog.open}
        onOpenChange={(open) => {
          setResetPasswordDialog({ open, user: null });
          setNewPassword("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Définir un nouveau mot de passe pour l&apos;utilisateur{" "}
              <strong>{resetPasswordDialog.user?.username}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Saisir le nouveau mot de passe"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Le mot de passe doit contenir au moins 8 caractères
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetPasswordDialog({ open: false, user: null });
                setNewPassword("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resettingPassword || newPassword.length < 8}
            >
              {resettingPassword && (
                <SpinnerInfinity
                  size={24}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="mr-2 h-4 w-4 "
                />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
