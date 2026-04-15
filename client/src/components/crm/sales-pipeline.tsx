"use client";

import { useState } from "react";
import { Trash2, Plus, DollarSign, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface Deal {
  id: string;
  title: string;
  company: string;
  value: number;
  probability: number; // 0-100
  stage: "prospect" | "qualified" | "proposal" | "negotiation" | "won";
}

export interface SalesPipelineProps {
  deals: Deal[];
  onMoveDeal: (dealId: string, newStage: Deal["stage"]) => void;
  onDeleteDeal: (dealId: string) => void;
}

const STAGES = [
  { id: "prospect", label: "Prospect", color: "bg-slate-100 border-slate-300" },
  { id: "qualified", label: "Qualifié", color: "bg-blue-100 border-blue-300" },
  {
    id: "proposal",
    label: "Proposition",
    color: "bg-amber-100 border-amber-300",
  },
  {
    id: "negotiation",
    label: "Négociation",
    color: "bg-orange-100 border-orange-300",
  },
  { id: "won", label: "Gagné", color: "bg-emerald-100 border-emerald-300" },
] as const;

export function SalesPipeline({
  deals,
  onMoveDeal,
  onDeleteDeal,
}: SalesPipelineProps) {
  const dealsByStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage.id] = deals.filter((d) => d.stage === stage.id);
      return acc;
    },
    {} as Record<string, Deal[]>,
  );

  const totalValue = deals.reduce(
    (sum, d) => sum + (d.value * d.probability) / 100,
    0,
  );
  const totalDealCount = deals.length;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Valeur Pipeline</p>
              <p className="text-2xl font-bold text-foreground">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(totalValue)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-emerald-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Opportunités</p>
              <p className="text-2xl font-bold text-foreground">
                {totalDealCount}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-64 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{stage.label}</h3>
              <Badge variant="outline">{dealsByStage[stage.id].length}</Badge>
            </div>

            <div
              className={`rounded-lg border-2 ${stage.color} p-3 min-h-96 space-y-3`}
            >
              {dealsByStage[stage.id].map((deal) => (
                <Card
                  key={deal.id}
                  className="p-3 bg-card cursor-move hover:shadow-md transition-shadow group"
                  draggable
                  onDragStart={(e) => {
                    // Store stage for drop handling
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("dealId", deal.id);
                    e.dataTransfer.setData("fromStage", stage.id);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dealId = e.dataTransfer.getData("dealId");
                    onMoveDeal(dealId, stage.id as Deal["stage"]);
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">
                          {deal.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {deal.company}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        onClick={() => onDeleteDeal(deal.id)}
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          }).format(deal.value)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {deal.probability}%
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full"
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {dealsByStage[stage.id].length === 0 && (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  <p className="text-sm text-center">
                    Déposez une opportunité ici
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
