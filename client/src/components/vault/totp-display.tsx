"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateTotpAsync } from "@/lib/vault-crypto";
import { cn } from "@/lib/utils";

interface TotpDisplayProps {
  totpSecret: string;
  className?: string;
}

const PERIOD = 30; // secondes

function getSecondsRemaining(): number {
  return PERIOD - (Math.floor(Date.now() / 1000) % PERIOD);
}

export function TotpDisplay({ totpSecret, className }: TotpDisplayProps) {
  const [code, setCode] = useState<string>("------");
  const [remaining, setRemaining] = useState(getSecondsRemaining());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!totpSecret) return;
    setLoading(true);
    try {
      const newCode = await generateTotpAsync(totpSecret);
      setCode(newCode);
    } catch {
      setCode("------");
    } finally {
      setLoading(false);
    }
  }, [totpSecret]);

  // Generate initial code
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Countdown + auto-refresh
  useEffect(() => {
    const tick = setInterval(() => {
      const secs = getSecondsRemaining();
      setRemaining(secs);

      // Refresh when a new period starts
      if (secs === PERIOD) {
        refresh();
      }
    }, 1_000);

    return () => clearInterval(tick);
  }, [refresh]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success("Code TOTP copié");
    });
  };

  const progress = (remaining / PERIOD) * 100;
  const isExpiringSoon = remaining <= 5;

  return (
    <div className={cn("flex flex-col items-center gap-3 py-2", className)}>
      {/* Code display */}
      <div
        className={cn(
          "font-mono text-3xl font-bold tracking-[0.25em] select-all cursor-text transition-colors",
          isExpiringSoon ? "text-red-500" : "text-foreground",
        )}
      >
        {loading ? "••••••" : `${code.slice(0, 3)} ${code.slice(3)}`}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            isExpiringSoon ? "bg-red-500" : "bg-emerald-500",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timer + actions */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          Expire dans{" "}
          <span
            className={cn(
              "font-medium",
              isExpiringSoon ? "text-red-500" : "text-foreground",
            )}
          >
            {remaining}s
          </span>
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCopy}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
