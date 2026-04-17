"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Printer, Plus, Trash2, User, Shield } from "lucide-react";
import { toast } from "sonner";

interface BadgeData {
  id: string;
  name: string;
  role: string;
  department: string;
  eventOrId: string;
  color: string;
}

const BADGE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

function BadgePreview({ badge }: { badge: BadgeData }) {
  return (
    <div
      className="rounded-xl overflow-hidden shadow-md inline-flex flex-col items-center text-white"
      style={{ width: 140, height: 200, backgroundColor: badge.color }}
    >
      <div className="w-full text-center text-xs font-bold py-1.5 bg-black/20 tracking-widest uppercase">
        {badge.eventOrId || "SignApps Event"}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-card/20 flex items-center justify-center mb-2">
          <User className="h-10 w-10 text-white/80" />
        </div>
        <p className="font-bold text-base leading-tight">
          {badge.name || "Name"}
        </p>
        <p className="text-xs opacity-80 mt-0.5">{badge.role || "Role"}</p>
        {badge.department && (
          <p className="text-[10px] opacity-60 mt-0.5">{badge.department}</p>
        )}
      </div>
      <div className="w-full text-center py-1 bg-black/20 text-xs font-mono">
        #{badge.id.slice(-6)}
      </div>
    </div>
  );
}

export function BadgePrinting() {
  const [badges, setBadges] = useState<BadgeData[]>([
    {
      id: "1",
      name: "Alice Dupont",
      role: "Developer",
      department: "Engineering",
      eventOrId: "SignApps Summit",
      color: "#6366f1",
    },
  ]);
  const printRef = useRef<HTMLDivElement>(null);

  const add = () =>
    setBadges((p) => [
      ...p,
      {
        id: Date.now().toString(),
        name: "",
        role: "",
        department: "",
        eventOrId: "SignApps Event",
        color: BADGE_COLORS[p.length % BADGE_COLORS.length],
      },
    ]);
  const remove = (id: string) => setBadges((p) => p.filter((b) => b.id !== id));
  const update = (id: string, field: keyof BadgeData, val: string) =>
    setBadges((p) => p.map((b) => (b.id === id ? { ...b, [field]: val } : b)));

  const print = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    win?.document.write(
      `<html><head><style>body{margin:20px;background:#f0f0f0;}@media print{body{background:white;}}div{display:inline-block;margin:8px;}</style></head><body>${printRef.current.innerHTML}</body></html>`,
    );
    win?.document.close();
    win?.print();
    toast.success("Badge print dialog opened");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" />
            Badge / ID Printing
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={add}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
            <Button size="sm" onClick={print} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div
          ref={printRef}
          className="flex gap-4 flex-wrap justify-center py-4 bg-muted/20 rounded-lg"
        >
          {badges.map((b) => (
            <BadgePreview key={b.id} badge={b} />
          ))}
        </div>

        {/* Editor */}
        <div className="space-y-3">
          {badges.map((badge) => (
            <div key={badge.id} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {BADGE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => update(badge.id, "color", c)}
                      className={`w-5 h-5 rounded-full ${badge.color === c ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => remove(badge.id)}
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["name", "Name"],
                    ["role", "Role"],
                    ["department", "Department"],
                    ["eventOrId", "Event / ID"],
                  ] as [keyof BadgeData, string][]
                ).map(([f, l]) => (
                  <div key={f} className="space-y-0.5">
                    <Label className="text-[10px]">{l}</Label>
                    <Input
                      value={badge[f] as string}
                      onChange={(e) => update(badge.id, f, e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
