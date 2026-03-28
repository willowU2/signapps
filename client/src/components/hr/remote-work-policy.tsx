"use client";

import { useState } from "react";
import { Home, Building2, Save, CheckCircle, Info } from "lucide-react";

interface EmployeePolicy {
  id: string;
  name: string;
  role: string;
  department: string;
  daysRemote: number;
  daysOffice: number;
  remoteWeekdays: string[];
  officeWeekdays: string[];
  notes: string;
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

const INIT_POLICIES: EmployeePolicy[] = [
  { id: "1", name: "Alice Martin", role: "Lead Developer", department: "Technologie", daysRemote: 3, daysOffice: 2, remoteWeekdays: ["Lun", "Mar", "Mer"], officeWeekdays: ["Jeu", "Ven"], notes: "" },
  { id: "2", name: "Bob Dupont", role: "DevOps", department: "Technologie", daysRemote: 4, daysOffice: 1, remoteWeekdays: ["Lun", "Mar", "Jeu", "Ven"], officeWeekdays: ["Mer"], notes: "Infrastructure critique, présence mer. obligatoire" },
  { id: "3", name: "Claire Bernard", role: "Commerciale", department: "Commercial", daysRemote: 1, daysOffice: 4, remoteWeekdays: ["Mer"], officeWeekdays: ["Lun", "Mar", "Jeu", "Ven"], notes: "" },
  { id: "4", name: "David Petit", role: "Comptable", department: "Finance", daysRemote: 2, daysOffice: 3, remoteWeekdays: ["Lun", "Ven"], officeWeekdays: ["Mar", "Mer", "Jeu"], notes: "" },
  { id: "5", name: "Emma Leroy", role: "Designer", department: "Technologie", daysRemote: 3, daysOffice: 2, remoteWeekdays: ["Lun", "Mar", "Ven"], officeWeekdays: ["Mer", "Jeu"], notes: "" },
];

const DEPT_POLICY = { maxRemoteDays: 3, minOfficeDays: 1, remoteAllowed: true };

export function RemoteWorkPolicy() {
  const [policies, setPolicies] = useState<EmployeePolicy[]>(INIT_POLICIES);
  const [editId, setEditId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [globalMax, setGlobalMax] = useState(3);

  const handleToggleDay = (empId: string, day: string, type: "remote" | "office") => {
    setPolicies(prev => prev.map(p => {
      if (p.id !== empId) return p;
      if (type === "remote") {
        const has = p.remoteWeekdays.includes(day);
        const newRemote = has ? p.remoteWeekdays.filter(d => d !== day) : [...p.remoteWeekdays, day];
        const newOffice = p.officeWeekdays.filter(d => d !== day);
        if (!has) newOffice.splice(newOffice.indexOf(day), 1);
        return { ...p, remoteWeekdays: newRemote, officeWeekdays: WEEKDAYS.filter(d => !newRemote.includes(d)), daysRemote: newRemote.length, daysOffice: WEEKDAYS.length - newRemote.length };
      }
      return p;
    }));
    setSaved(prev => { const s = new Set(prev); s.delete(empId); return s; });
  };

  const handleSave = (id: string) => {
    setSaved(prev => new Set([...prev, id]));
    setEditId(null);
  };

  const handleNoteChange = (id: string, note: string) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, notes: note } : p));
  };

  const avgRemote = Math.round(policies.reduce((s, p) => s + p.daysRemote, 0) / policies.length * 10) / 10;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Politique de télétravail</h2>
          <p className="text-gray-600">Configuration bureau/télétravail par employé</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-1"><Home className="w-4 h-4 text-blue-600" /><span className="text-xs text-blue-700 font-medium">Moy. jours télétravail</span></div>
          <p className="text-2xl font-bold text-blue-900">{avgRemote}j / sem</p>
        </div>
        <div className="rounded-lg border bg-orange-50 p-4">
          <div className="flex items-center gap-2 mb-1"><Building2 className="w-4 h-4 text-orange-600" /><span className="text-xs text-orange-700 font-medium">Max autorisé (politique)</span></div>
          <div className="flex items-center gap-2">
            <input type="number" value={globalMax} onChange={e => setGlobalMax(Number(e.target.value))} min={0} max={5} className="w-16 border rounded px-2 py-1 text-sm font-bold text-orange-900 bg-transparent" />
            <span className="text-orange-700 font-medium">j / sem</span>
          </div>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-xs text-green-700 font-medium">Conformes à la politique</span></div>
          <p className="text-2xl font-bold text-green-900">{policies.filter(p => p.daysRemote <= globalMax).length}/{policies.length}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-amber-50 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">Sélectionnez les jours de télétravail pour chaque employé. Les jours non sélectionnés sont automatiquement comptés comme jours au bureau. Cliquez sur un employé pour modifier sa configuration.</p>
      </div>

      <div className="space-y-3">
        {policies.map(emp => {
          const isEditing = editId === emp.id;
          const isSaved = saved.has(emp.id);
          const overLimit = emp.daysRemote > globalMax;
          return (
            <div key={emp.id} className={`rounded-lg border bg-white p-4 transition-all ${overLimit ? "border-red-300 bg-red-50/30" : ""}`}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {emp.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900">{emp.name}</p>
                    <span className="text-xs text-gray-500">{emp.role} · {emp.department}</span>
                    {overLimit && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Dépasse la politique ({emp.daysRemote}j)</span>}
                    {isSaved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Enregistré</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1">
                      <Home className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-sm text-blue-600 font-medium">{emp.daysRemote}j télétravail</span>
                    </div>
                    <span className="text-gray-300">·</span>
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-sm text-orange-600 font-medium">{emp.daysOffice}j bureau</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mb-2">
                    {WEEKDAYS.map(day => {
                      const isRemote = emp.remoteWeekdays.includes(day);
                      return (
                        <button key={day} onClick={() => isEditing && handleToggleDay(emp.id, day, "remote")}
                          disabled={!isEditing}
                          className={`w-10 h-8 rounded text-xs font-medium transition-colors ${isRemote ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"} ${isEditing ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  {isEditing && (
                    <input value={emp.notes} onChange={e => handleNoteChange(emp.id, e.target.value)} placeholder="Notes..." className="w-full border rounded px-3 py-1.5 text-sm mt-1" />
                  )}
                  {!isEditing && emp.notes && <p className="text-xs text-gray-500 italic mt-1">{emp.notes}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {isEditing ? (
                    <button onClick={() => handleSave(emp.id)} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                      <Save className="w-3.5 h-3.5" /> Sauvegarder
                    </button>
                  ) : (
                    <button onClick={() => setEditId(emp.id)} className="border hover:bg-gray-50 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700">Modifier</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
