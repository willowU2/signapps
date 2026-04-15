// Feature 5: Project time tracking → feed HR timesheets

import { useState, useCallback } from "react";

export interface ProjectTimeEntry {
  id: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  employeeId: string;
  employeeName: string;
  date: string; // ISO date
  minutes: number;
  billable: boolean;
  syncedToHR: boolean;
}

export interface HRTimesheetEntry {
  employeeId: string;
  employeeName: string;
  weekStart: string;
  entries: {
    projectName: string;
    taskTitle: string;
    date: string;
    hours: number;
    billable: boolean;
  }[];
  totalHours: number;
}

const DEMO_ENTRIES: ProjectTimeEntry[] = [
  {
    id: "te1",
    projectId: "p1",
    projectName: "Refonte Backend Auth",
    taskId: "t1",
    taskTitle: "API JWT",
    employeeId: "1",
    employeeName: "Alice Martin",
    date: "2026-03-24",
    minutes: 240,
    billable: true,
    syncedToHR: false,
  },
  {
    id: "te2",
    projectId: "p1",
    projectName: "Refonte Backend Auth",
    taskId: "t2",
    taskTitle: "Tests unitaires",
    employeeId: "1",
    employeeName: "Alice Martin",
    date: "2026-03-25",
    minutes: 120,
    billable: true,
    syncedToHR: false,
  },
  {
    id: "te3",
    projectId: "p2",
    projectName: "Dashboard Analytics",
    taskId: "t3",
    taskTitle: "Composant graphique",
    employeeId: "1",
    employeeName: "Alice Martin",
    date: "2026-03-25",
    minutes: 90,
    billable: false,
    syncedToHR: true,
  },
];

function groupToTimesheets(entries: ProjectTimeEntry[]): HRTimesheetEntry[] {
  const byEmployee = new Map<string, ProjectTimeEntry[]>();
  for (const e of entries) {
    const list = byEmployee.get(e.employeeId) ?? [];
    list.push(e);
    byEmployee.set(e.employeeId, list);
  }

  return Array.from(byEmployee.entries()).map(([, empEntries]) => {
    const first = empEntries[0];
    const totalHours = empEntries.reduce((acc, e) => acc + e.minutes / 60, 0);
    return {
      employeeId: first.employeeId,
      employeeName: first.employeeName,
      weekStart: empEntries.sort((a, b) => a.date.localeCompare(b.date))[0]
        .date,
      entries: empEntries.map((e) => ({
        projectName: e.projectName,
        taskTitle: e.taskTitle,
        date: e.date,
        hours: Math.round((e.minutes / 60) * 10) / 10,
        billable: e.billable,
      })),
      totalHours: Math.round(totalHours * 10) / 10,
    };
  });
}

export function useProjectTimesheets() {
  const [entries, setEntries] = useState<ProjectTimeEntry[]>(DEMO_ENTRIES);
  const [syncing, setSyncing] = useState(false);

  const timesheets = groupToTimesheets(entries);
  const pendingSync = entries.filter((e) => !e.syncedToHR).length;

  const syncToHR = useCallback(async () => {
    setSyncing(true);
    // Simulate API call to HR timesheet service
    await new Promise((resolve) => setTimeout(resolve, 800));
    setEntries((prev) => prev.map((e) => ({ ...e, syncedToHR: true })));
    setSyncing(false);
  }, []);

  const addEntry = useCallback(
    (entry: Omit<ProjectTimeEntry, "id" | "syncedToHR">) => {
      setEntries((prev) => [
        ...prev,
        { ...entry, id: `te-${Date.now()}`, syncedToHR: false },
      ]);
    },
    [],
  );

  return { entries, timesheets, pendingSync, syncing, syncToHR, addEntry };
}
