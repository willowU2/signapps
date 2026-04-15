"use client";

import { useState } from "react";
import { Cake, Heart, Bell, BellOff, Gift, ChevronRight } from "lucide-react";

interface Alert {
  id: string;
  name: string;
  type: "birthday" | "anniversary";
  date: string;
  daysUntil: number;
  years?: number;
  department: string;
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  const [_, month, day] = dateStr.split("-").map(Number);
  const nextDate = new Date(today.getFullYear(), month - 1, day);
  if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
  return Math.ceil(
    (nextDate.getTime() - today.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24),
  );
}

const RAW_ALERTS: Omit<Alert, "daysUntil">[] = [
  {
    id: "1",
    name: "Alice Martin",
    type: "birthday",
    date: "2026-04-02",
    department: "Technologie",
  },
  {
    id: "2",
    name: "Bob Dupont",
    type: "anniversary",
    date: "2022-04-05",
    years: 4,
    department: "Technologie",
  },
  {
    id: "3",
    name: "Claire Bernard",
    type: "birthday",
    date: "2026-04-10",
    department: "Commercial",
  },
  {
    id: "4",
    name: "David Petit",
    type: "anniversary",
    date: "2020-04-15",
    years: 6,
    department: "Finance",
  },
  {
    id: "5",
    name: "Emma Leroy",
    type: "birthday",
    date: "2026-04-20",
    department: "Technologie",
  },
  {
    id: "6",
    name: "François Moreau",
    type: "anniversary",
    date: "2023-04-25",
    years: 3,
    department: "Commercial",
  },
  {
    id: "7",
    name: "Nadia Rousseau",
    type: "birthday",
    date: "2026-05-03",
    department: "RH",
  },
  {
    id: "8",
    name: "Marc Dubois",
    type: "anniversary",
    date: "2023-05-10",
    years: 3,
    department: "Technologie",
  },
];

const ALERTS: Alert[] = RAW_ALERTS.map((a) => ({
  ...a,
  daysUntil: getDaysUntil(a.date),
})).sort((a, b) => a.daysUntil - b.daysUntil);

export function BirthdayAnniversaryAlerts() {
  const [notified, setNotified] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "birthday" | "anniversary">(
    "all",
  );
  const [horizon, setHorizon] = useState(30);

  const filtered = ALERTS.filter((a) => {
    const matchType = filter === "all" || a.type === filter;
    const matchDays = a.daysUntil <= horizon;
    return matchType && matchDays;
  });

  const toggleNotify = (id: string) => {
    setNotified((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const urgentCount = filtered.filter((a) => a.daysUntil <= 7).length;

  const getUrgencyClass = (days: number) => {
    if (days === 0) return "bg-red-100 border-red-300";
    if (days <= 3) return "bg-orange-50 border-orange-300";
    if (days <= 7) return "bg-amber-50 border-amber-200";
    return "bg-card border-border";
  };

  const formatDays = (days: number) => {
    if (days === 0) return "Aujourd'hui !";
    if (days === 1) return "Demain";
    return `Dans ${days} jours`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Anniversaires & Célébrations
          </h2>
          <p className="text-muted-foreground">
            Liste des prochaines célébrations à venir
          </p>
        </div>
        {urgentCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <Bell className="w-4 h-4 text-red-600 animate-pulse" />
            <span className="text-sm font-medium text-red-700">
              {urgentCount} dans les 7 prochains jours
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-pink-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Cake className="w-4 h-4 text-pink-600" />
            <span className="text-sm font-medium text-pink-700">
              Anniversaires
            </span>
          </div>
          <p className="text-2xl font-bold text-pink-900">
            {
              ALERTS.filter(
                (a) => a.type === "birthday" && a.daysUntil <= horizon,
              ).length
            }
          </p>
          <p className="text-xs text-pink-600">
            dans les {horizon} prochains jours
          </p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">
              Anciennetés
            </span>
          </div>
          <p className="text-2xl font-bold text-purple-900">
            {
              ALERTS.filter(
                (a) => a.type === "anniversary" && a.daysUntil <= horizon,
              ).length
            }
          </p>
          <p className="text-xs text-purple-600">
            dans les {horizon} prochains jours
          </p>
        </div>
        <div className="rounded-lg border bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">Urgents</span>
          </div>
          <p className="text-2xl font-bold text-amber-900">{urgentCount}</p>
          <p className="text-xs text-amber-600">dans les 7 prochains jours</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(["all", "birthday", "anniversary"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-gray-800 text-white" : "bg-muted hover:bg-gray-200 text-muted-foreground"}`}
            >
              {f === "all"
                ? "Tous"
                : f === "birthday"
                  ? "Anniversaires"
                  : "Anciennetés"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Horizon :</span>
          {[7, 14, 30, 60].map((d) => (
            <button
              key={d}
              onClick={() => setHorizon(d)}
              className={`px-2.5 py-1 rounded text-xs font-medium ${horizon === d ? "bg-blue-600 text-white" : "bg-muted hover:bg-gray-200 text-muted-foreground"}`}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${getUrgencyClass(alert.daysUntil)}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${alert.type === "birthday" ? "bg-pink-100" : "bg-purple-100"}`}
            >
              {alert.type === "birthday" ? (
                <Cake className="w-5 h-5 text-pink-600" />
              ) : (
                <Heart className="w-5 h-5 text-purple-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">{alert.name}</p>
                <span className="text-xs text-muted-foreground">
                  {alert.department}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {alert.type === "birthday"
                  ? "Anniversaire"
                  : `${alert.years} an${alert.years !== 1 ? "s" : ""} d'ancienneté`}
                {" · "}
                {alert.date}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p
                className={`text-sm font-bold ${alert.daysUntil === 0 ? "text-red-600" : alert.daysUntil <= 7 ? "text-orange-600" : "text-muted-foreground"}`}
              >
                {formatDays(alert.daysUntil)}
              </p>
            </div>
            <button
              onClick={() => toggleNotify(alert.id)}
              className={`p-2 rounded-lg transition-colors ${notified.has(alert.id) ? "bg-blue-100 text-blue-600" : "hover:bg-muted text-gray-400"}`}
            >
              {notified.has(alert.id) ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Gift className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Aucune célébration dans cet horizon</p>
          </div>
        )}
      </div>
    </div>
  );
}
