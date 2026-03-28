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
import { Check, AlertCircle } from 'lucide-react';
import { calendarApi } from "@/lib/api";
import { FileUploadProgressBar } from '@/components/application/file-upload/file-upload-progress-bar';

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
  const [result, setResult] = useState<ImportResult | null>(null);

  const customUploadStrategy = async (
    id: string,
    file: File,
    onProgress: (progress: number) => void,
    onSuccess: () => void,
    onError: (error: string) => void
  ) => {
    if (!calendarId) {
        onError("Calendar ID is missing");
        return;
    }

    try {
      onProgress(10);
      const fileContent = await file.text();
      onProgress(40);

      if (file.name.endsWith(".ics")) {
        // Validate iCalendar format first
        const validationResult = await calendarApi.post(
          "/icalendar/validate",
          { ics_content: fileContent }
        );

        if (!validationResult.data.valid) {
          const errors = validationResult.data.errors;
          setResult({
            success: false,
            importedCount: 0,
            skippedCount: 0,
            errors,
          });
          onError(errors.join(', '));
          return;
        }
        
        onProgress(60);

        // Call actual import endpoint
        const importResult = await calendarApi.post(
          `/calendars/${calendarId}/import`,
          { ics_content: fileContent }
        );

        const importedCount = importResult.data.imported;
        setResult({
          success: true,
          importedCount,
          skippedCount: importResult.data.skipped,
          errors: importResult.data.errors || [],
        });

        if (onImportComplete) {
          onImportComplete(importedCount);
        }
        onProgress(100);
        onSuccess();
      } else if (file.name.endsWith(".json")) {
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
          
          onProgress(100);
          onSuccess();
        } catch (err) {
          setResult({
            success: false,
            importedCount: 0,
            skippedCount: 0,
            errors: ["Invalid JSON format"],
          });
          onError("Invalid JSON format");
        }
      } else {
          onError("Please select a valid .ics or .json file");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to import calendar";
      setResult({
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errors: [errorMsg],
      });
      onError(errorMsg);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => setResult(null), 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
                    onClick={() => setResult(null)}
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
                  {result.success ? "Terminé" : "Annuler"}
                </Button>
              </div>
            </div>
          ) : (
            /* File upload */
            <div className="space-y-4">
               <FileUploadProgressBar 
                  customUploadStrategy={customUploadStrategy}
                  acceptedTypes=".ics,.json"
               />
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
                   onClick={handleClose}
                   className="flex-1"
                 >
                   Cancel
                 </Button>
               </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
