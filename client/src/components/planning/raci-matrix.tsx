"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type RACIRole = "R" | "A" | "C" | "I" | "";

interface RACICell {
  taskId: string;
  roleId: string;
  value: RACIRole;
}

export default function RACIMatrix() {
  const tasks = ["Design Brief", "Development", "Testing", "Deployment"];
  const roles = ["PM", "Dev Lead", "QA Lead", "DevOps"];

  const [matrix, setMatrix] = useState<Map<string, RACIRole>>(
    new Map([
      ["Design Brief-PM", "A"],
      ["Design Brief-Dev Lead", "C"],
      ["Development-PM", "C"],
      ["Development-Dev Lead", "R"],
      ["Development-QA Lead", "I"],
      ["Testing-QA Lead", "R"],
      ["Testing-Dev Lead", "C"],
      ["Deployment-DevOps", "R"],
    ]),
  );

  const options: RACIRole[] = ["R", "A", "C", "I", ""];

  const toggleCell = (task: string, role: string) => {
    const key = `${task}-${role}`;
    const current = matrix.get(key) || "";
    const nextIndex = (options.indexOf(current) + 1) % options.length;
    const newMatrix = new Map(matrix);
    const newValue = options[nextIndex];
    if (newValue) newMatrix.set(key, newValue);
    else newMatrix.delete(key);
    setMatrix(newMatrix);
  };

  const exportPDF = () => {
    window.print();
    toast.success("PDF généré");
  };

  const getCellColor = (value: RACIRole) => {
    const colors: Record<RACIRole, string> = {
      R: "bg-red-100 text-red-900",
      A: "bg-blue-100 text-blue-900",
      C: "bg-yellow-100 text-yellow-900",
      I: "bg-muted text-foreground",
      "": "bg-card",
    };
    return colors[value];
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">RACI Matrix</h2>
        <Button size="sm" onClick={exportPDF} className="gap-2">
          <Download className="w-4 h-4" />
          Export PDF
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-2 bg-muted font-bold text-left">Task</th>
              {roles.map((role) => (
                <th
                  key={role}
                  className="border p-2 bg-muted font-bold text-center w-16"
                >
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task}>
                <td className="border p-2 font-medium">{task}</td>
                {roles.map((role) => {
                  const key = `${task}-${role}`;
                  const value = matrix.get(key) || "";
                  return (
                    <td
                      key={key}
                      className={`border p-2 text-center cursor-pointer transition-colors font-bold ${getCellColor(value)}`}
                      onClick={() => toggleCell(task, role)}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-red-50 rounded">R = Responsible</div>
        <div className="p-2 bg-blue-50 rounded">A = Accountable</div>
        <div className="p-2 bg-yellow-50 rounded">C = Consulted</div>
        <div className="p-2 bg-muted rounded">I = Informed</div>
      </div>
    </div>
  );
}
