"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Server, Plus, Trash2, Play, Square, Copy } from "lucide-react";
import { toast } from "sonner";

interface MockRoute {
  id: string;
  method: string;
  path: string;
  status: number;
  body: string;
  delay: number;
  hits: number;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function MockServer() {
  const [routes, setRoutes] = useState<MockRoute[]>([
    {
      id: "1",
      method: "GET",
      path: "/api/users",
      status: 200,
      body: '{"users": [{"id": "1", "name": "Alice"}, {"id": "2", "name": "Bob"}]}',
      delay: 0,
      hits: 0,
    },
  ]);
  const [active, setActive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newRoute, setNewRoute] = useState<Omit<MockRoute, "id" | "hits">>({
    method: "GET",
    path: "/api/",
    status: 200,
    body: "{}",
    delay: 0,
  });

  const originalFetch = useRef<typeof fetch | null>(null);

  useEffect(() => {
    if (!active) {
      if (originalFetch.current) {
        window.fetch = originalFetch.current;
        originalFetch.current = null;
      }
      return;
    }

    originalFetch.current = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const method = (init?.method || "GET").toUpperCase();
      const pathname = new URL(url, window.location.origin).pathname;
      const match = routes.find(
        (r) => r.method === method && pathname === r.path,
      );

      if (match) {
        setRoutes((prev) =>
          prev.map((r) => (r.id === match.id ? { ...r, hits: r.hits + 1 } : r)),
        );
        if (match.delay > 0)
          await new Promise((res) => setTimeout(res, match.delay));
        return new Response(match.body, {
          status: match.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch.current!(input, init);
    };

    return () => {
      if (originalFetch.current) {
        window.fetch = originalFetch.current;
        originalFetch.current = null;
      }
    };
  }, [active, routes]);

  const addRoute = () => {
    setRoutes((prev) => [
      ...prev,
      { ...newRoute, id: Date.now().toString(), hits: 0 },
    ]);
    setAdding(false);
    toast.success("Mock route added");
  };

  const remove = (id: string) =>
    setRoutes((prev) => prev.filter((r) => r.id !== id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5 text-primary" />
            Mock Server
            <Badge
              variant={active ? "default" : "secondary"}
              className={active ? "bg-green-500" : ""}
            >
              {active ? "Active" : "Inactive"}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdding(!adding)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
            <Button
              size="sm"
              variant={active ? "destructive" : "default"}
              onClick={() => setActive(!active)}
              className="gap-1.5"
            >
              {active ? (
                <Square className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {active ? "Stop" : "Start"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Method</Label>
                <Select
                  value={newRoute.method}
                  onValueChange={(v) =>
                    setNewRoute((p) => ({ ...p, method: v }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Input
                  type="number"
                  value={newRoute.status}
                  onChange={(e) =>
                    setNewRoute((p) => ({
                      ...p,
                      status: Number(e.target.value),
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Delay (ms)</Label>
                <Input
                  type="number"
                  value={newRoute.delay}
                  onChange={(e) =>
                    setNewRoute((p) => ({
                      ...p,
                      delay: Number(e.target.value),
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Path</Label>
              <Input
                value={newRoute.path}
                onChange={(e) =>
                  setNewRoute((p) => ({ ...p, path: e.target.value }))
                }
                className="h-8 text-sm font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Response Body (JSON)</Label>
              <Textarea
                value={newRoute.body}
                onChange={(e) =>
                  setNewRoute((p) => ({ ...p, body: e.target.value }))
                }
                rows={3}
                className="text-xs font-mono resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAdding(false)}
              >
                Annuler
              </Button>
              <Button size="sm" onClick={addRoute}>
                Add Route
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {routes.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 p-2.5 rounded-lg border font-mono text-xs"
            >
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  r.method === "GET"
                    ? "bg-blue-100 text-blue-700"
                    : r.method === "POST"
                      ? "bg-green-100 text-green-700"
                      : r.method === "DELETE"
                        ? "bg-red-100 text-red-700"
                        : "bg-orange-100 text-orange-700"
                }`}
              >
                {r.method}
              </span>
              <span className="flex-1 truncate">{r.path}</span>
              <Badge variant="outline" className="text-[10px]">
                {r.status}
              </Badge>
              {r.delay > 0 && (
                <span className="text-muted-foreground">{r.delay}ms</span>
              )}
              <Badge variant="secondary" className="text-[10px]">
                {r.hits} hits
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={() => remove(r.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
