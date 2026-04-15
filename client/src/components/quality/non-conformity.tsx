"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface NCR {
  id: string;
  title: string;
  description: string;
  severity: "High" | "Medium" | "Low";
  areaAffected: string;
  correctiveAction: string;
  status: "Open" | "InProgress" | "Closed";
  createdDate: Date;
}

interface NonConformityProps {
  onNCRSubmit?: (ncr: Omit<NCR, "id" | "createdDate">) => void;
  onNCRUpdate?: (id: string, ncr: Partial<NCR>) => void;
  onNCRDelete?: (id: string) => void;
  initialNCRs?: NCR[];
}

export function NonConformity({
  onNCRSubmit,
  onNCRUpdate,
  onNCRDelete,
  initialNCRs = [],
}: NonConformityProps) {
  const [ncrs, setNCRs] = useState<NCR[]>(initialNCRs);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    severity: "Medium" as "High" | "Medium" | "Low",
    areaAffected: "",
    correctiveAction: "",
  });

  const handleOpenForm = () => {
    setFormData({
      title: "",
      description: "",
      severity: "Medium",
      areaAffected: "",
      correctiveAction: "",
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleEditNCR = (ncr: NCR) => {
    setFormData({
      title: ncr.title,
      description: ncr.description,
      severity: ncr.severity,
      areaAffected: ncr.areaAffected,
      correctiveAction: ncr.correctiveAction,
    });
    setEditingId(ncr.id);
    setIsFormOpen(true);
  };

  const handleSubmitForm = () => {
    if (editingId) {
      const updatedNCR = {
        ...formData,
        severity: formData.severity as "High" | "Medium" | "Low",
      };
      setNCRs((prev) =>
        prev.map((n) => (n.id === editingId ? { ...n, ...updatedNCR } : n)),
      );
      onNCRUpdate?.(editingId, updatedNCR);
      setEditingId(null);
    } else {
      const newNCR: NCR = {
        id: `ncr-${Date.now()}`,
        ...formData,
        severity: formData.severity as "High" | "Medium" | "Low",
        status: "Open",
        createdDate: new Date(),
      };
      setNCRs((prev) => [newNCR, ...prev]);
      onNCRSubmit?.({
        title: newNCR.title,
        description: newNCR.description,
        severity: newNCR.severity,
        areaAffected: newNCR.areaAffected,
        correctiveAction: newNCR.correctiveAction,
        status: newNCR.status,
      });
    }
    setIsFormOpen(false);
  };

  const handleDeleteNCR = (id: string) => {
    setNCRs((prev) => prev.filter((n) => n.id !== id));
    onNCRDelete?.(id);
  };

  const handleStatusChange = (
    id: string,
    status: "Open" | "InProgress" | "Closed",
  ) => {
    setNCRs((prev) => prev.map((n) => (n.id === id ? { ...n, status } : n)));
    onNCRUpdate?.(id, { status });
  };

  const severityColors = {
    High: "bg-red-100 text-red-800 dark:bg-red-900/30",
    Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30",
    Low: "bg-green-100 text-green-800 dark:bg-green-900/30",
  };

  const statusColors = {
    Open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30",
    InProgress: "bg-orange-100 text-orange-800 dark:bg-orange-900/30",
    Closed: "bg-green-100 text-green-800 dark:bg-green-900/30",
  };

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Non-Conformities</h1>
        <Button onClick={handleOpenForm} className="gap-2">
          <Plus className="size-4" />
          New NCR
        </Button>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <Card className="p-6 border-2 border-blue-300 dark:border-blue-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit NCR" : "Create New NCR"}
            </h2>
            <button onClick={() => setIsFormOpen(false)}>
              <X className="size-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="NCR title..."
                className="w-full px-3 py-2 border rounded bg-card dark:bg-gray-900 dark:border-gray-700"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Detailed description of the non-conformity..."
                rows={3}
                className="w-full px-3 py-2 border rounded bg-card dark:bg-gray-900 dark:border-gray-700"
              />
            </div>

            {/* Severity and Area */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      severity: e.target.value as "High" | "Medium" | "Low",
                    })
                  }
                  className="w-full px-3 py-2 border rounded bg-card dark:bg-gray-900 dark:border-gray-700"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Area Affected
                </label>
                <input
                  type="text"
                  value={formData.areaAffected}
                  onChange={(e) =>
                    setFormData({ ...formData, areaAffected: e.target.value })
                  }
                  placeholder="e.g., Production Floor..."
                  className="w-full px-3 py-2 border rounded bg-card dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
            </div>

            {/* Corrective Action */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Corrective Action
              </label>
              <textarea
                value={formData.correctiveAction}
                onChange={(e) =>
                  setFormData({ ...formData, correctiveAction: e.target.value })
                }
                placeholder="Describe the corrective action to be taken..."
                rows={3}
                className="w-full px-3 py-2 border rounded bg-card dark:bg-gray-900 dark:border-gray-700"
              />
            </div>

            {/* Form Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitForm}>
                {editingId ? "Update NCR" : "Create NCR"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* NCR List */}
      <div className="space-y-3">
        {ncrs.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <p>No non-conformities recorded</p>
          </Card>
        ) : (
          ncrs.map((ncr) => (
            <Card key={ncr.id} className="p-4">
              <div className="space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{ncr.title}</h3>
                    <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
                      {ncr.createdDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${severityColors[ncr.severity]}`}
                    >
                      {ncr.severity}
                    </span>
                    <button
                      onClick={() => handleEditNCR(ncr)}
                      className="p-2 hover:bg-muted dark:hover:bg-gray-800 rounded"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNCR(ncr.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm">{ncr.description}</p>

                {/* Area and Corrective Action */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Area Affected:</span>
                    <p className="text-muted-foreground dark:text-gray-400">
                      {ncr.areaAffected}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Corrective Action:</span>
                    <p className="text-muted-foreground dark:text-gray-400">
                      {ncr.correctiveAction}
                    </p>
                  </div>
                </div>

                {/* Status Selector */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <label className="text-sm font-medium">Status:</label>
                  <select
                    value={ncr.status}
                    onChange={(e) =>
                      handleStatusChange(
                        ncr.id,
                        e.target.value as "Open" | "InProgress" | "Closed",
                      )
                    }
                    className={`px-3 py-1 rounded text-xs font-medium border-0 cursor-pointer ${
                      statusColors[ncr.status]
                    }`}
                  >
                    <option value="Open">Open</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
