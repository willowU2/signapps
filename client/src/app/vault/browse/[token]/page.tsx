"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, X, Clock } from "lucide-react";
import { vaultApi } from "@/lib/api/vault";
import { toast } from "sonner";

interface BrowsePageProps {
  params: Promise<{ token: string }>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Session duration: 30 minutes
const SESSION_DURATION_SECONDS = 30 * 60;

export default function BrowsePage({ params }: BrowsePageProps) {
  const { token } = use(params);
  usePageTitle("Navigation sécurisée");
  const router = useRouter();
  const [remaining, setRemaining] = useState(SESSION_DURATION_SECONDS);
  const [ending, setEnding] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          handleEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      await vaultApi.browse.end(token);
    } catch {
      // Session may already be expired
    }

    toast.info("Session de navigation terminée");
    router.push("/vault");
  }, [token, router, ending]);

  const isExpiringSoon = remaining <= 60;
  const proxyUrl = `/proxy/vault/${token}`;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Slim top bar ── */}
      <div className="flex items-center justify-between h-12 px-4 bg-zinc-900 border-b border-zinc-700 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-200">
            Navigation sécurisée
          </span>
          <Badge
            variant="outline"
            className="text-xs border-zinc-600 text-zinc-400"
          >
            Mode isolé
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <div
            className={`flex items-center gap-1.5 text-sm font-mono ${
              isExpiringSoon ? "text-red-400" : "text-zinc-300"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Session : {formatDuration(remaining)}</span>
          </div>

          {/* End button */}
          <Button
            size="sm"
            variant="destructive"
            className="h-7 gap-1.5 text-xs"
            onClick={handleEnd}
            disabled={ending}
          >
            <X className="h-3 w-3" />
            Terminer
          </Button>
        </div>
      </div>

      {/* ── iframe ── */}
      <iframe
        src={proxyUrl}
        className="flex-1 w-full border-0"
        title="Navigation sécurisée"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
      />
    </div>
  );
}
