"use client";

// Feature 11: Project budget → link to billing invoices

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, FileText, ExternalLink, TrendingUp } from "lucide-react";

interface Invoice {
  id: string;
  number: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  issuedDate: string;
  dueDate: string;
  client: string;
}

interface ProjectBudget {
  total: number;
  spent: number;
  invoiced: number;
  currency: string;
  invoices: Invoice[];
}

const STATUS_CONFIG = {
  paid: { label: "Payée", class: "bg-green-100 text-green-800" },
  pending: { label: "En attente", class: "bg-yellow-100 text-yellow-800" },
  overdue: { label: "En retard", class: "bg-red-100 text-red-800" },
};

const DEMO_BUDGET: ProjectBudget = {
  total: 45000,
  spent: 28500,
  invoiced: 18000,
  currency: "EUR",
  invoices: [
    { id: "inv1", number: "INV-2026-042", amount: 9000, status: "paid", issuedDate: "2026-02-01", dueDate: "2026-03-01", client: "Acme Corp" },
    { id: "inv2", number: "INV-2026-058", amount: 9000, status: "pending", issuedDate: "2026-03-01", dueDate: "2026-04-01", client: "Acme Corp" },
  ],
};

interface ProjectBillingLinkProps {
  projectName?: string;
  budget?: ProjectBudget;
}

export function ProjectBillingLink({ projectName = "Refonte Backend Auth", budget = DEMO_BUDGET }: ProjectBillingLinkProps) {
  const [expanded, setExpanded] = useState(false);
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: budget.currency }).format(n);

  const spentPct = Math.round((budget.spent / budget.total) * 100);
  const invoicedPct = Math.round((budget.invoiced / budget.total) * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="size-4" />
          Budget — {projectName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Budget total</p>
            <p className="text-sm font-bold">{fmt(budget.total)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Consommé</p>
            <p className="text-sm font-bold text-orange-600">{fmt(budget.spent)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Facturé</p>
            <p className="text-sm font-bold text-blue-600">{fmt(budget.invoiced)}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Consommation</span><span>{spentPct}%</span>
          </div>
          <Progress value={spentPct} className="h-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><TrendingUp className="size-3" /> Facturation</span><span>{invoicedPct}%</span>
          </div>
          <Progress value={invoicedPct} className="h-2 [&>div]:bg-blue-500" />
        </div>

        <Button variant="outline" size="sm" className="w-full gap-1 text-xs h-7" onClick={() => setExpanded(!expanded)}>
          <FileText className="size-3.5" />
          {budget.invoices.length} factures liées
        </Button>

        {expanded && (
          <div className="space-y-1.5">
            {budget.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
                <div>
                  <p className="font-medium">{inv.number}</p>
                  <p className="text-muted-foreground">{inv.client} · {fmt(inv.amount)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${STATUS_CONFIG[inv.status].class}`}>
                    {STATUS_CONFIG[inv.status].label}
                  </span>
                  <Button variant="ghost" size="icon" className="size-6">
                    <ExternalLink className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
