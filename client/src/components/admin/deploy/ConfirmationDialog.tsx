"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The exact text the operator must type to confirm. */
  confirmationToken: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
}

/**
 * Destructive-action guard. The submit button stays disabled until the user
 * types the exact confirmation token (case-sensitive).
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationToken,
  onConfirm,
  danger = false,
}: ConfirmationDialogProps) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const matches = input === confirmationToken;

  const handle = async () => {
    if (!matches) return;
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setInput("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-input">
            Tape{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              {confirmationToken}
            </code>{" "}
            pour confirmer
          </Label>
          <Input
            id="confirm-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={confirmationToken}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant={danger ? "destructive" : "default"}
            disabled={!matches || submitting}
            onClick={handle}
          >
            {submitting ? "En cours…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
