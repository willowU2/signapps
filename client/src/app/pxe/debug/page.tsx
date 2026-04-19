"use client";

/**
 * /pxe/debug — DHCP request audit trail.
 *
 * Polls `GET /api/v1/pxe/dhcp/recent?limit=100` every 3 s and renders
 * the most recent ProxyDHCP requests. Useful for diagnosing why an
 * asset is not showing up (wrong vendor class, no OPTION 60, etc.).
 */

import { useEffect, useState } from "react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";

type DhcpLog = {
  id: number;
  mac_address: string;
  msg_type?: string | null;
  vendor_class?: string | null;
  responded: boolean;
  received_at: string;
};

const pxeClient = getClient(ServiceName.PXE);

export default function PxeDebugPage() {
  usePageTitle("Debug PXE");
  const [logs, setLogs] = useState<DhcpLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      pxeClient
        .get<DhcpLog[]>("/pxe/dhcp/recent?limit=100")
        .then((r) => {
          if (!cancelled) setLogs(r.data ?? []);
        })
        .catch(() => {
          // ignore — next tick will retry
        });
    };
    load();
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <h1 className="mb-6 text-3xl font-bold">Debug PXE — DHCP requests</h1>
        <div
          className="rounded border border-border"
          data-testid="pxe-debug-table"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted">
              <tr className="text-left">
                <th className="p-2">Reçu</th>
                <th className="p-2">MAC</th>
                <th className="p-2">Type</th>
                <th className="p-2">Vendor</th>
                <th className="p-2">Réponse</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Aucune requête DHCP pour le moment.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border">
                  <td className="p-2 text-muted-foreground">
                    {new Date(l.received_at).toLocaleTimeString()}
                  </td>
                  <td className="p-2 font-mono">{l.mac_address}</td>
                  <td className="p-2">{l.msg_type ?? "—"}</td>
                  <td className="max-w-xs truncate p-2">
                    {l.vendor_class ?? "—"}
                  </td>
                  <td className="p-2">{l.responded ? "OK" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
