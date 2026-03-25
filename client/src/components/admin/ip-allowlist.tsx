"use client";

import { useEffect, useState, useCallback } from "react";
import { Globe, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IDENTITY_URL } from "@/lib/api/core";
import axios from "axios";
import { toast } from "sonner";

interface IpAllowlistEntry {
  address: string;
  cidr: string;
  label: string | null;
  enabled: boolean;
}

type LocalEntry = IpAllowlistEntry & { _key: string };

function makeKey() {
  return Math.random().toString(36).slice(2);
}

export function IpAllowlist() {
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newIP, setNewIP] = useState("");
  const [newCIDR, setNewCIDR] = useState("/32");
  const [newLabel, setNewLabel] = useState("");

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${IDENTITY_URL}/admin/security/ip-allowlist`, {
        withCredentials: true,
      });
      setEntries((res.data as IpAllowlistEntry[]).map((e) => ({ ...e, _key: makeKey() })));
    } catch {
      toast.error("Failed to load IP allowlist");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const saveEntries = async () => {
    setIsSaving(true);
    try {
      const payload: IpAllowlistEntry[] = entries.map(({ _key: _, ...e }) => e);
      await axios.put(`${IDENTITY_URL}/admin/security/ip-allowlist`, payload, {
        withCredentials: true,
      });
      toast.success("IP allowlist saved");
    } catch {
      toast.error("Failed to save IP allowlist");
    } finally {
      setIsSaving(false);
    }
  };

  const addEntry = () => {
    const ip = newIP.trim();
    if (!ip) return;
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    const ipv6simple = ip.includes(":");
    if (!ipv4 && !ipv6simple) {
      toast.error("Enter a valid IPv4 or IPv6 address");
      return;
    }
    setEntries((prev) => [
      ...prev,
      { _key: makeKey(), address: ip, cidr: newCIDR, label: newLabel || null, enabled: true },
    ]);
    setNewIP("");
    setNewLabel("");
  };

  const removeEntry = (key: string) => {
    setEntries((prev) => prev.filter((e) => e._key !== key));
  };

  const toggleEntry = (key: string) => {
    setEntries((prev) =>
      prev.map((e) => (e._key === key ? { ...e, enabled: !e.enabled } : e))
    );
  };

  const activeCount = entries.filter((e) => e.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold">IP Allowlist</h2>
            <p className="text-sm text-gray-500">{activeCount} of {entries.length} rules active</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchEntries} disabled={isLoading} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={saveEntries} disabled={isSaving} className="gap-1">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-900">Add IP Rule</h3>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="IP address (e.g. 192.168.1.0)"
            value={newIP}
            onChange={(e) => setNewIP(e.target.value)}
            className="flex-1 min-w-[180px]"
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
          />
          <select
            value={newCIDR}
            onChange={(e) => setNewCIDR(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="/32">Single (/32)</option>
            <option value="/24">Subnet (/24)</option>
            <option value="/16">Network (/16)</option>
            <option value="/8">Large (/8)</option>
            <option value="/0">All (/0)</option>
          </select>
          <Input
            placeholder="Label (optional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-40"
          />
          <Button onClick={addEntry} className="gap-1">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Entries list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
          No IP rules configured — all IPs are allowed.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry._key}
              className={`rounded-lg border p-3 shadow-sm transition-opacity ${
                entry.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-1 items-center gap-3">
                  <Globe className="h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <p className="font-mono text-sm font-medium text-gray-900">
                      {entry.address}
                      <span className="ml-1 text-gray-500">{entry.cidr}</span>
                    </p>
                    {entry.label && (
                      <Badge variant="outline" className="mt-0.5 text-xs">{entry.label}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleEntry(entry._key)}
                    title={entry.enabled ? "Disable" : "Enable"}
                  >
                    {entry.enabled ? (
                      <ToggleRight className="h-5 w-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-gray-400" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntry(entry._key)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
