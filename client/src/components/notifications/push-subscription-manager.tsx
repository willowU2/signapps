"use client";

import { SpinnerInfinity } from "spinners-react";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, MonitorSmartphone } from "lucide-react";
import { calendarApi } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface PushSubscription {
  id: string;
  user_agent: string | null;
  browser_name: string | null;
  created_at: string;
}

export function PushSubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      const response = await calendarApi.get<PushSubscription[]>(
        "/notifications/subscriptions/push",
      );
      setSubscriptions(response.data as PushSubscription[]);
    } catch {
      // Ignore errors silently for now
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await calendarApi.delete(`/notifications/subscriptions/push/${id}`);
      setSubscriptions(subscriptions.filter((s) => s.id !== id));
    } catch {
      // Ignore errors silently for now
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registered Devices</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-4">
          <SpinnerInfinity
            size={24}
            secondaryColor="rgba(128,128,128,0.2)"
            color="currentColor"
            speed={120}
            className="h-6 w-6  text-muted-foreground"
          />
        </CardContent>
      </Card>
    );
  }

  if (subscriptions.length === 0) {
    return null; // Don't show if no subscriptions
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registered Devices</CardTitle>
        <CardDescription>
          These devices are currently receiving push notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {sub.browser_name || "Unknown Browser"}
                    <span className="text-xs text-muted-foreground">
                      (Added {formatDistanceToNow(new Date(sub.created_at))}{" "}
                      ago)
                    </span>
                  </div>
                  <div
                    className="text-xs text-muted-foreground max-w-sm truncate mt-0.5"
                    title={sub.user_agent || ""}
                  >
                    {sub.user_agent || "Unknown device"}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(sub.id)}
                disabled={deletingId === sub.id}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Supprimer"
              >
                {deletingId === sub.id ? (
                  <SpinnerInfinity
                    size={24}
                    secondaryColor="rgba(128,128,128,0.2)"
                    color="currentColor"
                    speed={120}
                    className="h-4 w-4 "
                  />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
