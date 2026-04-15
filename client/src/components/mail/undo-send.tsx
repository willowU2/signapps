"use client";

// IDEA-268: Undo send (30s delay) — cancel within grace period

import { useState, useEffect, useRef, useCallback } from "react";
import { Undo2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const UNDO_WINDOW_MS = 30_000;

interface UndoSendState {
  active: boolean;
  emailId: string | null;
  subject: string;
  cancelToken: (() => void) | null;
  elapsed: number;
}

interface UndoSendBannerProps {
  subject: string;
  onCancel: () => void;
  onSent: () => void;
}

export function UndoSendBanner({
  subject,
  onCancel,
  onSent,
}: UndoSendBannerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e >= UNDO_WINDOW_MS) {
          clearInterval(intervalRef.current!);
          onSent();
          return UNDO_WINDOW_MS;
        }
        return e + 100;
      });
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onSent]);

  const pct = Math.min((elapsed / UNDO_WINDOW_MS) * 100, 100);
  const remaining = Math.max(0, Math.ceil((UNDO_WINDOW_MS - elapsed) / 1000));

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-80 shadow-lg rounded-xl border bg-background px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Sending in {remaining}s…</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 border-orange-300 text-orange-600 hover:bg-orange-50"
          onClick={onCancel}
        >
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </Button>
      </div>
      <Progress value={pct} className="h-1" />
      <p className="text-xs text-muted-foreground mt-1 truncate">{subject}</p>
    </div>
  );
}

// Hook for managing undo-send state in compose flow
export function useUndoSend() {
  const [state, setState] = useState<UndoSendState>({
    active: false,
    emailId: null,
    subject: "",
    cancelToken: null,
    elapsed: 0,
  });
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initiateSend = useCallback(
    (
      subject: string,
      sendFn: () => Promise<void>,
      cancelFn?: () => Promise<void>,
    ) => {
      // Clear any previous timer
      if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);

      let cancelled = false;

      const cancel = () => {
        cancelled = true;
        if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
        setState((s) => ({ ...s, active: false }));
        if (cancelFn) cancelFn();
        toast.info("Envoi annulé");
      };

      sendTimeoutRef.current = setTimeout(async () => {
        if (cancelled) return;
        setState((s) => ({ ...s, active: false }));
        try {
          await sendFn();
          toast.success("Email envoyé");
        } catch {
          toast.error("Impossible d'envoyer l'email");
        }
      }, UNDO_WINDOW_MS);

      setState({
        active: true,
        emailId: null,
        subject,
        cancelToken: cancel,
        elapsed: 0,
      });

      return cancel;
    },
    [],
  );

  const confirm = useCallback(() => {
    setState((s) => ({ ...s, active: false }));
  }, []);

  return { state, initiateSend, cancel: state.cancelToken, confirm };
}

// Settings panel for undo send configuration
interface UndoSendSettingsProps {
  enabled: boolean;
  delaySeconds: number;
  onToggle: (enabled: boolean) => void;
  onDelayChange: (seconds: number) => void;
}

export function UndoSendSettings({
  enabled,
  delaySeconds,
  onToggle,
  onDelayChange,
}: UndoSendSettingsProps) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div>
        <p className="text-sm font-medium">Undo Send</p>
        <p className="text-xs text-muted-foreground">
          Delay sending to allow cancellation ({delaySeconds}s window)
        </p>
      </div>
      <div className="flex items-center gap-3">
        <select
          value={delaySeconds}
          onChange={(e) => onDelayChange(Number(e.target.value))}
          disabled={!enabled}
          className="text-xs border rounded px-2 py-1 bg-background"
        >
          {[5, 10, 15, 30, 60].map((s) => (
            <option key={s} value={s}>
              {s}s
            </option>
          ))}
        </select>
        <Button
          variant={enabled ? "default" : "outline"}
          size="sm"
          onClick={() => onToggle(!enabled)}
        >
          {enabled ? "On" : "Off"}
        </Button>
      </div>
    </div>
  );
}
