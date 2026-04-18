"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { meetApi } from "@/lib/api/meet";
import { LIVEKIT_URL } from "@/lib/api/core";
import { usePageTitle } from "@/hooks/use-page-title";

const MeetRoom = dynamic(
  () =>
    import("@/components/meet/meet-room").then((m) => ({
      default: m.MeetRoom,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement...
      </div>
    ),
  },
);

interface StoredPrefs {
  token?: string;
  livekitUrl?: string;
  roomName?: string;
  displayName?: string;
}

export default function MeetCodePage() {
  usePageTitle("Réunion");
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = decodeURIComponent(params.code);

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string>(LIVEKIT_URL);
  const [roomName, setRoomName] = useState<string>(code);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      // 1. Try to read lobby prefs from sessionStorage
      try {
        const raw = sessionStorage.getItem(`meet:prefs:${code}`);
        if (raw) {
          const prefs: StoredPrefs = JSON.parse(raw);
          if (prefs.token && prefs.livekitUrl) {
            if (!active) return;
            setToken(prefs.token);
            setServerUrl(prefs.livekitUrl);
            setRoomName(prefs.roomName || code);
            return;
          }
        }
      } catch {
        // ignore
      }

      // 2. Fall back to a direct join request
      try {
        const res = await meetApi.joinByCode(code);
        if (!active) return;
        setToken(res.data.token);
        const rawUrl = res.data.livekit_url || LIVEKIT_URL;
        setServerUrl(rawUrl.replace(/^http(s?):\/\//, "ws$1://"));
        setRoomName(res.data.room_name || code);
      } catch {
        if (!active) return;
        setError(
          "Impossible de rejoindre cette salle. Passe par le lobby pour tester ta caméra.",
        );
      }
    };

    hydrate();
    return () => {
      active = false;
    };
  }, [code]);

  const handleLeave = () => {
    // Clear prefs
    try {
      sessionStorage.removeItem(`meet:prefs:${code}`);
    } catch {
      // ignore
    }
    router.push("/meet");
  };

  if (error) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-xl flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Salle indisponible
          </h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/meet/${encodeURIComponent(code)}/lobby`)}
            >
              Ouvrir le lobby
            </Button>
            <Button onClick={() => router.push("/meet")}>
              Retour au dashboard
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!token) {
    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-var(--header-height,4rem))] items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Connexion à la salle...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-var(--header-height,4rem))] w-full">
        <MeetRoom
          roomId={code}
          roomName={roomName}
          token={token}
          serverUrl={serverUrl}
          onLeave={() => {
            toast.success("Tu as quitté la réunion");
            handleLeave();
          }}
        />
      </div>
    </AppLayout>
  );
}
