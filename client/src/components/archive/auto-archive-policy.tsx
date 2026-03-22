"use client";

import { useEffect, useState } from "react";
import { Shield, Archive, Trash2, Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArchivePolicy {
  id: string;
  dataType: string;
  ageThreshold: number;
  action: "archive" | "delete";
  enabled: boolean;
}

export function AutoArchivePolicy() {
  const [policies, setPolicies] = useState<ArchivePolicy[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setPolicies([
      { id: "p1", dataType: "Old Documents", ageThreshold: 90, action: "archive", enabled: true },
      { id: "p2", dataType: "Temporary Files", ageThreshold: 30, action: "delete", enabled: true },
      { id: "p3", dataType: "Email Attachments", ageThreshold: 180, action: "archive", enabled: false },
      { id: "p4", dataType: "Backup Files", ageThreshold: 365, action: "delete", enabled: true },
    ]);
  }, []);

  const togglePolicy = (id: string) => {
    setPolicies(
      policies.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Shield className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Archive Policies</h2>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Policy
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="font-semibold mb-3">Create New Policy</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Data Type</label>
              <input type="text" placeholder="e.g., Old Documents" className="w-full border rounded px-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Age Threshold (days)</label>
                <input type="number" placeholder="90" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Action</label>
                <select className="w-full border rounded px-3 py-2">
                  <option>Archive</option>
                  <option>Delete</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm">
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {policies.map((policy) => (
          <div key={policy.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                {policy.action === "archive" ? (
                  <Archive className="w-5 h-5 text-blue-600" />
                ) : (
                  <Trash2 className="w-5 h-5 text-red-600" />
                )}
                <h3 className="font-semibold">{policy.dataType}</h3>
              </div>
              <p className="text-sm text-gray-600">
                {policy.action === "archive" ? "Archive" : "Delete"} after {policy.ageThreshold} days
              </p>
            </div>
            <Button
              variant={policy.enabled ? "default" : "outline"}
              size="sm"
              onClick={() => togglePolicy(policy.id)}
              className="gap-2"
            >
              <Power className="w-4 h-4" />
              {policy.enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Archive policies run automatically daily at 2:00 AM. Deleted items cannot be recovered.
        </p>
      </div>
    </div>
  );
}
