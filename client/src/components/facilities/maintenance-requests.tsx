"use client";

import { useState } from "react";
import { Wrench, Plus } from "lucide-react";

interface MaintenanceRequest {
  id: string;
  title: string;
  location: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "done";
  createdDate: string;
}

const MAINTENANCE_REQUESTS: MaintenanceRequest[] = [
  {
    id: "1",
    title: "Fix broken window",
    location: "Floor 1 - Office 2",
    priority: "high",
    status: "open",
    createdDate: "2026-03-20",
  },
  {
    id: "2",
    title: "HVAC system inspection",
    location: "Floor 1 - Server Room",
    priority: "high",
    status: "in_progress",
    createdDate: "2026-03-18",
  },
  {
    id: "3",
    title: "Paint wall in break room",
    location: "Floor 1 - Break Room",
    priority: "low",
    status: "open",
    createdDate: "2026-03-15",
  },
  {
    id: "4",
    title: "Replace ceiling tiles",
    location: "Floor 2 - Conference",
    priority: "medium",
    status: "in_progress",
    createdDate: "2026-03-10",
  },
  {
    id: "5",
    title: "Fix bathroom sink",
    location: "Floor 2 - Restrooms",
    priority: "medium",
    status: "done",
    createdDate: "2026-03-05",
  },
];

function getPriorityColor(priority: string): {
  bg: string;
  badge: string;
  text: string;
} {
  switch (priority) {
    case "low":
      return {
        bg: "bg-green-50",
        badge: "bg-green-100 text-green-800",
        text: "text-green-900",
      };
    case "medium":
      return {
        bg: "bg-yellow-50",
        badge: "bg-yellow-100 text-yellow-800",
        text: "text-yellow-900",
      };
    case "high":
      return {
        bg: "bg-red-50",
        badge: "bg-red-100 text-red-800",
        text: "text-red-900",
      };
    default:
      return {
        bg: "bg-muted",
        badge: "bg-muted text-gray-800",
        text: "text-foreground",
      };
  }
}

function getStatusColor(status: string): {
  bg: string;
  badge: string;
  text: string;
} {
  switch (status) {
    case "open":
      return {
        bg: "bg-blue-50",
        badge: "bg-blue-100 text-blue-800",
        text: "text-blue-900",
      };
    case "in_progress":
      return {
        bg: "bg-purple-50",
        badge: "bg-purple-100 text-purple-800",
        text: "text-purple-900",
      };
    case "done":
      return {
        bg: "bg-green-50",
        badge: "bg-green-100 text-green-800",
        text: "text-green-900",
      };
    default:
      return {
        bg: "bg-muted",
        badge: "bg-muted text-gray-800",
        text: "text-foreground",
      };
  }
}

export function MaintenanceRequests() {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    priority: "medium",
  });

  const selectedRequest = MAINTENANCE_REQUESTS.find(
    (r) => r.id === selectedRequestId,
  );
  const openRequests = MAINTENANCE_REQUESTS.filter(
    (r) => r.status === "open",
  ).length;
  const inProgressRequests = MAINTENANCE_REQUESTS.filter(
    (r) => r.status === "in_progress",
  ).length;

  const handleSubmit = () => {
    setShowForm(false);
    setFormData({ title: "", location: "", priority: "medium" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Maintenance Requests
          </h2>
          <p className="text-muted-foreground">
            Track and manage facility maintenance tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Wrench className="w-8 h-8 text-blue-600" />
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Total Requests
          </p>
          <p className="text-2xl font-bold text-blue-900">
            {MAINTENANCE_REQUESTS.length}
          </p>
        </div>

        <div className="rounded-lg border bg-orange-50 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Open
          </p>
          <p className="text-2xl font-bold text-orange-900">{openRequests}</p>
        </div>

        <div className="rounded-lg border bg-purple-50 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            In Progress
          </p>
          <p className="text-2xl font-bold text-purple-900">
            {inProgressRequests}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Request Form */}
          {showForm && (
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h3 className="text-lg font-bold text-foreground">
                Submit New Request
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Request Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="e.g., Fix broken door"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="e.g., Floor 1 - Office 1"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSubmit}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
                  >
                    Submit Request
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 bg-muted hover:bg-gray-200 text-foreground font-medium py-2 px-4 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Requests List */}
          <div className="space-y-3">
            {MAINTENANCE_REQUESTS.map((request) => (
              <div
                key={request.id}
                onClick={() => setSelectedRequestId(request.id)}
                className={`rounded-lg border p-4 cursor-pointer transition-all ${
                  selectedRequestId === request.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-border hover:border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">
                      {request.title}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.location}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created:{" "}
                      {new Date(request.createdDate).toLocaleDateString(
                        "de-DE",
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(request.priority).badge}`}
                    >
                      {request.priority.charAt(0).toUpperCase() +
                        request.priority.slice(1)}
                    </span>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(request.status).badge}`}
                    >
                      {request.status === "in_progress"
                        ? "In Progress"
                        : request.status.charAt(0).toUpperCase() +
                          request.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Request Details */}
        <div className="space-y-4">
          {selectedRequest ? (
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {selectedRequest.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedRequest.location}
                </p>
              </div>

              <div className="space-y-3">
                <div
                  className={`rounded-lg p-3 ${getPriorityColor(selectedRequest.priority).bg}`}
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Priority
                  </p>
                  <p
                    className={`text-sm font-bold mt-1 ${getPriorityColor(selectedRequest.priority).text}`}
                  >
                    {selectedRequest.priority.charAt(0).toUpperCase() +
                      selectedRequest.priority.slice(1)}
                  </p>
                </div>

                <div
                  className={`rounded-lg p-3 ${getStatusColor(selectedRequest.status).bg}`}
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Status
                  </p>
                  <p
                    className={`text-sm font-bold mt-1 ${getStatusColor(selectedRequest.status).text}`}
                  >
                    {selectedRequest.status === "in_progress"
                      ? "In Progress"
                      : selectedRequest.status.charAt(0).toUpperCase() +
                        selectedRequest.status.slice(1)}
                  </p>
                </div>

                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Created
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    {new Date(selectedRequest.createdDate).toLocaleDateString(
                      "de-DE",
                    )}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors text-sm">
                  Update Status
                </button>
                <button className="w-full bg-muted hover:bg-gray-200 text-foreground font-medium py-2 px-4 rounded transition-colors text-sm">
                  Assign to Technician
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted p-6 text-center">
              <Wrench className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Select a request to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
