"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";

interface DnsRecord {
  id: string;
  type: "A" | "CNAME" | "MX" | "TXT";
  name: string;
  value: string;
  ttl: number;
}

interface DnsZone {
  id: string;
  domain: string;
  recordCount: number;
  lastUpdated: string;
  records: DnsRecord[];
}

const SAMPLE_ZONES: DnsZone[] = [
  {
    id: "z1",
    domain: "signapps.local",
    recordCount: 8,
    lastUpdated: "2026-03-20T14:30:00Z",
    records: [
      { id: "r1", type: "A", name: "@", value: "192.168.1.10", ttl: 3600 },
      { id: "r2", type: "A", name: "mail", value: "192.168.1.20", ttl: 3600 },
      { id: "r3", type: "MX", name: "@", value: "mail.signapps.local", ttl: 3600 },
      { id: "r4", type: "TXT", name: "@", value: "v=spf1 mx ~all", ttl: 3600 },
    ],
  },
  {
    id: "z2",
    domain: "api.signapps.local",
    recordCount: 3,
    lastUpdated: "2026-03-19T10:15:00Z",
    records: [
      { id: "r5", type: "A", name: "@", value: "192.168.1.30", ttl: 3600 },
      { id: "r6", type: "CNAME", name: "v1", value: "api.signapps.local", ttl: 3600 },
    ],
  },
];

export function DnsManager() {
  const [zones] = useState<DnsZone[]>(SAMPLE_ZONES);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set(["z1"]));

  const toggleZone = (zoneId: string) => {
    const newExpanded = new Set(expandedZones);
    if (newExpanded.has(zoneId)) {
      newExpanded.delete(zoneId);
    } else {
      newExpanded.add(zoneId);
    }
    setExpandedZones(newExpanded);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">DNS Manager</h2>
          <p className="text-gray-600">Manage DNS zones and records</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Zone
        </button>
      </div>

      <div className="space-y-4">
        {zones.map((zone) => (
          <div key={zone.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleZone(zone.id)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">{zone.domain}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {zone.recordCount} records
                </span>
              </div>
              <span className="text-sm text-gray-500">Updated: {new Date(zone.lastUpdated).toLocaleDateString()}</span>
            </button>

            {expandedZones.has(zone.id) && (
              <div className="border-t overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Type</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Name</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Value</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">TTL</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {zone.records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs font-bold text-blue-600">{record.type}</span>
                        </td>
                        <td className="px-4 py-2 font-mono text-gray-700">{record.name}</td>
                        <td className="px-4 py-2 text-gray-700">{record.value}</td>
                        <td className="px-4 py-2 text-gray-700">{record.ttl}s</td>
                        <td className="px-4 py-2 text-right flex gap-2 justify-end">
                          <button className="p-1 hover:bg-gray-200 rounded text-gray-600">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="p-1 hover:bg-red-100 rounded text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-900 font-medium">
          Tip: Ensure MX records are properly configured for mail delivery and SPF records for authentication.
        </p>
      </div>
    </div>
  );
}
