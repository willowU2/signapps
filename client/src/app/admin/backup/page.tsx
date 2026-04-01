"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { BackupScheduleConfig } from "@/components/admin/backup-schedule-config";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Database,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  Cloud,
  Trash2,
  Download,
  RefreshCw,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { SpinnerInfinity } from "spinners-react";

import { IDENTITY_URL } from "@/lib/api/core";
const BACKUP_HISTORY_KEY = "signapps_backup_history";
const BACKUP_SCHEDULE_KEY = "backup_schedule_config";

interface BackupEntry {
  id: string;
  timestamp: string;
  type: "manual" | "scheduled";
  status: "success" | "failed" | "in_progress";
  size?: string;
  destination: string;
  duration?: number; // seconds
  error?: string;
}

function getBackupHistory(): BackupEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveBackupHistory(entries: BackupEntry[]) {
  localStorage.setItem(
    BACKUP_HISTORY_KEY,
    JSON.stringify(entries.slice(0, 50)),
  );
}

function getScheduleConfig() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(BACKUP_SCHEDULE_KEY) || "null");
  } catch {
    return null;
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function BackupAdminPage() {
  usePageTitle("Sauvegardes");
  const [history, setHistory] = useState<BackupEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [schedule, setSchedule] = useState<{
    cron: string;
    destination: string;
    enabled: boolean;
  } | null>(null);

  useEffect(() => {
    setHistory(getBackupHistory());
    setSchedule(getScheduleConfig());

    // Listen for schedule config changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === BACKUP_SCHEDULE_KEY) setSchedule(getScheduleConfig());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const refreshSchedule = useCallback(() => {
    setSchedule(getScheduleConfig());
  }, []);

  const handleManualBackup = async () => {
    setRunning(true);
    const backupId = `backup-${Date.now()}`;
    const dest = schedule?.destination || "local";
    const entry: BackupEntry = {
      id: backupId,
      timestamp: new Date().toISOString(),
      type: "manual",
      status: "in_progress",
      destination: dest,
    };

    const updatedHistory = [entry, ...history];
    setHistory(updatedHistory);
    saveBackupHistory(updatedHistory);

    toast.info("Backup démarré...");

    const startTime = Date.now();
    let completedEntry: BackupEntry;

    try {
      // Call real backup endpoint
      const apiBase = IDENTITY_URL;
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;

      const res = await fetch(`${apiBase}/admin/backup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ destination: dest }),
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      if (res.status === 404) {
        // Endpoint not deployed yet
        completedEntry = {
          ...entry,
          status: "failed",
          duration,
          error: "Endpoint non disponible — backup manuel requis",
        };
        toast.error("Endpoint non disponible — backup manuel requis");
      } else if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        completedEntry = {
          ...entry,
          status: "failed",
          duration,
          error: `Erreur serveur: ${res.status} ${errText}`.slice(0, 120),
        };
        toast.error(`Backup échoué: ${res.status}`);
      } else {
        const data = await res.json().catch(() => ({}));
        completedEntry = {
          ...entry,
          status: "success",
          duration,
          size: data.size ?? undefined,
        };
        toast.success(`Backup terminé en ${formatDuration(duration)}`);
      }
    } catch {
      // Network-level failure (server unreachable)
      const duration = Math.round((Date.now() - startTime) / 1000);
      completedEntry = {
        ...entry,
        status: "failed",
        duration,
        error: "Endpoint non disponible — backup manuel requis",
      };
      toast.error("Endpoint non disponible — backup manuel requis");
    }

    const finalHistory = [completedEntry, ...history];
    setHistory(finalHistory);
    saveBackupHistory(finalHistory);
    setRunning(false);
  };

  const handleDeleteEntry = (id: string) => {
    const updated = history.filter((e) => e.id !== id);
    setHistory(updated);
    saveBackupHistory(updated);
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveBackupHistory([]);
    toast.success("Backup history cleared");
  };

  const lastSuccessful = history.find((e) => e.status === "success");
  const lastFailed = history.find((e) => e.status === "failed");
  const totalBackups = history.filter((e) => e.status === "success").length;
  const totalSize = history
    .filter((e) => e.status === "success" && e.size)
    .reduce((acc, e) => acc + parseFloat(e.size || "0"), 0);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title="Configuration des sauvegardes"
          description="Planifiez les sauvegardes automatiques et configurez les politiques de retention."
          icon={<Database className="h-5 w-5" />}
        />

        {/* Last Backup Status */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${lastSuccessful ? "bg-green-500/10" : "bg-muted"}`}
                >
                  {lastSuccessful ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Last Successful
                  </p>
                  <p className="font-medium text-sm">
                    {lastSuccessful
                      ? formatTimeAgo(lastSuccessful.timestamp)
                      : "None"}
                  </p>
                  {lastSuccessful?.size && (
                    <p className="text-xs text-muted-foreground">
                      {lastSuccessful.size}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Database className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Backups</p>
                  <p className="font-medium text-sm">{totalBackups}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalSize.toFixed(1)} MB total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${schedule?.enabled ? "bg-green-500/10" : "bg-muted"}`}
                >
                  {schedule?.destination === "s3" ? (
                    <Cloud className="h-5 w-5 text-blue-500" />
                  ) : (
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Schedule</p>
                  <p className="font-medium text-sm capitalize">
                    {schedule?.enabled ? "Active" : "Disabled"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Target: {schedule?.destination || "local"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Manual Backup */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Play className="h-5 w-5" />
                  Manual Backup
                </CardTitle>
                <CardDescription>
                  Trigger an immediate backup of the database and configuration
                </CardDescription>
              </div>
              <Button onClick={handleManualBackup} disabled={running}>
                {running ? (
                  <SpinnerInfinity
                    size={24}
                    secondaryColor="rgba(128,128,128,0.2)"
                    color="currentColor"
                    speed={120}
                    className="mr-2 h-4 w-4"
                  />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {running ? "Backing up..." : "Start Backup"}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Schedule Config */}
        <div onClick={refreshSchedule}>
          <BackupScheduleConfig />
        </div>

        {/* Backup History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-5 w-5" />
                  Backup History
                </CardTitle>
                <CardDescription>
                  Recent backup operations and their status
                </CardDescription>
              </div>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="text-xs text-muted-foreground"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Database className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">No backup history</p>
                <p className="text-sm text-muted-foreground">
                  Run a manual backup or wait for the scheduled backup to run
                </p>
              </div>
            ) : (
              <ScrollArea className="h-72">
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-md ${
                            entry.status === "success"
                              ? "bg-green-500/10"
                              : entry.status === "failed"
                                ? "bg-red-500/10"
                                : "bg-blue-500/10"
                          }`}
                        >
                          {entry.status === "success" && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {entry.status === "failed" && (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {entry.status === "in_progress" && (
                            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {entry.type === "manual" ? "Manual" : "Scheduled"}{" "}
                              Backup
                            </p>
                            <Badge
                              variant={
                                entry.status === "success"
                                  ? "default"
                                  : entry.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className={`text-[10px] h-4 px-1.5 ${
                                entry.status === "success"
                                  ? "bg-green-500/10 text-green-600"
                                  : ""
                              }`}
                            >
                              {entry.status === "in_progress"
                                ? "Running"
                                : entry.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatDate(entry.timestamp)}</span>
                            {entry.size && <span>{entry.size}</span>}
                            {entry.duration && (
                              <span>{formatDuration(entry.duration)}</span>
                            )}
                            <span className="capitalize">
                              {entry.destination}
                            </span>
                          </div>
                          {entry.error && (
                            <p className="text-xs text-red-500 mt-0.5">
                              {entry.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {entry.status === "success" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDeleteEntry(entry.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
