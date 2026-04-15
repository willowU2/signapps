"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Play, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TriggerCondition {
  name: string;
  description: string;
  satisfied: boolean;
}

interface SmartContract {
  id: string;
  name: string;
  parties: string[];
  status: "active" | "completed" | "pending";
  createdAt: string;
  triggers: TriggerCondition[];
}

interface SmartContractsProps {
  contracts?: SmartContract[];
  onExecute?: (contractId: string) => Promise<void>;
}

export function SmartContracts({
  contracts = [],
  onExecute,
}: SmartContractsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const handleExecute = async (contractId: string) => {
    setExecutingId(contractId);
    try {
      await onExecute?.(contractId);
    } finally {
      setExecutingId(null);
    }
  };

  const getStatusColor = (status: SmartContract["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Smart Contracts
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage and execute automated contracts
        </p>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              No smart contracts available
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => (
            <Card
              key={contract.id}
              className="overflow-hidden hover:border-slate-300 transition"
            >
              <CardContent className="p-0">
                <button
                  onClick={() =>
                    setExpandedId(
                      expandedId === contract.id ? null : contract.id,
                    )
                  }
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 transition"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {contract.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Parties: {contract.parties.join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge
                      className={cn(
                        "capitalize",
                        getStatusColor(contract.status),
                      )}
                    >
                      {contract.status}
                    </Badge>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 text-slate-400 flex-shrink-0 transition",
                        expandedId === contract.id && "rotate-180",
                      )}
                    />
                  </div>
                </button>

                {expandedId === contract.id && (
                  <div className="border-t bg-slate-50 p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-2">
                        Trigger Conditions
                      </p>
                      <div className="space-y-2">
                        {contract.triggers.map((trigger, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-sm"
                          >
                            <div
                              className={cn(
                                "w-4 h-4 rounded mt-0.5 flex-shrink-0",
                                trigger.satisfied
                                  ? "bg-green-500"
                                  : "bg-slate-300",
                              )}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-slate-700">
                                {trigger.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {trigger.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleExecute(contract.id)}
                        disabled={
                          executingId === contract.id ||
                          contract.status !== "pending"
                        }
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {executingId === contract.id
                          ? "Executing..."
                          : "Execute"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
