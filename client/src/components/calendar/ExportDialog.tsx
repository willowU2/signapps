import { SpinnerInfinity } from 'spinners-react';
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download } from 'lucide-react';
import { calendarApi } from "@/lib/api";

interface ExportDialogProps {
  calendarId: string | null;
  calendarName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = "ics" | "json";

export function ExportDialog({
  calendarId,
  calendarName,
  open,
  onOpenChange,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("ics");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleExport = async () => {
    if (!calendarId) return;

    try {
      setIsExporting(true);
      setError(null);

      const response = await calendarApi.get(
        `/calendars/${calendarId}/export`,
        { responseType: "blob" }
      );

      // Create download link
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${calendarName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.ics`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to export calendar"
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAsJSON = async () => {
    if (!calendarId) return;

    try {
      setIsExporting(true);
      setError(null);

      const response = await calendarApi.get(
        `/calendars/${calendarId}/events`
      );

      // Create JSON blob
      const jsonData = JSON.stringify(response.data, null, 2);
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${calendarName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to export calendar"
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Calendar</DialogTitle>
          <DialogDescription>
            Download <strong>{calendarName}</strong> in your preferred format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format selector */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup value={format} onValueChange={(v: any) => setFormat(v)}>
              <div className="flex items-center space-x-2 p-3 rounded border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="ics" id="format-ics" />
                <Label htmlFor="format-ics" className="cursor-pointer flex-1 mb-0">
                  <div>
                    <p className="font-medium">iCalendar (.ics)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Format RFC 5545 - compatible avec Outlook, Apple Calendar et d'autres agendas
                    </p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 rounded border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="json" id="format-json" />
                <Label htmlFor="format-json" className="cursor-pointer flex-1 mb-0">
                  <div>
                    <p className="font-medium">JSON (.json)</p>
                    <p className="text-xs text-muted-foreground">
                      SignApps native format - includes all metadata
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Format details */}
          {format === "ics" && (
            <div className="p-3 bg-blue-50 rounded text-sm text-blue-900">
              <p className="font-medium mb-1">iCalendar Format</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Standard format supported by all calendar apps</li>
                <li>Includes events, recurrence rules, and timezones</li>
                <li>Peut être importé dans Outlook, Apple Calendar, etc.</li>
                <li>Inclut les événements récurrents et les informations de téléchargement</li>
              </ul>
            </div>
          )}

          {format === "json" && (
            <div className="p-3 bg-purple-50 rounded text-sm text-purple-900">
              <p className="font-medium mb-1">JSON Format</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Complete event data including custom metadata</li>
                <li>Best for backup or re-importing to SignApps</li>
                <li>Human-readable and machine-parseable</li>
              </ul>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={format === "ics" ? handleExport : handleExportAsJSON}
              disabled={isExporting || !calendarId}
              className="flex-1 gap-2"
            >
              {isExporting ? (
                <>
                  <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 " />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground text-center">
            Your calendar will be downloaded as{" "}
            {format === "ics" ? "calendar.ics" : "calendar.json"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
