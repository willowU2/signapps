"use client";

// IDEA-042: Read receipts — tracking pixel, display "read" indicator on sent emails

import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Check, CheckCheck, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";

export interface ReadReceiptStatus {
  emailId: string;
  sent: boolean;
  read: boolean;
  readAt?: string;
  viewCount?: number;
}

// Tracking pixel generator — injects a 1x1 transparent GIF into email HTML
export function injectTrackingPixel(
  html: string,
  emailId: string,
  trackingBaseUrl: string,
): string {
  const pixelUrl = `${trackingBaseUrl}/api/mail/track/${emailId}/open`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:none;margin:0;padding:0;" aria-hidden="true" />`;
  // Inject before closing body tag, or append
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
}

// Read receipt status indicator for sent email list
interface ReadReceiptIndicatorProps {
  status?: ReadReceiptStatus;
  size?: "sm" | "md";
}

export function ReadReceiptIndicator({
  status,
  size = "sm",
}: ReadReceiptIndicatorProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (!status) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground/50">
            <Clock className={iconSize} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Tracking not enabled</TooltipContent>
      </Tooltip>
    );
  }

  if (!status.sent) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground">
            <Check className={iconSize} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Sent</TooltipContent>
      </Tooltip>
    );
  }

  if (status.read) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-blue-500">
            <CheckCheck className={iconSize} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Read{" "}
          {status.readAt
            ? format(new Date(status.readAt), "MMM d 'at' HH:mm")
            : ""}
          {status.viewCount && status.viewCount > 1
            ? ` (${status.viewCount} views)`
            : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-muted-foreground">
          <CheckCheck className={iconSize} />
        </span>
      </TooltipTrigger>
      <TooltipContent>Delivered, not yet read</TooltipContent>
    </Tooltip>
  );
}

// Toggle for enabling read receipts in compose
interface ReadReceiptToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ReadReceiptToggle({
  enabled,
  onToggle,
}: ReadReceiptToggleProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Switch id="read-receipt" checked={enabled} onCheckedChange={onToggle} />
      <Label
        htmlFor="read-receipt"
        className="flex items-center gap-2 cursor-pointer text-sm"
      >
        {enabled ? (
          <Eye className="h-4 w-4 text-blue-500" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
        Read receipt
        {enabled && (
          <Badge
            variant="outline"
            className="text-xs text-blue-600 border-blue-200"
          >
            Tracking enabled
          </Badge>
        )}
      </Label>
    </div>
  );
}

// Hook to poll read receipt status
export function useReadReceiptStatus(emailId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<ReadReceiptStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!emailId || !enabled) return;
    try {
      const res = await fetch(`/api/mail/track/${emailId}/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Silently ignore — tracking is best effort
    }
  }, [emailId, enabled]);

  useEffect(() => {
    if (!emailId || !enabled) return;
    fetchStatus();
    // Poll every 30 seconds for pending receipts
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [emailId, enabled, fetchStatus]);

  return { status, refetch: fetchStatus };
}

// Sent email row with read receipt status
interface SentEmailRowStatusProps {
  emailId: string;
  sentAt: string;
  receiptsEnabled: boolean;
}

export function SentEmailRowStatus({
  emailId,
  sentAt,
  receiptsEnabled,
}: SentEmailRowStatusProps) {
  const { status } = useReadReceiptStatus(emailId, receiptsEnabled);

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <ReadReceiptIndicator status={status ?? undefined} />
      {status?.read && status.readAt && (
        <span className="text-blue-500 font-medium">
          Read {format(new Date(status.readAt), "HH:mm")}
        </span>
      )}
    </div>
  );
}
