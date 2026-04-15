"use client";

import { useState } from "react";
import {
  GraduationCap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  X,
} from "lucide-react";

type CertStatus = "valid" | "expiring" | "expired" | "in_progress";

interface Certification {
  id: string;
  employeeName: string;
  certName: string;
  provider: string;
  issueDate: string;
  expiryDate?: string;
  status: CertStatus;
  category: string;
  mandatory: boolean;
}

interface Training {
  id: string;
  title: string;
  provider: string;
  duration: string;
  category: string;
  dueDate: string;
  enrolledCount: number;
  maxCapacity: number;
  status: "open" | "full" | "completed";
}

const CERTS: Certification[] = [
  {
    id: "1",
    employeeName: "Alice Martin",
    certName: "AWS Solutions Architect",
    provider: "Amazon",
    issueDate: "2024-03-01",
    expiryDate: "2026-03-01",
    status: "expiring",
    category: "Cloud",
    mandatory: false,
  },
  {
    id: "2",
    employeeName: "Bob Dupont",
    certName: "CKA - Kubernetes Admin",
    provider: "CNCF",
    issueDate: "2023-06-15",
    expiryDate: "2025-06-15",
    status: "expired",
    category: "DevOps",
    mandatory: true,
  },
  {
    id: "3",
    employeeName: "Claire Bernard",
    certName: "Sécurité incendie",
    provider: "INRS",
    issueDate: "2025-01-10",
    expiryDate: "2027-01-10",
    status: "valid",
    category: "Sécurité",
    mandatory: true,
  },
  {
    id: "4",
    employeeName: "David Petit",
    certName: "Expert-Comptable",
    provider: "OEC",
    issueDate: "2018-09-01",
    status: "valid",
    category: "Finance",
    mandatory: true,
  },
  {
    id: "5",
    employeeName: "Emma Leroy",
    certName: "UX Design Certificate",
    provider: "NN/g",
    issueDate: "2025-11-01",
    expiryDate: "2028-11-01",
    status: "valid",
    category: "Design",
    mandatory: false,
  },
  {
    id: "6",
    employeeName: "Marc Dubois",
    certName: "Rust Systems Programming",
    provider: "Linux Foundation",
    issueDate: "2025-02-15",
    status: "in_progress",
    category: "Dev",
    mandatory: false,
  },
];

const TRAININGS: Training[] = [
  {
    id: "t1",
    title: "RGPD & Protection des données",
    provider: "CNIL",
    duration: "1 jour",
    category: "Conformité",
    dueDate: "2026-06-30",
    enrolledCount: 8,
    maxCapacity: 12,
    status: "open",
  },
  {
    id: "t2",
    title: "Sécurité au bureau",
    provider: "INRS",
    duration: "Demi-journée",
    category: "Sécurité",
    dueDate: "2026-04-30",
    enrolledCount: 12,
    maxCapacity: 12,
    status: "full",
  },
  {
    id: "t3",
    title: "Management d'équipe distante",
    provider: "RH Consultant",
    duration: "2 jours",
    category: "Management",
    dueDate: "2026-07-15",
    enrolledCount: 5,
    maxCapacity: 10,
    status: "open",
  },
  {
    id: "t4",
    title: "Next.js 16 Advanced",
    provider: "Vercel",
    duration: "3 jours",
    category: "Dev",
    dueDate: "2026-05-15",
    enrolledCount: 4,
    maxCapacity: 8,
    status: "open",
  },
];

const STATUS_CONFIG: Record<
  CertStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  valid: {
    label: "Valide",
    icon: <CheckCircle className="w-4 h-4 text-green-600" />,
    color: "bg-green-100 text-green-700",
  },
  expiring: {
    label: "Expire bientôt",
    icon: <Clock className="w-4 h-4 text-amber-600" />,
    color: "bg-amber-100 text-amber-700",
  },
  expired: {
    label: "Expiré",
    icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
    color: "bg-red-100 text-red-700",
  },
  in_progress: {
    label: "En cours",
    icon: <Clock className="w-4 h-4 text-blue-600" />,
    color: "bg-blue-100 text-blue-700",
  },
};

export function TrainingCertificationManagement() {
  const [activeTab, setActiveTab] = useState<"certs" | "trainings">("certs");
  const [certs, setCerts] = useState<Certification[]>(CERTS);
  const [certFilter, setCertFilter] = useState<CertStatus | "all">("all");

  const filtered =
    certFilter === "all" ? certs : certs.filter((c) => c.status === certFilter);

  const counts = {
    valid: certs.filter((c) => c.status === "valid").length,
    expiring: certs.filter((c) => c.status === "expiring").length,
    expired: certs.filter((c) => c.status === "expired").length,
    in_progress: certs.filter((c) => c.status === "in_progress").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Formations & Certifications
          </h2>
          <p className="text-muted-foreground">
            Suivi des cours, dates d'expiration et rappels
          </p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {(Object.entries(counts) as [CertStatus, number][]).map(
          ([status, count]) => (
            <div
              key={status}
              className={`rounded-lg border p-4 cursor-pointer ${certFilter === status ? "ring-2 ring-blue-500" : ""}`}
              onClick={() =>
                setCertFilter((s) => (s === status ? "all" : status))
              }
            >
              <div className="flex items-center gap-2 mb-1">
                {STATUS_CONFIG[status].icon}
                <span className="text-xs font-medium text-muted-foreground">
                  {STATUS_CONFIG[status].label}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">{count}</p>
            </div>
          ),
        )}
      </div>

      <div className="flex gap-2 border-b">
        {(["certs", "trainings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "certs" ? "Certifications" : "Formations planifiées"}
          </button>
        ))}
      </div>

      {activeTab === "certs" && (
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Employé
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Certification
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Catégorie
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Émission
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Expiration
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Oblig.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((cert) => (
                  <tr
                    key={cert.id}
                    className={`hover:bg-muted ${cert.status === "expired" ? "bg-red-50/50" : cert.status === "expiring" ? "bg-amber-50/50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {cert.employeeName}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {cert.certName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cert.provider}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {cert.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cert.issueDate}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cert.expiryDate || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${STATUS_CONFIG[cert.status].color}`}
                      >
                        {STATUS_CONFIG[cert.status].icon}
                        {STATUS_CONFIG[cert.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {cert.mandatory ? (
                        <CheckCircle className="w-4 h-4 text-blue-600 mx-auto" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "trainings" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {TRAININGS.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-foreground">{t.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.provider} · {t.duration}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === "full" ? "bg-red-100 text-red-700" : t.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                >
                  {t.status === "full"
                    ? "Complet"
                    : t.status === "completed"
                      ? "Terminé"
                      : "Ouvert"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span className="bg-muted px-2 py-0.5 rounded">
                  {t.category}
                </span>
                <span>Échéance : {t.dueDate}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Inscrits</span>
                  <span>
                    {t.enrolledCount}/{t.maxCapacity}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${(t.enrolledCount / t.maxCapacity) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <button
                disabled={t.status === "full"}
                className="mt-3 w-full py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-200 disabled:text-muted-foreground"
              >
                {t.status === "full" ? "Complet" : "S'inscrire"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
