"use client";

import { useState } from "react";
import { Plus, RotateCw, AlertCircle, CheckCircle } from "lucide-react";

interface Certificate {
  id: string;
  domain: string;
  issuer: string;
  expiryDate: string;
  status: "valid" | "expiring" | "expired";
  autoRenew: boolean;
  lastRenewal: string;
}

const SAMPLE_CERTS: Certificate[] = [
  {
    id: "c1",
    domain: "signapps.local",
    issuer: "Let's Encrypt",
    expiryDate: "2026-06-15T00:00:00Z",
    status: "valid",
    autoRenew: true,
    lastRenewal: "2025-12-15T00:00:00Z",
  },
  {
    id: "c2",
    domain: "api.signapps.local",
    issuer: "Let's Encrypt",
    expiryDate: "2026-04-20T00:00:00Z",
    status: "expiring",
    autoRenew: true,
    lastRenewal: "2025-10-20T00:00:00Z",
  },
  {
    id: "c3",
    domain: "mail.signapps.local",
    issuer: "Self-signed",
    expiryDate: "2025-09-10T00:00:00Z",
    status: "expired",
    autoRenew: false,
    lastRenewal: "2024-09-10T00:00:00Z",
  },
];

function getStatusIcon(status: string) {
  if (status === "valid") return <CheckCircle className="w-5 h-5 text-green-600" />;
  return <AlertCircle className="w-5 h-5 text-amber-600" />;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "valid":
      return "bg-green-100 text-green-700";
    case "expiring":
      return "bg-amber-100 text-amber-700";
    case "expired":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function SslManager() {
  const [certs, setCerts] = useState<Certificate[]>(SAMPLE_CERTS);

  const toggleAutoRenew = (id: string) => {
    setCerts(
      certs.map((c) =>
        c.id === id ? { ...c, autoRenew: !c.autoRenew } : c
      )
    );
  };

  const daysUntilExpiry = (date: string) => {
    const expiry = new Date(date).getTime();
    const now = new Date().getTime();
    return Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">SSL/TLS Certificates</h2>
          <p className="text-gray-600">Manage and monitor SSL certificates</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Certificate
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Domain</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Issuer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Expiry</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">Auto-Renew</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {certs.map((cert) => (
                <tr key={cert.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{cert.domain}</td>
                  <td className="px-4 py-3 text-gray-700">{cert.issuer}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-gray-900 font-medium">
                        {new Date(cert.expiryDate).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {daysUntilExpiry(cert.expiryDate)} days remaining
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {getStatusIcon(cert.status)}
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(cert.status)}`}>
                        {cert.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={cert.autoRenew}
                        onChange={() => toggleAutoRenew(cert.id)}
                        className="rounded"
                      />
                    </label>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1 hover:bg-blue-100 rounded text-blue-600">
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Valid Certs</p>
          <p className="text-2xl font-bold text-green-600">
            {certs.filter((c) => c.status === "valid").length}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Expiring Soon</p>
          <p className="text-2xl font-bold text-amber-600">
            {certs.filter((c) => c.status === "expiring").length}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Expired</p>
          <p className="text-2xl font-bold text-red-600">
            {certs.filter((c) => c.status === "expired").length}
          </p>
        </div>
      </div>
    </div>
  );
}
