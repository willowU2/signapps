"use client";

import { useState } from "react";
import { Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Role = "Admin" | "Manager" | "Employee";

interface RolePolicy {
  role: Role;
  required: boolean;
  adoptionRate: number;
  nonCompliantCount: number;
}

interface NonCompliantUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export function TwoFactorPolicy() {
  const [policies, setPolicies] = useState<RolePolicy[]>([
    { role: "Admin", required: true, adoptionRate: 100, nonCompliantCount: 0 },
    { role: "Manager", required: true, adoptionRate: 87, nonCompliantCount: 5 },
    { role: "Employee", required: false, adoptionRate: 45, nonCompliantCount: 23 },
  ]);

  const [nonCompliantUsers] = useState<NonCompliantUser[]>([
    { id: "1", name: "Alice Johnson", email: "alice@company.com", role: "Manager" },
    { id: "2", name: "Bob Smith", email: "bob@company.com", role: "Manager" },
    { id: "3", name: "Charlie Brown", email: "charlie@company.com", role: "Employee" },
    { id: "4", name: "Diana Prince", email: "diana@company.com", role: "Employee" },
    { id: "5", name: "Eve Wilson", email: "eve@company.com", role: "Employee" },
  ]);

  const togglePolicy = (role: Role) => {
    setPolicies((prev) =>
      prev.map((p) =>
        p.role === role ? { ...p, required: !p.required } : p
      )
    );
  };

  const totalNonCompliant = policies.reduce(
    (sum, p) => sum + p.nonCompliantCount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Two-Factor Authentication Policy</h2>
        </div>
        <div className="text-sm text-gray-600">
          {totalNonCompliant} non-compliant users
        </div>
      </div>

      {/* Role Policies */}
      <div className="space-y-3">
        {policies.map((policy) => (
          <div
            key={policy.role}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            {/* Role Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">{policy.role}</h3>
                {policy.required && (
                  <Badge variant="default" className="bg-blue-600">
                    Required
                  </Badge>
                )}
              </div>
              <Button
                variant={policy.required ? "destructive" : "outline"}
                size="sm"
                onClick={() => togglePolicy(policy.role)}
              >
                {policy.required ? "Make Optional" : "Make Required"}
              </Button>
            </div>

            {/* Adoption Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Adoption Rate</span>
                <span className="font-medium text-gray-900">
                  {policy.adoptionRate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    policy.adoptionRate >= 80 ? "bg-green-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${policy.adoptionRate}%` }}
                />
              </div>
            </div>

            {/* Non-Compliant Count */}
            {policy.nonCompliantCount > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span>{policy.nonCompliantCount} users not yet enrolled</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Non-Compliant Users List */}
      {nonCompliantUsers.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">
            Non-Compliant Users
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {nonCompliantUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 rounded hover:bg-gray-50 border border-gray-100"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{user.role}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-600 hover:bg-blue-50"
                  >
                    Remind
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
