"use client";

import { useState } from "react";
import { Star, Users, Plus, CheckCircle, Send } from "lucide-react";

interface Reviewer {
  id: string;
  name: string;
  role: "self" | "manager" | "peer" | "direct_report";
  submitted: boolean;
  scores?: Record<string, number>;
  comment?: string;
}

interface ReviewCriteria {
  id: string;
  label: string;
  category: string;
}

const CRITERIA: ReviewCriteria[] = [
  { id: "comm", label: "Communication", category: "Soft Skills" },
  { id: "collab", label: "Collaboration", category: "Soft Skills" },
  { id: "leader", label: "Leadership", category: "Soft Skills" },
  { id: "tech", label: "Expertise technique", category: "Compétences" },
  { id: "deliv", label: "Livraison des résultats", category: "Performance" },
  { id: "innov", label: "Innovation", category: "Performance" },
];

const ROLE_LABELS: Record<string, string> = {
  self: "Auto-évaluation", manager: "Manager", peer: "Collègue", direct_report: "N-1",
};
const ROLE_COLORS: Record<string, string> = {
  self: "bg-purple-100 text-purple-700", manager: "bg-blue-100 text-blue-700",
  peer: "bg-green-100 text-green-700", direct_report: "bg-orange-100 text-orange-700",
};

const INIT_REVIEWERS: Reviewer[] = [
  { id: "1", name: "Alice Martin (vous)", role: "self", submitted: true, scores: { comm: 4, collab: 5, leader: 3, tech: 5, deliv: 4, innov: 4 }, comment: "Bonne année, quelques axes d'amélioration en leadership." },
  { id: "2", name: "Jean-Paul Directeur", role: "manager", submitted: true, scores: { comm: 4, collab: 4, leader: 4, tech: 5, deliv: 5, innov: 3 }, comment: "Excellent contributeur technique, montée en leadership nécessaire." },
  { id: "3", name: "Sophie Collègue", role: "peer", submitted: false },
  { id: "4", name: "Marc Junior", role: "direct_report", submitted: false },
];

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange?.(s)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`w-4 h-4 ${s <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
        </button>
      ))}
    </div>
  );
}

function avgScore(reviewers: Reviewer[], criteriaId: string): number {
  const submitted = reviewers.filter(r => r.submitted && r.scores);
  if (submitted.length === 0) return 0;
  return submitted.reduce((s, r) => s + (r.scores![criteriaId] || 0), 0) / submitted.length;
}

export function PerformanceReview360() {
  const [reviewers, setReviewers] = useState<Reviewer[]>(INIT_REVIEWERS);
  const [activeReviewer, setActiveReviewer] = useState<string | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, number>>({});
  const [draftComment, setDraftComment] = useState("");
  const [newName, setNewName] = useState("");

  const submittedCount = reviewers.filter(r => r.submitted).length;

  const handleStartReview = (id: string) => {
    const r = reviewers.find(r => r.id === id);
    setActiveReviewer(id);
    setDraftScores(r?.scores || {});
    setDraftComment(r?.comment || "");
  };

  const handleSubmitReview = () => {
    if (!activeReviewer) return;
    setReviewers(prev => prev.map(r => r.id === activeReviewer ? { ...r, submitted: true, scores: draftScores, comment: draftComment } : r));
    setActiveReviewer(null);
  };

  const handleAddReviewer = () => {
    if (!newName.trim()) return;
    setReviewers(prev => [...prev, { id: String(Date.now()), name: newName.trim(), role: "peer", submitted: false }]);
    setNewName("");
  };

  const categories = [...new Set(CRITERIA.map(c => c.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Évaluation 360°</h2>
          <p className="text-muted-foreground">Revue multi-évaluateurs avec scoring par critère</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="font-medium">{submittedCount}/{reviewers.length} évaluations soumises</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {categories.map(cat => {
          const catCriteria = CRITERIA.filter(c => c.category === cat);
          const avg = catCriteria.reduce((s, c) => s + avgScore(reviewers, c.id), 0) / catCriteria.length;
          return (
            <div key={cat} className="rounded-lg border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">{cat}</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{avg.toFixed(1)}</span>
                <span className="text-sm text-gray-400">/5</span>
              </div>
              <StarRating value={Math.round(avg)} />
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="bg-muted border-b px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Évaluateurs</h3>
            <div className="flex gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom..." className="border rounded px-2 py-1 text-sm w-32" onKeyDown={e => e.key === "Enter" && handleAddReviewer()} />
              <button onClick={handleAddReviewer} className="p-1 hover:bg-gray-200 rounded"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="divide-y">
            {reviewers.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r.role] || "bg-muted text-muted-foreground"}`}>{ROLE_LABELS[r.role] || r.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.submitted ? <CheckCircle className="w-4 h-4 text-green-600" /> : (
                    <button onClick={() => handleStartReview(r.id)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md">
                      Évaluer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {activeReviewer ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="bg-blue-50 border-b px-4 py-3">
              <h3 className="font-semibold text-foreground">Formulaire d'évaluation</h3>
              <p className="text-xs text-muted-foreground">{reviewers.find(r => r.id === activeReviewer)?.name}</p>
            </div>
            <div className="p-4 space-y-4">
              {CRITERIA.map(c => (
                <div key={c.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.category}</p>
                  </div>
                  <StarRating value={draftScores[c.id] || 0} onChange={v => setDraftScores(s => ({ ...s, [c.id]: v }))} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Commentaire</label>
                <textarea value={draftComment} onChange={e => setDraftComment(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Commentaire libre..." />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSubmitReview} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  <Send className="w-4 h-4" /> Soumettre
                </button>
                <button onClick={() => setActiveReviewer(null)} className="bg-gray-200 hover:bg-gray-300 text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="bg-muted border-b px-4 py-3">
              <h3 className="font-semibold text-foreground">Synthèse par critère</h3>
            </div>
            <div className="divide-y">
              {CRITERIA.map(c => {
                const avg = avgScore(reviewers, c.id);
                return (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating value={Math.round(avg)} />
                      <span className="text-sm font-bold text-muted-foreground w-8 text-right">{avg > 0 ? avg.toFixed(1) : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
