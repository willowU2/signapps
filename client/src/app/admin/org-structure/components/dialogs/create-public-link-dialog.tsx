/**
 * SO4 IN2 — Create Public Link Dialog.
 *
 * Picks a root node, a visibility level, and an optional expiration
 * date. Calls `publicLinksApi.create()` then surfaces the freshly
 * minted slug back to the caller (so it can copy the URL or pop a
 * snippet).
 */
"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  publicLinksApi,
  type LinkVisibility,
  type PublicLinkView,
} from "@/lib/api/org-integrations";

export interface CreatePublicLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tenant id (required by the backend). */
  tenantId: string;
  /** Root node options (id → display name). */
  nodeOptions: Array<{ id: string; name: string }>;
  /** Default selected node. */
  defaultNodeId?: string | null;
  /** Callback once the link is created. */
  onCreated: (link: PublicLinkView) => void;
}

export function CreatePublicLinkDialog(props: CreatePublicLinkDialogProps) {
  const {
    open,
    onOpenChange,
    tenantId,
    nodeOptions,
    defaultNodeId,
    onCreated,
  } = props;

  const [rootNodeId, setRootNodeId] = useState<string>(defaultNodeId ?? "");
  const [visibility, setVisibility] = useState<LinkVisibility>("anon");
  const [expiresIn, setExpiresIn] = useState<string>("90");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!rootNodeId) {
      toast.error("Pick a root node first");
      return;
    }
    setSubmitting(true);
    try {
      const days = Number.parseInt(expiresIn, 10);
      const expires_at =
        Number.isFinite(days) && days > 0
          ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
          : null;
      const link = await publicLinksApi.create({
        tenant_id: tenantId,
        root_node_id: rootNodeId,
        visibility,
        allowed_origins: [],
        expires_at,
      });
      toast.success(`Link created — slug ${link.slug}`);
      onCreated(link);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Failed to create link: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Create Public Link
          </DialogTitle>
          <DialogDescription>
            Generate a public URL exposing a sub-tree of your org with the
            chosen anonymization level.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="public-link-root">Root node</Label>
            <Select value={rootNodeId} onValueChange={setRootNodeId}>
              <SelectTrigger id="public-link-root">
                <SelectValue placeholder="Select a node" />
              </SelectTrigger>
              <SelectContent>
                {nodeOptions.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="public-link-visibility">Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as LinkVisibility)}
            >
              <SelectTrigger id="public-link-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full (names + email)</SelectItem>
                <SelectItem value="anon">Anonymous (initials)</SelectItem>
                <SelectItem value="compact">Compact (counts only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="public-link-expires">Expires in (days)</Label>
            <Input
              id="public-link-expires"
              type="number"
              min={1}
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              placeholder="leave 0 for no expiration"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            data-testid="public-link-create-submit"
            onClick={handleCreate}
            disabled={submitting}
          >
            Create link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
