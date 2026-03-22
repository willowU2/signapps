"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

interface Procedure {
  id: string;
  step: number;
  action: string;
  owner: string;
  estDuration: string;
}

interface Scenario {
  id: string;
  name: string;
  riskLevel: "critical" | "high" | "medium";
  rto: string;
  rpo: string;
  status: "draft" | "active" | "archived";
  procedures: Procedure[];
}

const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: "s1",
    name: "Data Center Failure",
    riskLevel: "critical",
    rto: "1 hour",
    rpo: "15 minutes",
    status: "active",
    procedures: [
      { id: "p1", step: 1, action: "Activate incident response team", owner: "CTO", estDuration: "5 min" },
      { id: "p2", step: 2, action: "Trigger failover to secondary DC", owner: "Ops Manager", estDuration: "10 min" },
      { id: "p3", step: 3, action: "Verify data integrity", owner: "DBA", estDuration: "20 min" },
    ],
  },
  {
    id: "s2",
    name: "Ransomware Attack",
    riskLevel: "critical",
    rto: "4 hours",
    rpo: "2 hours",
    status: "active",
    procedures: [
      { id: "p4", step: 1, action: "Isolate infected systems", owner: "Security Lead", estDuration: "10 min" },
      { id: "p5", step: 2, action: "Restore from clean backup", owner: "DBA", estDuration: "2 hours" },
    ],
  },
  {
    id: "s3",
    name: "Database Corruption",
    riskLevel: "high",
    rto: "30 minutes",
    rpo: "5 minutes",
    status: "draft",
    procedures: [
      { id: "p6", step: 1, action: "Stop write operations", owner: "DBA", estDuration: "2 min" },
    ],
  },
];

function getRiskColor(risk: string) {
  switch (risk) {
    case "critical":
      return "bg-red-100 text-red-700 border-red-300";
    case "high":
      return "bg-orange-100 text-orange-700 border-orange-300";
    case "medium":
      return "bg-yellow-100 text-yellow-700 border-yellow-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "text-green-600 font-semibold";
    case "draft":
      return "text-gray-600";
    case "archived":
      return "text-gray-400 line-through";
    default:
      return "text-gray-600";
  }
}

export function PcaPlan() {
  const [scenarios] = useState<Scenario[]>(SAMPLE_SCENARIOS);
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set(["s1"]));

  const toggleScenario = (scenarioId: string) => {
    const newExpanded = new Set(expandedScenarios);
    if (newExpanded.has(scenarioId)) {
      newExpanded.delete(scenarioId);
    } else {
      newExpanded.add(scenarioId);
    }
    setExpandedScenarios(newExpanded);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Disaster Recovery Plan</h2>
        <p className="text-gray-600">Manage crisis scenarios and recovery procedures</p>
      </div>

      <div className="space-y-3">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleScenario(scenario.id)}
              className={`w-full px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b ${
                scenario.riskLevel === "critical" ? "bg-red-50" : ""
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                {expandedScenarios.has(scenario.id) ? (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                )}
                {scenario.riskLevel === "critical" && (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{scenario.name}</h3>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold px-2 py-1 rounded border ${getRiskColor(scenario.riskLevel)}`}>
                  {scenario.riskLevel}
                </span>
                <span className={`text-sm ${getStatusColor(scenario.status)}`}>
                  {scenario.status}
                </span>
              </div>
            </button>

            {expandedScenarios.has(scenario.id) && (
              <div className="p-4 space-y-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">RTO (Recovery Time Objective)</p>
                    <p className="text-lg font-bold text-blue-600">{scenario.rto}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">RPO (Recovery Point Objective)</p>
                    <p className="text-lg font-bold text-green-600">{scenario.rpo}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Recovery Procedures</h4>
                  <div className="space-y-2">
                    {scenario.procedures.map((proc) => (
                      <div key={proc.id} className="flex items-start gap-3 p-2 bg-white rounded border">
                        <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                          {proc.step}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{proc.action}</p>
                          <div className="flex gap-4 text-xs text-gray-600">
                            <span>Owner: {proc.owner}</span>
                            <span>~{proc.estDuration}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Critical Scenarios</p>
          <p className="text-2xl font-bold text-red-600">
            {scenarios.filter((s) => s.riskLevel === "critical").length}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Active Plans</p>
          <p className="text-2xl font-bold text-green-600">
            {scenarios.filter((s) => s.status === "active").length}
          </p>
        </div>
      </div>
    </div>
  );
}
