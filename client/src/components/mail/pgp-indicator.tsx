"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lock,
  LockOpen,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  KeyRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  isEncryptedMessage,
  decryptMessage,
  getPgpConfig,
} from "./pgp-settings";
import { toast } from "sonner";

// ============================================================================
// Encryption Status Badges (for mail-display.tsx header area)
// ============================================================================

interface PgpStatusBadgesProps {
  /** The raw email body (text or html) */
  body: string | null | undefined;
  /** Account ID to look up PGP config */
  accountId: string;
}

/**
 * Displays encryption and signature badges for an email.
 * Shows lock icon for encrypted, shield icon for signature status.
 */
export function PgpStatusBadges({ body, accountId }: PgpStatusBadgesProps) {
  const encrypted = isEncryptedMessage(body);
  const config = getPgpConfig(accountId);
  const hasKeys = !!config.keyPair;

  if (!encrypted && !hasKeys) return null;

  return (
    <div className="flex items-center gap-1.5">
      {encrypted ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50 cursor-help"
            >
              <Lock className="h-3 w-3 mr-0.5" />
              Encrypted
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              This email is end-to-end encrypted with RSA-OAEP
            </p>
          </TooltipContent>
        </Tooltip>
      ) : (
        hasKeys &&
        config.enabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] font-semibold bg-muted text-muted-foreground border-border dark:bg-gray-900/30 dark:text-muted-foreground dark:border-gray-800/50 cursor-help"
              >
                <LockOpen className="h-3 w-3 mr-0.5" />
                Unencrypted
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">This email was not encrypted</p>
            </TooltipContent>
          </Tooltip>
        )
      )}
    </div>
  );
}

// ============================================================================
// Decrypt Button (for mail-display.tsx body area)
// ============================================================================

interface DecryptButtonProps {
  body: string | null | undefined;
  accountId: string;
  onDecrypted: (plaintext: string) => void;
}

/**
 * Shows a "Decrypt" button if the message is encrypted.
 * Calls onDecrypted with the plaintext when successful.
 */
export function DecryptButton({
  body,
  accountId,
  onDecrypted,
}: DecryptButtonProps) {
  const [decrypting, setDecrypting] = useState(false);
  const [decrypted, setDecrypted] = useState(false);

  if (!isEncryptedMessage(body)) return null;

  const config = getPgpConfig(accountId);
  if (!config.keyPair?.privateKeyPem) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 text-sm">
        <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-amber-700 dark:text-amber-400">
          This email is encrypted but you don&apos;t have a private key
          configured to decrypt it.
        </span>
      </div>
    );
  }

  if (decrypted) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Decrypted successfully
      </div>
    );
  }

  const handleDecrypt = async () => {
    setDecrypting(true);
    try {
      const plaintext = await decryptMessage(
        config.keyPair!.privateKeyPem,
        body!,
      );
      setDecrypted(true);
      onDecrypted(plaintext);
      toast.success("Email decrypted");
    } catch {
      toast.error(
        "Failed to decrypt. The email may have been encrypted with a different key.",
      );
    } finally {
      setDecrypting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDecrypt}
      disabled={decrypting}
      className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
    >
      <Lock
        className={`h-3.5 w-3.5 mr-1.5 ${decrypting ? "animate-pulse" : ""}`}
      />
      {decrypting ? "Decrypting..." : "Decrypt Message"}
    </Button>
  );
}

// ============================================================================
// Compose Encryption Toggle (for compose dialog)
// ============================================================================

interface ComposeEncryptToggleProps {
  accountId: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  recipientPublicKey: string;
  onRecipientKeyChange: (key: string) => void;
}

/**
 * Toggle and recipient key input for the compose dialog.
 * Allows the sender to enable encryption and paste/provide
 * the recipient's public key.
 */
export function ComposeEncryptToggle({
  accountId,
  enabled,
  onToggle,
  recipientPublicKey,
  onRecipientKeyChange,
}: ComposeEncryptToggleProps) {
  const config = getPgpConfig(accountId);
  const hasKeys = !!config.keyPair && config.enabled;

  if (!hasKeys) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="encrypt-toggle"
            checked={enabled}
            onCheckedChange={onToggle}
          />
          <Label
            htmlFor="encrypt-toggle"
            className="flex items-center gap-1.5 text-sm cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5 text-emerald-500" />
            Encrypt this email
          </Label>
        </div>

        {enabled && !recipientPublicKey && (
          <Badge
            variant="outline"
            className="text-[10px] text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800"
          >
            Recipient key needed
          </Badge>
        )}
        {enabled && recipientPublicKey && (
          <Badge
            variant="outline"
            className="text-[10px] text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
          >
            <ShieldCheck className="h-3 w-3 mr-0.5" />
            Ready to encrypt
          </Badge>
        )}
      </div>

      {enabled && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <KeyRound className="h-3 w-3 mr-1.5" />
              {recipientPublicKey
                ? "Recipient key set"
                : "Set recipient public key"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Recipient&apos;s Public Key (PEM)
              </Label>
              <Textarea
                value={recipientPublicKey}
                onChange={(e) => onRecipientKeyChange(e.target.value)}
                placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                className="font-mono text-[10px] h-32 resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                Paste the recipient&apos;s public key to encrypt the email. Only
                they will be able to read it.
              </p>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
