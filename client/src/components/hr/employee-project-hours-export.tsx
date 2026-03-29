"use client";

// Feature 21: HR → export employee project hours

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Clock, Filter } from "lucide-react";
import { toast } from "sonner";

interface EmployeeHourRow {
  employeeName: string;
  projectName: string;
  week: string;
  regularHours: number;
  overtimeHours: number;
  billableHours: number;
}

const DEMO_ROWS: EmployeeHourRow[] = [
  { employeeName: "Alice Martin", projectName: "Refonte Backend Auth", week: "2026-W13", regularHours: 32, overtimeHours: 4, billableHours: 36 },
  { employeeName: "Alice Martin", projectName: "Dashboard Analytics", week: "2026-W13", regularHours: 8, overtimeHours: 0, billableHours: 8 },
  { employeeName: "Bob Dupont", projectName: "Refonte Backend Auth", week: "2026-W13", regularHours: 20, overtimeHours: 0, billableHours: 20 },
  { employeeName: "Marc Dubois", projectName: "Refonte Backend Auth", week: "2026-W13", regularHours: 24, overtimeHours: 2, billableHours: 26 },
  { employeeName: "Emma Leroy", projectName: "Dashboard Analytics", week: "2026-W13", regularHours: 16, overtimeHours: 0, billableHours: 12 },
];

function exportToCSV(rows: EmployeeHourRow[]) {
  const headers = ["Employé", "Projet", "Semaine", "Heures normales", "Heures supp.", "Heures facturables"];
  const lines = rows.map((r) => [r.employeeName, r.projectName, r.week, r.regularHours, r.overtimeHours, r.billableHours].join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `heures-projet-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EmployeeProjectHoursExport() {
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");

  const employees = [...new Set(DEMO_ROWS.map((r) => r.employeeName))];
  const projects = [...new Set(DEMO_ROWS.map((r) => r.projectName))];

  const filtered = DEMO_ROWS.filter((r) =>
    (filterEmployee === "all" || r.employeeName === filterEmployee) &&
    (filterProject === "all" || r.projectName === filterProject)
  );

  const totalHours = filtered.reduce((acc, r) => acc + r.regularHours + r.overtimeHours, 0);
  const totalBillable = filtered.reduce((acc, r) => acc + r.billableHours, 0);

  function handleExport() {
    exportToCSV(filtered);
    toast.success(`Export réussi`, { description: `${filtered.length} lignes exportées en CSV.` });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4" />
            Heures projet par employé
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />{totalHours}h total
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Employé" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Tous les employés</SelectItem>
              {employees.map((e) => <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Projet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Tous les projets</SelectItem>
              {projects.map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium">Employé</th>
                <th className="text-left px-2 py-1.5 font-medium">Projet</th>
                <th className="text-right px-2 py-1.5 font-medium">Norm.</th>
                <th className="text-right px-2 py-1.5 font-medium">Supp.</th>
                <th className="text-right px-2 py-1.5 font-medium">Fact.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-2 py-1.5 truncate max-w-[80px]">{row.employeeName.split(" ")[0]}</td>
                  <td className="px-2 py-1.5 truncate max-w-[80px] text-muted-foreground">{row.projectName.split(" ")[0]}</td>
                  <td className="px-2 py-1.5 text-right">{row.regularHours}h</td>
                  <td className="px-2 py-1.5 text-right text-orange-600">{row.overtimeHours}h</td>
                  <td className="px-2 py-1.5 text-right text-blue-600">{row.billableHours}h</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 font-medium">
              <tr>
                <td colSpan={2} className="px-2 py-1.5 text-xs">Total ({filtered.length} lignes)</td>
                <td colSpan={2} className="px-2 py-1.5 text-right text-xs">{totalHours}h</td>
                <td className="px-2 py-1.5 text-right text-xs text-blue-600">{totalBillable}h</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <Button className="w-full h-7 gap-1 text-xs" onClick={handleExport}>
          <Download className="size-3.5" /> Exporter CSV
        </Button>
      </CardContent>
    </Card>
  );
}
