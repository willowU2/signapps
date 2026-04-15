"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { BarChart2 } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

export default function ReportsPage() {
  usePageTitle("Rapports");
  return (
    <AppLayout>
      <div className="w-full py-6 space-y-6">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Constructeur de rapports</h1>
            <p className="text-sm text-muted-foreground">
              Créez des rapports visuels personnalisés depuis vos données
            </p>
          </div>
        </div>
        <ReportBuilder />
      </div>
    </AppLayout>
  );
}
