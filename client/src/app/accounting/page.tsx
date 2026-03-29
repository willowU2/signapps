"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  BookOpen, PenLine, RefreshCw, FileBarChart, FileText,
  Receipt, BarChart2, TrendingUp, Percent, Upload, ChevronRight,
} from "lucide-react";
import { ChartOfAccounts } from "@/components/accounting/chart-of-accounts";
import { JournalEntry } from "@/components/accounting/journal-entry";
import { BankReconciliation } from "@/components/accounting/bank-reconciliation";
import { FinancialStatements } from "@/components/accounting/financial-statements";
import { ClientInvoiceManagement } from "@/components/accounting/client-invoice-management";
import { ExpenseManagement } from "@/components/accounting/expense-management";
import { BudgetForecast } from "@/components/accounting/budget-forecast";
import { CashFlowDashboard } from "@/components/accounting/cash-flow-dashboard";
import { VatDeclaration } from "@/components/accounting/vat-declaration";
import { CsvFecImport } from "@/components/accounting/csv-fec-import";
import { usePageTitle } from '@/hooks/use-page-title';

const TABS = [
  { id: "chart-of-accounts", label: "Plan comptable", icon: BookOpen, desc: "Arbre CRUD comptes" },
  { id: "journal", label: "Saisie d'écritures", icon: PenLine, desc: "Débit/crédit équilibré" },
  { id: "bank-reconciliation", label: "Rapprochement bancaire", icon: RefreshCw, desc: "Import & matching" },
  { id: "financial-statements", label: "Bilan & Résultats", icon: FileBarChart, desc: "Auto depuis écritures" },
  { id: "invoices", label: "Factures clients", icon: FileText, desc: "Créer/envoyer/suivre" },
  { id: "expenses", label: "Notes de frais", icon: Receipt, desc: "Soumettre & approuver" },
  { id: "budget", label: "Budget prévisionnel", icon: BarChart2, desc: "Budget vs réalisé" },
  { id: "cashflow", label: "Cash Flow", icon: TrendingUp, desc: "Entrées/sorties timeline" },
  { id: "vat", label: "Déclaration TVA", icon: Percent, desc: "Calcul assisté" },
  { id: "import", label: "Import CSV / FEC", icon: Upload, desc: "Parseur & validation" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AccountingPage() {
  usePageTitle('Comptabilite');
  const [activeTab, setActiveTab] = useState<TabId>("chart-of-accounts");

  const renderContent = () => {
    switch (activeTab) {
      case "chart-of-accounts": return <ChartOfAccounts />;
      case "journal": return <JournalEntry />;
      case "bank-reconciliation": return <BankReconciliation />;
      case "financial-statements": return <FinancialStatements />;
      case "invoices": return <ClientInvoiceManagement />;
      case "expenses": return <ExpenseManagement />;
      case "budget": return <BudgetForecast />;
      case "cashflow": return <CashFlowDashboard />;
      case "vat": return <VatDeclaration />;
      case "import": return <CsvFecImport />;
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className="w-60 flex-shrink-0 border-r bg-muted flex flex-col">
          <div className="p-4 border-b bg-background">
            <h1 className="text-base font-bold text-foreground">Comptabilité</h1>
            <p className="text-xs text-muted-foreground">Gestion financière complète</p>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {TABS.map(tab => {
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
                    <p className={`text-xs truncate ${activeTab === tab.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{tab.desc}</p>
                  </div>
                  {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {renderContent()}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
