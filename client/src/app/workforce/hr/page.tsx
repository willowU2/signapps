"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Calendar,
  Clock,
  Star,
  Network,
  CheckSquare,
  Users,
  Cake,
  GraduationCap,
  DollarSign,
  Home,
  ChevronRight,
} from "lucide-react";
import { LeaveManagement } from "@/components/hr/leave-management";
import { WeeklyTimesheet } from "@/components/hr/weekly-timesheet";
import { PerformanceReview360 } from "@/components/hr/performance-review-360";
import { OrgChart } from "@/components/hr/org-chart";
import { OnboardingChecklist } from "@/components/hr/onboarding-checklist";
import { EmployeeDirectory } from "@/components/hr/employee-directory";
import { BirthdayAnniversaryAlerts } from "@/components/hr/birthday-anniversary-alerts";
import { TrainingCertificationManagement } from "@/components/hr/training-certification-management";
import { PayrollSimulationReport } from "@/components/hr/payroll-simulation-report";
import { RemoteWorkPolicy } from "@/components/hr/remote-work-policy";
import { usePageTitle } from "@/hooks/use-page-title";

const TABS = [
  { id: "leave", label: "Congés", icon: Calendar, desc: "Demandes & soldes" },
  {
    id: "timesheet",
    label: "Feuilles de temps",
    icon: Clock,
    desc: "Saisie hebdomadaire",
  },
  {
    id: "review",
    label: "Évaluation 360°",
    icon: Star,
    desc: "Multi-évaluateurs",
  },
  {
    id: "orgchart",
    label: "Organigramme",
    icon: Network,
    desc: "Arbre interactif",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    icon: CheckSquare,
    desc: "Checklist embauche",
  },
  { id: "directory", label: "Annuaire", icon: Users, desc: "Fiches employés" },
  {
    id: "birthdays",
    label: "Célébrations",
    icon: Cake,
    desc: "Anniversaires & anciennetés",
  },
  {
    id: "training",
    label: "Formations",
    icon: GraduationCap,
    desc: "Certifications & cours",
  },
  {
    id: "payroll",
    label: "Simulation paie",
    icon: DollarSign,
    desc: "Coûts par département",
  },
  {
    id: "remote",
    label: "Télétravail",
    icon: Home,
    desc: "Politique par employé",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function HRPage() {
  usePageTitle("Ressources humaines");
  const [activeTab, setActiveTab] = useState<TabId>("leave");

  const renderContent = () => {
    switch (activeTab) {
      case "leave":
        return <LeaveManagement />;
      case "timesheet":
        return <WeeklyTimesheet />;
      case "review":
        return <PerformanceReview360 />;
      case "orgchart":
        return <OrgChart />;
      case "onboarding":
        return <OnboardingChecklist />;
      case "directory":
        return <EmployeeDirectory />;
      case "birthdays":
        return <BirthdayAnniversaryAlerts />;
      case "training":
        return <TrainingCertificationManagement />;
      case "payroll":
        return <PayrollSimulationReport />;
      case "remote":
        return <RemoteWorkPolicy />;
    }
  };

  const activeTabData = TABS.find((t) => t.id === activeTab)!;

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r bg-muted flex flex-col">
          <div className="p-4 border-b bg-background">
            <h1 className="text-base font-bold text-foreground">RH Avancé</h1>
            <p className="text-xs text-muted-foreground">
              Gestion des ressources humaines
            </p>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tab.label}</p>
                    <p
                      className={`text-xs truncate ${activeTab === tab.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {tab.desc}
                    </p>
                  </div>
                  {activeTab === tab.id && (
                    <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">{renderContent()}</div>
        </main>
      </div>
    </AppLayout>
  );
}
