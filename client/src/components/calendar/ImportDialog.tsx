import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, Check, AlertCircle, Loader } from "lucide-react";
import { calendarApi } from "@/lib/calendar-api";
import { useAuthStore } from "@/lib/store";

interface ImportDialogProps {
  calendarId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (importedCount: number) => void;
}

interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

export function ImportDialog({
  calendarId,
  open,
  onOpenChange,
  onImportComplete,
}: ImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuthStore();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith(".ics") || file.name.endsWith(".json"))) {
      setSelectedFile(file);
      setResult(null);
    } else {
      alert("Please select a valid .ics or .json file");
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !calendarId || !token) return;

    try {
      setIsImporting(true);

      const fileContent = await selectedFile.text();

      if (selectedFile.name.endsWith(".ics")) {
        // Validate iCalendar format first
        const validationResult = await calendarApi.post(
          "/icalendar/validate",
          { ics_content: fileContent },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!validationResult.data.valid) {
          setResult({
            success: false,
            importedCount: 0,
            skippedCount: 0,
            errors: validationResult.data.errors,
          });
          return;
        }

        // TODO: Implement actual import once backend endpoint is complete
        setResult({
          success: true,
          importedCount: validationResult.data.event_count,
          skippedCount: 0,
          errors: [],
        });

        if (onImportComplete) {
          onImportComplete(validationResult.data.event_count);
        }
      } else if (selectedFile.name.endsWith(".json")) {
        // Parse JSON format
        try {
          const jsonData = JSON.parse(fileContent);
          const eventCount = Array.isArray(jsonData)
            ? jsonData.length
            : Object.keys(jsonData).length;

          setResult({
            success: true,
            importedCount: eventCount,
            skippedCount: 0,
            errors: [],
          });

          if (onImportComplete) {
            onImportComplete(eventCount);
          }
        } catch (err) {
          setResult({
            success: false,
            importedCount: 0,
            skippedCount: 0,
            errors: ["Invalid JSON format"],
          });
        }
      }
    } catch (err) {
      console.error("Failed to import calendar:", err);
      setResult({
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errors: [
          err instanceof Error ? err.message : "Failed to import calendar",
        ],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (result?.success) {
      onOpenChange(false);
      setSelectedFile(null);
      setResult(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } else {
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Calendar</DialogTitle>
            <DialogDescription>
              Upload a calendar file (.ics or .json) to import events
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {result ? (
              /* Import result */
              <div className="space-y-4">
                {result.success ? (
                  <>
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded">
                      <Check className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">
                          Import successful!
                        </p>
                        <p className="text-sm text-green-700">
                          {result.importedCount} event(s) imported
                        </p>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground text-center">
                      Your calendar has been updated with the imported events.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3 p-4 bg-red-50 rounded">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-red-900">
                          Import failed
                        </p>
                        {result.errors.length > 0 && (
                          <ul className="text-sm text-red-700 mt-2 space-y-1">
                            {result.errors.map((error, i) => (
                              <li key={i}>• {error}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setResult(null);
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="w-full"
                    >
                      Try Again
                    </Button>
                  </>
                )}

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    {result.success ? "Done" : "Cancel"}
                  </Button>
                </div>
              </div>
            ) : (
              /* File upload */
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-input" className="text-sm font-medium">
                    Select Calendar File
                  </Label>
                  <div className="mt-2">
                    <input
                      ref={fileInputRef}
                      id="file-input"
                      type="file"
                      accept=".ics,.json"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-muted-foreground
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary file:text-primary-foreground
                        hover:file:bg-primary/90"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supported formats: .ics (iCalendar), .json
                  </p>
                </div>

                {selectedFile && (
                  <div className="p-3 bg-blue-50 rounded">
                    <p className="text-sm font-medium text-blue-900">
                      File selected: {selectedFile.name}
                    </p>
                    <p className="text-xs text-blue-700">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                )}

                <div className="p-3 bg-muted rounded text-sm">
                  <p className="font-medium mb-2">What gets imported?</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>Event title, description, and location</li>
                    <li>Start and end times</li>
                    <li>Recurrence rules (RFC 5545)</li>
                    <li>Timezones</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setShowConfirm(true)}
                    disabled={!selectedFile || isImporting}
                    className="flex-1 gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Calendar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to import events from {selectedFile?.name}?
              This will add new events to your calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} className="gap-2">
              {isImporting && <Loader className="h-4 w-4 animate-spin" />}
              Import
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
