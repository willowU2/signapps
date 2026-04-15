"use client";

import { useState } from "react";
import { Clock, Award, AlertCircle } from "lucide-react";

interface PayVariable {
  id: string;
  employeeId: string;
  employeeName: string;
  overtimeHours: number;
  bonusAmount: number;
  absenceDays: number;
  month: string;
}

const DEFAULT_VARIABLES: PayVariable[] = [
  {
    id: "1",
    employeeId: "EMP-2026-001",
    employeeName: "Marie Dubois",
    overtimeHours: 8,
    bonusAmount: 500,
    absenceDays: 0,
    month: "March 2026",
  },
  {
    id: "2",
    employeeId: "EMP-2026-002",
    employeeName: "Pierre Martin",
    overtimeHours: 12,
    bonusAmount: 0,
    absenceDays: 2,
    month: "March 2026",
  },
  {
    id: "3",
    employeeId: "EMP-2026-003",
    employeeName: "Sophie Laurent",
    overtimeHours: 4,
    bonusAmount: 250,
    absenceDays: 1,
    month: "March 2026",
  },
  {
    id: "4",
    employeeId: "EMP-2026-004",
    employeeName: "Jean Benoit",
    overtimeHours: 0,
    bonusAmount: 1000,
    absenceDays: 0,
    month: "March 2026",
  },
];

export function PayVariables() {
  const [variables, setVariables] = useState<PayVariable[]>(DEFAULT_VARIABLES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PayVariable>>({});

  const handleEditStart = (variable: PayVariable) => {
    setEditingId(variable.id);
    setEditValues(variable);
  };

  const handleEditSave = (id: string) => {
    setVariables(
      variables.map((v) => (v.id === id ? { ...v, ...editValues } : v)),
    );
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleFieldChange = (
    field: keyof PayVariable,
    value: string | number,
  ) => {
    setEditValues({
      ...editValues,
      [field]: typeof value === "string" ? parseFloat(value) || 0 : value,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Pay Variables</h2>
        <p className="text-muted-foreground">
          Manage monthly overtime, bonuses, and absences
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted border-b p-4">
          <h3 className="font-semibold text-foreground">Monthly Variables</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-card">
            <thead className="bg-muted border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  Employee
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  ID
                </th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4" />
                    Overtime Hours
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">
                  <div className="flex items-center justify-center gap-1">
                    <Award className="w-4 h-4" />
                    Bonus (€)
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">
                  <div className="flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Absence Days
                  </div>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variables.map((variable) => (
                <tr key={variable.id} className="hover:bg-muted">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {variable.employeeName}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-muted-foreground font-mono text-xs">
                      {variable.employeeId}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === variable.id ? (
                      <input
                        type="number"
                        value={editValues.overtimeHours || 0}
                        onChange={(e) =>
                          handleFieldChange("overtimeHours", e.target.value)
                        }
                        className="w-16 border rounded px-2 py-1 text-center text-sm"
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {variable.overtimeHours}h
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === variable.id ? (
                      <input
                        type="number"
                        value={editValues.bonusAmount || 0}
                        onChange={(e) =>
                          handleFieldChange("bonusAmount", e.target.value)
                        }
                        className="w-20 border rounded px-2 py-1 text-center text-sm"
                      />
                    ) : (
                      <p className="text-green-700 font-medium">
                        €{variable.bonusAmount.toFixed(2)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === variable.id ? (
                      <input
                        type="number"
                        value={editValues.absenceDays || 0}
                        onChange={(e) =>
                          handleFieldChange("absenceDays", e.target.value)
                        }
                        className="w-16 border rounded px-2 py-1 text-center text-sm"
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {variable.absenceDays}d
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {editingId === variable.id ? (
                      <>
                        <button
                          onClick={() => handleEditSave(variable.id)}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="text-muted-foreground hover:text-gray-800 text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEditStart(variable)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
