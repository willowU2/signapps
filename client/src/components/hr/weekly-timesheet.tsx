"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Save, Clock } from "lucide-react";

const PROJECTS = [
  "SignApps Platform",
  "Support client",
  "Administration",
  "Formation",
  "R&D",
];
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

type TimeEntry = Record<string, Record<string, number>>;

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  return DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function fmt(d: Date) {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const INIT_ENTRIES: TimeEntry = {
  "SignApps Platform": { Lun: 7, Mar: 8, Mer: 6, Jeu: 7.5, Ven: 4 },
  "Support client": { Lun: 1, Mar: 0, Mer: 2, Jeu: 0.5, Ven: 3 },
  Administration: { Lun: 0, Mar: 0, Mer: 0, Jeu: 0, Ven: 1 },
  Formation: { Lun: 0, Mar: 0, Mer: 0, Jeu: 0, Ven: 0 },
  "R&D": { Lun: 0, Mar: 0, Mer: 0, Jeu: 0, Ven: 0 },
};

export function WeeklyTimesheet() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<TimeEntry>(INIT_ENTRIES);
  const [saved, setSaved] = useState(false);

  const dates = getWeekDates(weekOffset);

  const handleChange = (project: string, day: string, val: string) => {
    const num = parseFloat(val) || 0;
    setEntries((prev) => ({
      ...prev,
      [project]: { ...prev[project], [day]: Math.min(24, Math.max(0, num)) },
    }));
    setSaved(false);
  };

  const getDayTotal = (day: string) =>
    PROJECTS.reduce((s, p) => s + (entries[p]?.[day] || 0), 0);
  const getProjectTotal = (project: string) =>
    DAYS.reduce((s, d) => s + (entries[project]?.[d] || 0), 0);
  const weekTotal = DAYS.reduce((s, d) => s + getDayTotal(d), 0);

  const handleSave = () => setSaved(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Feuille de temps hebdomadaire
          </h2>
          <p className="text-muted-foreground">
            Saisie des heures par projet et par jour
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            <button
              onClick={() => {
                setWeekOffset((w) => w - 1);
                setSaved(false);
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium px-2">
              {weekOffset === 0
                ? "Cette semaine"
                : weekOffset === -1
                  ? "Semaine passée"
                  : `S${weekOffset > 0 ? "+" : ""}${weekOffset}`}
            </span>
            <button
              onClick={() => {
                setWeekOffset((w) => w + 1);
                setSaved(false);
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? "bg-green-100 text-green-700" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
          >
            <Save className="w-4 h-4" />
            {saved ? "Enregistré" : "Enregistrer"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-blue-50 p-4 flex items-center gap-3">
        <Clock className="w-5 h-5 text-blue-600" />
        <div>
          <p className="text-sm font-medium text-blue-900">
            Total semaine :{" "}
            <span className="font-bold">{weekTotal.toFixed(1)}h</span>
          </p>
          <p className="text-xs text-blue-700">Objectif : 37.5h / semaine</p>
        </div>
        <div className="ml-auto flex-1 max-w-xs">
          <div className="h-2 rounded-full bg-blue-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, (weekTotal / 37.5) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b">
              <th className="px-4 py-3 text-left font-semibold text-foreground w-48">
                Projet / Tâche
              </th>
              {DAYS.map((day, i) => (
                <th
                  key={day}
                  className="px-3 py-3 text-center font-semibold text-foreground min-w-[80px]"
                >
                  <div>{day}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {fmt(dates[i])}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-center font-semibold text-foreground">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {PROJECTS.map((project) => (
              <tr key={project} className="hover:bg-muted">
                <td className="px-4 py-3 font-medium text-foreground">
                  {project}
                </td>
                {DAYS.map((day) => (
                  <td key={day} className="px-2 py-2 text-center">
                    <input
                      type="number"
                      value={entries[project]?.[day] || ""}
                      onChange={(e) =>
                        handleChange(project, day, e.target.value)
                      }
                      className="w-16 border rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max="24"
                      step="0.5"
                      placeholder="0"
                    />
                  </td>
                ))}
                <td className="px-4 py-3 text-center font-bold text-foreground">
                  {getProjectTotal(project).toFixed(1)}h
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted font-bold border-t-2">
              <td className="px-4 py-3 text-foreground">Total / jour</td>
              {DAYS.map((day) => (
                <td
                  key={day}
                  className={`px-3 py-3 text-center ${getDayTotal(day) > 8 ? "text-amber-600" : "text-foreground"}`}
                >
                  {getDayTotal(day).toFixed(1)}h
                </td>
              ))}
              <td className="px-4 py-3 text-center text-blue-700">
                {weekTotal.toFixed(1)}h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
