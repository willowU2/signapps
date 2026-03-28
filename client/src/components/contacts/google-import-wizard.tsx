"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";

type Step = "auth" | "select" | "import" | "done";

interface ImportResource {
  id: string;
  name: string;
  type: "contact" | "drive_file";
  meta: string;
  selected: boolean;
}

const MOCK_RESOURCES: ImportResource[] = [
  { id: "g1", name: "Alice Martin", type: "contact", meta: "alice@gmail.com", selected: true },
  { id: "g2", name: "Bob Dupont", type: "contact", meta: "bob@gmail.com", selected: true },
  { id: "g3", name: "Q3 Report.pdf", type: "drive_file", meta: "Drive / Reports", selected: false },
  { id: "g4", name: "Budget 2025.xlsx", type: "drive_file", meta: "Drive / Finance", selected: false },
  { id: "g5", name: "Carol Blanc", type: "contact", meta: "carol@gmail.com", selected: true },
];

interface GoogleImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
}

export function GoogleImportWizard({
  open,
  onOpenChange,
  onImported,
}: GoogleImportWizardProps) {
  const [step, setStep] = useState<Step>("auth");
  const [resources, setResources] = useState<ImportResource[]>(MOCK_RESOURCES);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  // Simulate OAuth redirect (real impl would call /api/v1/integrations/google/auth)
  const handleConnectGoogle = () => {
    toast.info("Redirecting to Google OAuth…");
    // In production: window.location.href = "/api/v1/integrations/google/auth"
    setTimeout(() => setStep("select"), 1000);
  };

  const toggleResource = (id: string) => {
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleImport = async () => {
    const selected = resources.filter((r) => r.selected);
    if (selected.length === 0) {
      toast.error("Sélectionnez au moins un élément à importer.");
      return;
    }
    setImporting(true);
    try {
      // In production: call /api/v1/integrations/google/import with selected IDs
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setImportedCount(selected.length);
      setStep("done");
      onImported?.(selected.length);
      toast.success(`Imported ${selected.length} item(s) from Google.`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep("auth");
    setResources(MOCK_RESOURCES);
    setImportedCount(0);
    onOpenChange(false);
  };

  const selectedCount = resources.filter((r) => r.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Google Workspace</DialogTitle>
        </DialogHeader>

        {step === "auth" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Connect your Google account to import contacts from Google Contacts
              and files from Google Drive via OAuth 2.0. No data is stored on
              Google servers.
            </p>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">What will be imported:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Google Contacts → SignApps Contacts</li>
                <li>Google Drive files → SignApps Drive</li>
              </ul>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button onClick={handleConnectGoogle}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect Google Account
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Select the items you want to import into SignApps.
            </p>
            <ScrollArea className="h-64 rounded-lg border">
              <div className="p-3 space-y-2">
                {resources.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={r.id}
                      checked={r.selected}
                      onCheckedChange={() => toggleResource(r.id)}
                    />
                    <Label htmlFor={r.id} className="flex-1 cursor-pointer">
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.meta}
                      </span>
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      {r.type === "contact" ? "Contact" : "File"}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("auth")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing || selectedCount === 0}>
                {importing ? (
                  "Importing…"
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import {selectedCount} item{selectedCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-lg font-semibold">Import Complete</p>
            <p className="text-sm text-muted-foreground">
              {importedCount} item{importedCount !== 1 ? "s" : ""} imported successfully.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
