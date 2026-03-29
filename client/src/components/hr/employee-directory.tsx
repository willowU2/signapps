"use client";

import { useState } from "react";
import { Search, Mail, Phone, Building2, ExternalLink } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  location: string;
  status: "active" | "remote" | "away";
  joinDate: string;
  skills: string[];
  avatar?: string;
}

const EMPLOYEES: Employee[] = [
  { id: "1", name: "Alice Martin", role: "Lead Developer", department: "Technologie", email: "alice.martin@signApps.io", phone: "+33 6 12 34 56 78", location: "Paris", status: "active", joinDate: "2023-03-01", skills: ["React", "TypeScript", "Rust"] },
  { id: "2", name: "Bob Dupont", role: "DevOps Engineer", department: "Technologie", email: "bob.dupont@signapps.io", phone: "+33 6 23 45 67 89", location: "Lyon", status: "remote", joinDate: "2022-07-15", skills: ["Docker", "Kubernetes", "CI/CD"] },
  { id: "3", name: "Claire Bernard", role: "Commerciale Senior", department: "Commercial", email: "claire.bernard@signapps.io", phone: "+33 6 34 56 78 90", location: "Paris", status: "active", joinDate: "2021-01-10", skills: ["CRM", "Négociation", "Prospection"] },
  { id: "4", name: "David Petit", role: "Comptable", department: "Finance", email: "david.petit@signapps.io", phone: "+33 6 45 67 89 01", location: "Bordeaux", status: "active", joinDate: "2020-09-01", skills: ["Comptabilité", "Excel", "FEC"] },
  { id: "5", name: "Emma Leroy", role: "Designer UX/UI", department: "Technologie", email: "emma.leroy@signapps.io", phone: "+33 6 56 78 90 12", location: "Paris", status: "active", joinDate: "2024-01-15", skills: ["Figma", "Design System", "A/B Testing"] },
  { id: "6", name: "François Moreau", role: "Support Client", department: "Commercial", email: "f.moreau@signapps.io", phone: "+33 6 67 89 01 23", location: "Nantes", status: "away", joinDate: "2023-06-01", skills: ["Helpdesk", "Zendesk", "Communication"] },
  { id: "7", name: "Nadia Rousseau", role: "RH Manager", department: "RH", email: "nadia.rousseau@signapps.io", phone: "+33 6 78 90 12 34", location: "Paris", status: "active", joinDate: "2019-04-01", skills: ["Recrutement", "SIRH", "Formation"] },
  { id: "8", name: "Marc Dubois", role: "Backend Developer", department: "Technologie", email: "marc.dubois@signapps.io", phone: "+33 6 89 01 23 45", location: "Toulouse", status: "remote", joinDate: "2023-09-15", skills: ["Rust", "Axum", "PostgreSQL"] },
];

const STATUS_CONFIG = {
  active: { label: "Présent", color: "bg-green-500" },
  remote: { label: "Télétravail", color: "bg-blue-500" },
  away: { label: "Absent", color: "bg-gray-400" },
};

const DEPTS = [...new Set(EMPLOYEES.map(e => e.department))];

export function EmployeeDirectory() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Employee | null>(null);

  const filtered = EMPLOYEES.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase()) || e.department.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || e.department === deptFilter;
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Annuaire des employés</h2>
          <p className="text-muted-foreground">Fiches employés avec photo, rôle, département et contact</p>
        </div>
        <span className="text-sm text-muted-foreground font-medium">{filtered.length} / {EMPLOYEES.length} employés</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un employé..." className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">Tous les départements</option>
          {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">Tous statuts</option>
          <option value="active">Présent</option>
          <option value="remote">Télétravail</option>
          <option value="away">Absent</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(emp => (
          <div key={emp.id} onClick={() => setSelected(emp)} className="rounded-xl border bg-card p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-blue-200">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                {emp.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${STATUS_CONFIG[emp.status].color}`} />
                <span className="text-xs text-muted-foreground">{STATUS_CONFIG[emp.status].label}</span>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">{emp.name}</p>
              <p className="text-sm text-muted-foreground">{emp.role}</p>
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-muted-foreground">{emp.department} · {emp.location}</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {emp.skills.slice(0, 2).map(s => (
                <span key={s} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{s}</span>
              ))}
              {emp.skills.length > 2 && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">+{emp.skills.length - 2}</span>}
            </div>
            <div className="mt-3 pt-3 border-t flex gap-2">
              <a href={`mailto:${emp.email}`} onClick={e => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800 py-1 rounded hover:bg-blue-50">
                <Mail className="w-3.5 h-3.5" /> Email
              </a>
              <a href={`tel:${emp.phone}`} onClick={e => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-gray-800 py-1 rounded hover:bg-muted">
                <Phone className="w-3.5 h-3.5" /> Appeler
              </a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">Aucun employé trouvé</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-card rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                {selected.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{selected.name}</h3>
                    <p className="text-muted-foreground">{selected.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selected.status].color}`} />
                      <span className="text-sm text-muted-foreground">{STATUS_CONFIG[selected.status].label}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-muted-foreground text-2xl leading-none">&times;</button>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Département</span><p className="font-medium">{selected.department}</p></div>
              <div><span className="text-muted-foreground">Site</span><p className="font-medium">{selected.location}</p></div>
              <div><span className="text-muted-foreground">Email</span><a href={`mailto:${selected.email}`} className="font-medium text-blue-600 hover:underline flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{selected.email}</a></div>
              <div><span className="text-muted-foreground">Téléphone</span><p className="font-medium">{selected.phone}</p></div>
              <div><span className="text-muted-foreground">Arrivée</span><p className="font-medium">{selected.joinDate}</p></div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Compétences</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.skills.map(s => <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">{s}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
