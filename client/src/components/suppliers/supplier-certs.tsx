"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

interface Certification {
  id: string;
  supplier: string;
  type: "ISO" | "Insurance" | "Kbis";
  certNumber: string;
  expiryDate: string;
  status: "valid" | "expiring" | "expired";
}

const DEFAULT_CERTS: Certification[] = [
  {
    id: "1",
    supplier: "TechSupply Inc",
    type: "ISO",
    certNumber: "ISO-9001-2024-001",
    expiryDate: "2027-06-15",
    status: "valid",
  },
  {
    id: "2",
    supplier: "TechSupply Inc",
    type: "Insurance",
    certNumber: "INS-2026-5200",
    expiryDate: "2026-05-10",
    status: "expiring",
  },
  {
    id: "3",
    supplier: "Global Components",
    type: "ISO",
    certNumber: "ISO-14001-2023-005",
    expiryDate: "2026-03-20",
    status: "expired",
  },
  {
    id: "4",
    supplier: "Global Components",
    type: "Kbis",
    certNumber: "KBIS-FR-123456789",
    expiryDate: "2027-12-31",
    status: "valid",
  },
  {
    id: "5",
    supplier: "Premium Parts Co",
    type: "ISO",
    certNumber: "ISO-45001-2024-002",
    expiryDate: "2026-08-22",
    status: "valid",
  },
  {
    id: "6",
    supplier: "Premium Parts Co",
    type: "Insurance",
    certNumber: "INS-2026-9800",
    expiryDate: "2026-04-15",
    status: "expiring",
  },
];

export default function SupplierCerts() {
  const [certs] = useState<Certification[]>(DEFAULT_CERTS);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "valid":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "expiring":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "expired":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClass = "px-2 py-1 rounded text-xs font-semibold";
    switch (status) {
      case "valid":
        return baseClass + " bg-green-100 text-green-700";
      case "expiring":
        return baseClass + " bg-yellow-100 text-yellow-700";
      case "expired":
        return baseClass + " bg-red-100 text-red-700";
      default:
        return baseClass + " bg-muted text-muted-foreground";
    }
  };

  const groupedBySupplier = certs.reduce(
    (acc, cert) => {
      if (!acc[cert.supplier]) {
        acc[cert.supplier] = [];
      }
      acc[cert.supplier].push(cert);
      return acc;
    },
    {} as Record<string, Certification[]>,
  );

  const hasExpiredOrExpiring = (certList: Certification[]) => {
    return certList.some((c) => c.status !== "valid");
  };

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Supplier Certifications</h2>
        </div>
        <div className="divide-y">
          {Object.entries(groupedBySupplier).map(([supplier, certList]) => (
            <div key={supplier} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{supplier}</h3>
                {hasExpiredOrExpiring(certList) && (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
              </div>
              <div className="space-y-2 ml-2">
                {certList.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between rounded bg-muted p-3"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(cert.status)}
                      <div>
                        <p className="text-sm font-medium">{cert.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {cert.certNumber}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Expires: {cert.expiryDate}
                      </p>
                      <span className={getStatusBadge(cert.status)}>
                        {cert.status.charAt(0).toUpperCase() +
                          cert.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Valid</p>
              <p className="text-xl font-bold">
                {certs.filter((c) => c.status === "valid").length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-xs text-muted-foreground">Expiring Soon</p>
              <p className="text-xl font-bold">
                {certs.filter((c) => c.status === "expiring").length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-xs text-muted-foreground">Expired</p>
              <p className="text-xl font-bold">
                {certs.filter((c) => c.status === "expired").length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
