"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";

interface Lease {
  id: string;
  property: string;
  tenant: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  status: "active" | "expiring" | "expired";
}

const LEASES: Lease[] = [
  {
    id: "1",
    property: "Downtown Office Building",
    tenant: "Tech Startup Inc.",
    startDate: "2022-01-15",
    endDate: "2027-01-14",
    rentAmount: 5000,
    status: "active",
  },
  {
    id: "2",
    property: "Warehouse District",
    tenant: "Manufacturing Corp",
    startDate: "2021-06-01",
    endDate: "2026-05-31",
    rentAmount: 3500,
    status: "expiring",
  },
  {
    id: "3",
    property: "Retail Space",
    tenant: "Fashion Store LLC",
    startDate: "2019-03-20",
    endDate: "2025-03-19",
    rentAmount: 2800,
    status: "expired",
  },
  {
    id: "4",
    property: "Commercial Suite",
    tenant: "Consulting Group",
    startDate: "2023-09-01",
    endDate: "2028-08-31",
    rentAmount: 4200,
    status: "active",
  },
];

function getStatusColor(status: string): { bg: string; text: string; badge: string } {
  switch (status) {
    case "active":
      return { bg: "bg-green-50", text: "text-green-900", badge: "bg-green-100 text-green-800" };
    case "expiring":
      return { bg: "bg-yellow-50", text: "text-yellow-900", badge: "bg-yellow-100 text-yellow-800" };
    case "expired":
      return { bg: "bg-red-50", text: "text-red-900", badge: "bg-red-100 text-red-800" };
    default:
      return { bg: "bg-gray-50", text: "text-gray-900", badge: "bg-gray-100 text-gray-800" };
  }
}

export function LeaseManager() {
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const selectedLease = LEASES.find((l) => l.id === selectedLeaseId);

  const totalMonthlyRent = LEASES.reduce((sum, l) => sum + l.rentAmount, 0);
  const activeLeasesCount = LEASES.filter((l) => l.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Lease Manager</h2>
          <p className="text-gray-600">Track and manage property leases</p>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-8 h-8 text-blue-600" />
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Lease
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase">Total Monthly Rent</p>
          <p className="text-2xl font-bold text-blue-900">
            €{totalMonthlyRent.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase">Active Leases</p>
          <p className="text-2xl font-bold text-green-900">{activeLeasesCount}</p>
        </div>

        <div className="rounded-lg border bg-yellow-50 p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase">Expiring Soon</p>
          <p className="text-2xl font-bold text-yellow-900">
            {LEASES.filter((l) => l.status === "expiring").length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leases Table */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Property</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Tenant</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">Rent (€)</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {LEASES.map((lease) => {
                  const colors = getStatusColor(lease.status);
                  return (
                    <tr
                      key={lease.id}
                      onClick={() => setSelectedLeaseId(lease.id)}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedLeaseId === lease.id ? colors.bg : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{lease.property}</td>
                      <td className="px-4 py-3 text-gray-600">{lease.tenant}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        €{lease.rentAmount.toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            getStatusColor(lease.status).badge
                          }`}
                        >
                          {lease.status.charAt(0).toUpperCase() + lease.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lease Details */}
        <div className="space-y-4">
          {selectedLease ? (
            <div className="rounded-lg border bg-white p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedLease.property}</h3>
                <p className="text-sm text-gray-600">Tenant: {selectedLease.tenant}</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Start Date</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {new Date(selectedLease.startDate).toLocaleDateString("de-DE")}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase">End Date</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {new Date(selectedLease.endDate).toLocaleDateString("de-DE")}
                  </p>
                </div>

                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Monthly Rent</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    €{selectedLease.rentAmount.toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>

                <div className={`rounded-lg p-3 ${getStatusColor(selectedLease.status).bg}`}>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Status</p>
                  <p className={`text-sm font-bold mt-1 ${getStatusColor(selectedLease.status).text}`}>
                    {selectedLease.status.charAt(0).toUpperCase() + selectedLease.status.slice(1)}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors text-sm">
                  Edit Lease
                </button>
                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded transition-colors text-sm">
                  View Documents
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-gray-50 p-6 text-center">
              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Select a lease to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
