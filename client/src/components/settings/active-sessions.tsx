"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Trash2, RefreshCw, LogOut, Loader2 } from "lucide-react";
import { IDENTITY_URL } from "@/lib/api/core";
import axios from "axios";
import { toast } from "sonner";

interface Session {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

function parseDevice(userAgent: string | null): { label: string; isMobile: boolean } {
  if (!userAgent) return { label: "Unknown device", isMobile: false };
  const ua = userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad/.test(ua);
  if (/firefox/.test(ua)) return { label: "Firefox", isMobile };
  if (/safari/.test(ua) && !/chrome/.test(ua)) return { label: "Safari", isMobile };
  if (/chrome|chromium/.test(ua)) return { label: "Chrome", isMobile };
  if (/edge/.test(ua)) return { label: "Edge", isMobile };
  return { label: "Browser", isMobile };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActiveSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${IDENTITY_URL}/auth/sessions`, { withCredentials: true });
      setSessions(res.data);
    } catch {
      toast.error("Impossible de charger les sessions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revokeSession = async (id: string) => {
    setRevoking((prev) => new Set(prev).add(id));
    try {
      await axios.delete(`${IDENTITY_URL}/auth/sessions/${id}`, { withCredentials: true });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Session révoquée");
    } catch {
      toast.error("Impossible de révoquer la session");
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const revokeAll = async () => {
    setIsLoading(true);
    try {
      const res = await axios.delete(`${IDENTITY_URL}/auth/sessions`, { withCredentials: true });
      setSessions([]);
      toast.success(`Revoked ${res.data.revoked} sessions`);
    } catch {
      toast.error("Impossible de révoquer toutes les sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const activeSessions = sessions.filter(
    (s) => new Date(s.expires_at) > new Date()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold">Active Sessions</h2>
            <p className="text-sm text-muted-foreground">Manage where you are signed in</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSessions} disabled={isLoading} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {activeSessions.length > 1 && (
            <Button variant="destructive" size="sm" onClick={revokeAll} disabled={isLoading} className="gap-1">
              <LogOut className="h-3.5 w-3.5" />
              Revoke all
            </Button>
          )}
        </div>
      </div>

      {isLoading && sessions.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : activeSessions.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-8 text-center text-muted-foreground">
          No active sessions found
        </div>
      ) : (
        <div className="space-y-2">
          {activeSessions.map((session) => {
            const { label, isMobile } = parseDevice(session.user_agent);
            const isRevokingThis = revoking.has(session.id);

            return (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {isMobile ? (
                    <Smartphone className="h-5 w-5 shrink-0 text-gray-400" />
                  ) : (
                    <Monitor className="h-5 w-5 shrink-0 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{label}</span>
                      {session.is_current && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      {session.ip_address && <span>{session.ip_address}</span>}
                      <span>Started {formatDate(session.created_at)}</span>
                      <span>Expires {formatDate(session.expires_at)}</span>
                    </div>
                  </div>
                </div>
                {!session.is_current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeSession(session.id)}
                    disabled={isRevokingThis}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {isRevokingThis ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
