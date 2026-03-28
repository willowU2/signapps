"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncConfig {
  sourceSite: string;
  targetSite: string;
  dataTypes: { name: string; enabled: boolean }[];
  lastSyncTime: Date | null;
}

export function InterSiteSync() {
  const [config, setConfig] = useState<SyncConfig>({
    sourceSite: "New York HQ",
    targetSite: "Bureau San Francisco",
    dataTypes: [
      { name: "Contacts", enabled: true },
      { name: "Documents", enabled: true },
      { name: "Événements", enabled: false },
      { name: "Paramètres", enabled: true },
    ],
    lastSyncTime: new Date(Date.now() - 2 * 3600000),
  });
  const [syncing, setSyncing] = useState(false);
  const [sites] = useState(["New York HQ", "San Francisco Office", "Chicago Branch", "Boston Tech Center"]);

  const toggleDataType = (index: number) => {
    const updated = [...config.dataTypes];
    updated[index].enabled = !updated[index].enabled;
    setConfig({ ...config, dataTypes: updated });
  };

  const handleSync = async () => {
    setSyncing(true);
    setTimeout(() => {
      setConfig({ ...config, lastSyncTime: new Date() });
      setSyncing(false);
    }, 2000);
  };

  const getEnabledCount = () => config.dataTypes.filter((d) => d.enabled).length;

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4 bg-blue-50">
        <h3 className="font-semibold mb-3">Sync Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Source Site</label>
            <select
              value={config.sourceSite}
              onChange={(e) => setConfig({ ...config, sourceSite: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              {sites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Site</label>
            <select
              value={config.targetSite}
              onChange={(e) => setConfig({ ...config, targetSite: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              {sites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Data Types to Sync</h3>
        <div className="space-y-2">
          {config.dataTypes.map((dataType, index) => (
            <label key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100">
              <input
                type="checkbox"
                checked={dataType.enabled}
                onChange={() => toggleDataType(index)}
              />
              <span className="font-medium">{dataType.name}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Enabled: {getEnabledCount()} of {config.dataTypes.length} data types
        </p>
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Last Sync</h3>
          {config.lastSyncTime && (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Successful</span>
            </div>
          )}
        </div>
        {config.lastSyncTime ? (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{config.lastSyncTime.toLocaleString()}</span>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No sync performed yet</p>
        )}
      </div>

      <Button
        onClick={handleSync}
        disabled={syncing || getEnabledCount() === 0}
        className="w-full gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Now"}
      </Button>
    </div>
  );
}
