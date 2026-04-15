"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  HardDrive,
  ThermometerSun,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { DiskInfo } from "@/lib/api";

interface DiskDetailDialogProps {
  disk: DiskInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function DiskDetailDialog({
  disk,
  open,
  onOpenChange,
}: DiskDetailDialogProps) {
  if (!disk) return null;

  const smart = disk.smart_data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {disk.device_path}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Modèle</label>
              <p className="font-medium">{disk.model || "Inconnu"}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">
                Numéro de série
              </label>
              <p className="font-medium font-mono text-sm">
                {disk.serial_number || "N/A"}
              </p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Capacité</label>
              <p className="font-medium">{formatBytes(disk.size_bytes)}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Statut</label>
              <div className="flex items-center gap-2 mt-1">
                {disk.status === "healthy" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
                <Badge
                  variant={
                    disk.status === "healthy" ? "default" : "destructive"
                  }
                  className="capitalize"
                >
                  {disk.status}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* SMART Data */}
          {smart ? (
            <div className="space-y-4">
              <h4 className="font-medium">Données SMART</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Heures de fonctionnement
                    </p>
                    <p className="font-medium">
                      {smart.power_on_hours?.toLocaleString() || "N/A"} h
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <ThermometerSun
                    className={`h-5 w-5 ${
                      smart.temperature > 50
                        ? "text-red-500"
                        : smart.temperature > 40
                          ? "text-yellow-500"
                          : "text-green-500"
                    }`}
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">Température</p>
                    <p className="font-medium">
                      {smart.temperature || disk.temperature || "N/A"}°C
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Secteurs réalloués</span>
                    <span
                      className={
                        smart.reallocated_sectors > 0 ? "text-yellow-500" : ""
                      }
                    >
                      {smart.reallocated_sectors}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(smart.reallocated_sectors / 100, 100)}
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Secteurs en attente</span>
                    <span
                      className={
                        smart.pending_sectors > 0 ? "text-yellow-500" : ""
                      }
                    >
                      {smart.pending_sectors}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(smart.pending_sectors / 100, 100)}
                    className="h-2"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  Évaluation santé
                </p>
                <p className="font-medium">{smart.health_assessment || "OK"}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Données SMART non disponibles
            </div>
          )}

          {/* Array Info */}
          {disk.array_id && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Array RAID</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Array ID: {disk.array_id}</Badge>
                  {disk.slot_number !== undefined && (
                    <Badge variant="secondary">Slot {disk.slot_number}</Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
