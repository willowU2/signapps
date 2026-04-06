"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Share2,
  User,
  Users,
  Building2,
  Globe,
} from "lucide-react";
import { sharingApi } from "@/lib/api/sharing";
import type {
  SharingResourceType,
  SharingRole,
  SharingGranteeType,
  BulkGrantResult,
} from "@/types/sharing";
import { SHARING_ROLE_LABELS } from "@/types/sharing";
import { GranteePicker } from "./grantee-picker";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BulkShareDialogProps {
  /** Resource type shared by all selected resources. */
  resourceType: SharingResourceType;
  /** UUIDs of all selected resources to share. */
  resourceIds: string[];
  /**
   * Human-readable description of the selection shown in the dialog header
   * (e.g. `"3 fichiers"`, `"2 calendriers"`).
   */
  resourceLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful (possibly partial) bulk grant, with the count of created grants. */
  onSuccess?: (created: number) => void;
}

// ─── BulkShareDialog ──────────────────────────────────────────────────────────

/**
 * Dialog for applying the same sharing grant to multiple resources at once.
 *
 * Reuses the same form fields as {@link ShareDialog} (grantee picker, role
 * selector, can_reshare checkbox, expiry date) but targets many resources in a
 * single API call.  Partial success is surfaced to the user with a result
 * summary line.
 *
 * @example
 * ```tsx
 * <BulkShareDialog
 *   resourceType="file"
 *   resourceIds={selectedFileIds}
 *   resourceLabel={`${selectedFileIds.length} fichiers`}
 *   open={dialogOpen}
 *   onOpenChange={setDialogOpen}
 *   onSuccess={(n) => toast.success(`${n} partages créés`)}
 * />
 * ```
 */
export function BulkShareDialog({
  resourceType,
  resourceIds,
  resourceLabel,
  open,
  onOpenChange,
  onSuccess,
}: BulkShareDialogProps) {
  // ─── Form state ──────────────────────────────────────────────────────────
  const [granteeType, setGranteeType] = useState<SharingGranteeType>("user");
  const [granteeId, setGranteeId] = useState<string | null>(null);
  const [role, setRole] = useState<SharingRole>("viewer");
  const [canReshare, setCanReshare] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  // ─── Submission state ────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkGrantResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit =
    !submitting &&
    resourceIds.length > 0 &&
    (granteeType === "everyone" || Boolean(granteeId));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    setSubmitError(null);

    try {
      const res = await sharingApi.bulkGrant({
        resource_type: resourceType,
        resource_ids: resourceIds,
        grantee_type: granteeType,
        grantee_id: granteeType !== "everyone" ? granteeId : null,
        role,
        can_reshare: canReshare,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setResult(res);
      onSuccess?.(res.created);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erreur lors du partage en masse";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Reset state when closing
      setGranteeType("user");
      setGranteeId(null);
      setRole("viewer");
      setCanReshare(false);
      setExpiresAt("");
      setResult(null);
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Partager {resourceLabel}</span>
          </DialogTitle>
          <DialogDescription>
            Cette action s&apos;appliquera à{" "}
            <strong>{resourceIds.length}</strong> ressource
            {resourceIds.length > 1 ? "s" : ""} sélectionnée
            {resourceIds.length > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <div className="px-6 py-4 space-y-3 border-t border-border">
          {/* Grantee type + picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Destinataire
            </Label>
            <div className="flex gap-2">
              <Select
                value={granteeType}
                onValueChange={(v) => {
                  setGranteeType(v as SharingGranteeType);
                  setGranteeId(null);
                }}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      Utilisateur
                    </span>
                  </SelectItem>
                  <SelectItem value="group" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      Groupe
                    </span>
                  </SelectItem>
                  <SelectItem value="org_node" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      Département
                    </span>
                  </SelectItem>
                  <SelectItem value="everyone" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3" />
                      Tout le monde
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <GranteePicker
                granteeType={granteeType}
                value={granteeId}
                onChange={(id) => setGranteeId(id)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Role + expiry */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Rôle</Label>
            <div className="flex gap-2">
              <Select
                value={role}
                onValueChange={(v) => setRole(v as SharingRole)}
                disabled={submitting}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SHARING_ROLE_LABELS) as SharingRole[]).map(
                    (r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {SHARING_ROLE_LABELS[r]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="h-8 text-xs w-[140px]"
                title="Date d'expiration (optionnel)"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Can reshare */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="bulk-can-reshare"
              checked={canReshare}
              onCheckedChange={(v) => setCanReshare(v === true)}
              disabled={submitting}
            />
            <Label
              htmlFor="bulk-can-reshare"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Autoriser le destinataire à re-partager ces ressources
            </Label>
          </div>
        </div>

        {/* Result banner */}
        {result && (
          <div className="mx-6 mb-2 rounded-md border px-4 py-3 text-sm flex items-start gap-2.5 bg-muted/30">
            {result.errors.length === 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                <span className="text-foreground">
                  <strong>{result.created}</strong> partage
                  {result.created > 1 ? "s" : ""} créé
                  {result.created > 1 ? "s" : ""} avec succès.
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-foreground">
                  <strong>{result.created}</strong> partage
                  {result.created > 1 ? "s" : ""} créé
                  {result.created > 1 ? "s" : ""},{" "}
                  <strong>{result.errors.length}</strong> erreur
                  {result.errors.length > 1 ? "s" : ""}.
                </span>
              </>
            )}
          </div>
        )}

        {/* Error banner */}
        {submitError && (
          <div className="mx-6 mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <span className="text-destructive">{submitError}</span>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            {result ? "Fermer" : "Annuler"}
          </Button>

          {!result && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="min-w-[120px]"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Appliquer à {resourceIds.length}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
