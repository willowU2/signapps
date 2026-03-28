"use client";

import { SpinnerInfinity } from 'spinners-react';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sharesApi } from "@/lib/api";
import { toast } from "sonner";
import { Link as LinkIcon, Lock, Calendar } from 'lucide-react';
import { FileItem } from "./types";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FileItem | null;
}

export function ShareSheet({ open, onOpenChange, item }: ShareSheetProps) {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresInParts, setExpiresInParts] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const handleShare = async () => {
    if (!item || !item.bucket) return;
    setLoading(true);
    try {
      const expires = parseInt(expiresInParts, 10);
      const payload: any = {
        bucket: item.bucket,
        key: item.key,
      };
      if (!isNaN(expires)) {
        payload.expires_in_hours = expires;
      }
      if (password) {
        payload.password = password;
      }
      const response = await sharesApi.create(payload);
      setShareUrl(response.data.url);
      toast.success("Share link created successfully");
    } catch (error) {
      console.debug(error);
      toast.error("Impossible de créer share link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
    onOpenChange(false);
    // Reset state for next time
    setTimeout(() => {
      setShareUrl("");
      setPassword("");
      setExpiresInParts("");
    }, 300);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state for next time
      setTimeout(() => {
        setShareUrl("");
        setPassword("");
        setExpiresInParts("");
      }, 300);
    }
    onOpenChange(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="flex flex-col h-full sm:max-w-md w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
            Share {item?.type === "folder" ? "Folder" : "File"}
          </SheetTitle>
          <div className="text-sm text-muted-foreground mt-2 bg-muted/30 p-3 rounded-md border break-all flex flex-col gap-1">
            <span className="font-medium">Selected:</span>
            <span className="text-foreground">{item?.name}</span>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 mt-6 min-h-0">
          {shareUrl ? (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <Label className="text-base font-semibold text-primary">Share Link Ready!</Label>
              <div className="flex flex-col gap-3">
                <Input readOnly value={shareUrl} className="bg-background cursor-copy" onClick={handleCopy} />
                <Button onClick={handleCopy} className="w-full">
                  Copy Link to Clipboard
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 bg-card border rounded-lg shadow-sm">
                <Label className="flex items-center gap-2 text-base">
                  <Lock className="w-4 h-4 text-muted-foreground" /> Optional Password
                </Label>
                <Input
                  type="password"
                  placeholder="Leave blank for no password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-3 p-4 bg-card border rounded-lg shadow-sm">
                <Label className="flex items-center gap-2 text-base">
                  <Calendar className="w-4 h-4 text-muted-foreground" /> Expiration (Hours)
                </Label>
                <Input
                  type="number"
                  placeholder="Leave blank to never expire"
                  value={expiresInParts}
                  onChange={(e) => setExpiresInParts(e.target.value)}
                  min="1"
                  className="bg-background"
                />
              </div>
            </>
          )}
        </div>

        {!shareUrl && (
          <div className="flex justify-end gap-3 pt-6 mt-4 border-t shrink-0">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={loading} className="gap-2">
              {loading ? (
                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="w-4 h-4 " />
              ) : (
                <LinkIcon className="w-4 h-4" />
              )}
              Create Link
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
