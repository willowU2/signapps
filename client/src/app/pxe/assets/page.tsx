"use client";

/**
 * /pxe/assets — PXE asset registry.
 *
 * Three tabs:
 *  - all        — every asset regardless of status
 *  - discovered — auto-discovered via DHCP, not yet enrolled
 *  - enrolled   — active PXE targets
 *
 * Discovered assets get an "Enrôler" button that calls
 * `POST /api/v1/pxe/assets/:mac/enroll` and refreshes the list.
 */

import { useEffect, useState } from "react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/use-page-title";

type Asset = {
  id?: string;
  mac_address: string;
  status: string;
  hostname?: string | null;
  last_seen?: string | null;
  discovered_via?: string;
  dhcp_vendor_class?: string | null;
};

type TabKey = "all" | "discovered" | "enrolled";

const pxeClient = getClient(ServiceName.PXE);

export default function PxeAssetsPage() {
  usePageTitle("Assets PXE");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tab, setTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState<boolean>(true);

  const load = () => {
    setLoading(true);
    pxeClient
      .get<Asset[]>("/pxe/assets")
      .then((r) => setAssets(r.data ?? []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = (t: TabKey): Asset[] => {
    if (t === "all") return assets;
    if (t === "discovered") {
      return assets.filter((a) => a.status === "discovered");
    }
    return assets.filter((a) => a.status !== "discovered");
  };

  const enroll = async (mac: string) => {
    try {
      await pxeClient.post(`/pxe/assets/${encodeURIComponent(mac)}/enroll`, {});
    } finally {
      load();
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <h1 className="mb-6 text-3xl font-bold">Assets PXE</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="all">Tous ({assets.length})</TabsTrigger>
            <TabsTrigger value="discovered">
              Découverts ({filtered("discovered").length})
            </TabsTrigger>
            <TabsTrigger value="enrolled">
              Enrôlés ({filtered("enrolled").length})
            </TabsTrigger>
          </TabsList>

          {(["all", "discovered", "enrolled"] as TabKey[]).map((t) => (
            <TabsContent key={t} value={t}>
              <div className="space-y-2 pt-4">
                {loading && (
                  <div className="text-sm text-muted-foreground">
                    Chargement…
                  </div>
                )}
                {!loading && filtered(t).length === 0 && (
                  <div className="rounded border border-border p-3 text-sm text-muted-foreground">
                    Aucun asset.
                  </div>
                )}
                {filtered(t).map((a) => (
                  <div
                    key={a.mac_address}
                    className="flex items-center justify-between rounded border border-border p-3"
                    data-testid={`pxe-asset-${a.mac_address}`}
                  >
                    <div>
                      <div className="font-mono text-sm">{a.mac_address}</div>
                      {a.hostname && (
                        <div className="text-xs text-muted-foreground">
                          {a.hostname}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Status : {a.status}
                        {a.discovered_via && ` · via ${a.discovered_via}`}
                      </div>
                    </div>
                    {a.status === "discovered" && (
                      <Button
                        size="sm"
                        onClick={() => enroll(a.mac_address)}
                        data-testid={`pxe-enroll-${a.mac_address}`}
                      >
                        Enrôler
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
