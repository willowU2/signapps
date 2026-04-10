"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

// Pending server-side Google OAuth Integration

interface GoogleImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
}

export function GoogleImportWizard({
  open,
  onOpenChange,
}: GoogleImportWizardProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from Google Workspace</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <ExternalLink className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold">Google Integration Pending</h3>
          <p className="text-sm text-muted-foreground">
            The Google Contacts and Google Drive integration is currently pending backend OAuth setup. 
            Once the gateway is configured, you will be able to securely import your contacts directly into SignApps.
          </p>
          <Badge variant="outline" className="mt-2 text-blue-600 bg-blue-50">
            Coming Soon
          </Badge>
        </div>

        <DialogFooter>
          <Button onClick={handleClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
