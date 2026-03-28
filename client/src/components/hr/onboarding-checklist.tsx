"use client";

import { useState } from "react";
import { CheckCircle, Circle, Plus, Trash2, UserPlus, Calendar } from "lucide-react";

interface OnboardingTask {
  id: string;
  title: string;
  category: "it" | "access" | "training" | "admin" | "meeting" | "equipment";
  dueDay: number;
  assignee: string;
  completed: boolean;
  notes?: string;
}

interface Hire {
  id: string;
  name: string;
  position: string;
  startDate: string;
  department: string;
  tasks: OnboardingTask[];
}

const TASK_TEMPLATES: Omit<OnboardingTask, "id" | "completed">[] = [
  { title: "Préparer le poste de travail", category: "it", dueDay: -2, assignee: "IT" },
  { title: "Créer le compte email", category: "it", dueDay: -1, assignee: "IT" },
  { title: "Configurer VPN & accès", category: "access", dueDay: 1, assignee: "IT" },
  { title: "Badge et accès physique", category: "access", dueDay: 1, assignee: "RH" },
  { title: "Remise du matériel (pc, téléphone)", category: "equipment", dueDay: 1, assignee: "IT" },
  { title: "Présentation à l'équipe", category: "meeting", dueDay: 1, assignee: "Manager" },
  { title: "Formation politique de sécurité", category: "training", dueDay: 3, assignee: "RH" },
  { title: "Formation outils internes", category: "training", dueDay: 5, assignee: "IT" },
  { title: "Entretien RH d'intégration", category: "meeting", dueDay: 7, assignee: "RH" },
  { title: "Point d'étonnement J+30", category: "meeting", dueDay: 30, assignee: "Manager" },
  { title: "Signature contrat et documents légaux", category: "admin", dueDay: 1, assignee: "RH" },
  { title: "Mutuelle & avantages", category: "admin", dueDay: 7, assignee: "RH" },
];

const CATEGORY_COLORS: Record<string, string> = {
  it: "bg-blue-100 text-blue-700",
  access: "bg-purple-100 text-purple-700",
  training: "bg-orange-100 text-orange-700",
  meeting: "bg-green-100 text-green-700",
  equipment: "bg-gray-100 text-gray-700",
  admin: "bg-red-100 text-red-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  it: "IT", access: "Accès", training: "Formation", meeting: "Réunion", equipment: "Matériel", admin: "Admin",
};

const INIT_HIRES: Hire[] = [
  {
    id: "h1", name: "Lucas Moreau", position: "Développeur Full-Stack", startDate: "2026-04-07", department: "Technologie",
    tasks: TASK_TEMPLATES.map((t, i) => ({ ...t, id: `h1-${i}`, completed: i < 4 })),
  },
];

export function OnboardingChecklist() {
  const [hires, setHires] = useState<Hire[]>(INIT_HIRES);
  const [activeHire, setActiveHire] = useState<string>(INIT_HIRES[0].id);
  const [showNewHire, setShowNewHire] = useState(false);
  const [newHireForm, setNewHireForm] = useState({ name: "", position: "", startDate: "", department: "" });
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const hire = hires.find(h => h.id === activeHire);
  if (!hire) return null;

  const filtered = filterCategory === "all" ? hire.tasks : hire.tasks.filter(t => t.category === filterCategory);
  const completedCount = hire.tasks.filter(t => t.completed).length;
  const progress = Math.round((completedCount / hire.tasks.length) * 100);

  const handleToggle = (taskId: string) => {
    setHires(prev => prev.map(h => h.id === activeHire ? {
      ...h, tasks: h.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    } : h));
  };

  const handleAddHire = () => {
    if (!newHireForm.name || !newHireForm.startDate) return;
    const newHire: Hire = {
      id: String(Date.now()), ...newHireForm,
      tasks: TASK_TEMPLATES.map((t, i) => ({ ...t, id: `${Date.now()}-${i}`, completed: false })),
    };
    setHires(prev => [...prev, newHire]);
    setActiveHire(newHire.id);
    setShowNewHire(false);
    setNewHireForm({ name: "", position: "", startDate: "", department: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Onboarding des nouveaux employés</h2>
          <p className="text-gray-600">Checklist de tâches par embauche</p>
        </div>
        <button onClick={() => setShowNewHire(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <UserPlus className="w-4 h-4" /> Nouvelle embauche
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {hires.map(h => (
          <button key={h.id} onClick={() => setActiveHire(h.id)} className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${activeHire === h.id ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"}`}>
            {h.name} · <span className="opacity-75">{h.position}</span>
          </button>
        ))}
      </div>

      {showNewHire && (
        <div className="rounded-lg border bg-blue-50 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Nouvelle embauche</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Nom complet</label><input value={newHireForm.name} onChange={e => setNewHireForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Poste</label><input value={newHireForm.position} onChange={e => setNewHireForm(f => ({ ...f, position: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Date d'arrivée</label><input type="date" value={newHireForm.startDate} onChange={e => setNewHireForm(f => ({ ...f, startDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Département</label><input value={newHireForm.department} onChange={e => setNewHireForm(f => ({ ...f, department: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddHire} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Créer</button>
            <button onClick={() => setShowNewHire(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-semibold text-gray-900">{hire.name}</p>
            <p className="text-sm text-gray-500">{hire.position} · {hire.department} · Arrivée : {hire.startDate}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{progress}%</p>
            <p className="text-xs text-gray-500">{completedCount}/{hire.tasks.length} tâches</p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", ...Object.keys(CATEGORY_LABELS)] as const).map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterCategory === cat ? "bg-gray-800 text-white" : cat === "all" ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : `${CATEGORY_COLORS[cat]} hover:opacity-80`}`}>
            {cat === "all" ? "Toutes" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-white divide-y">
        {filtered.map(task => (
          <div key={task.id} onClick={() => handleToggle(task.id)} className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="mt-0.5 flex-shrink-0">
              {task.completed ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Circle className="w-5 h-5 text-gray-300" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${task.completed ? "line-through text-gray-400" : "text-gray-900"}`}>{task.title}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[task.category]}`}>{CATEGORY_LABELS[task.category]}</span>
                <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> J{task.dueDay > 0 ? "+" : ""}{task.dueDay}</span>
                <span className="text-xs text-gray-500">→ {task.assignee}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
