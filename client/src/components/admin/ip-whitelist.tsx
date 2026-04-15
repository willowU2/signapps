"use client";

import { useState } from "react";
import { Globe, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface IPEntry {
  id: string;
  address: string;
  cidr: string;
  country: string;
  enabled: boolean;
}

export function IPWhitelist() {
  const [entries, setEntries] = useState<IPEntry[]>([
    {
      id: "1",
      address: "192.168.1.0",
      cidr: "/24",
      country: "FR",
      enabled: true,
    },
    {
      id: "2",
      address: "10.0.0.0",
      cidr: "/8",
      country: "US",
      enabled: true,
    },
    {
      id: "3",
      address: "172.16.0.0",
      cidr: "/12",
      country: "DE",
      enabled: false,
    },
  ]);

  const [newIP, setNewIP] = useState("");
  const [newCIDR, setNewCIDR] = useState("/32");

  const addEntry = () => {
    if (!newIP.trim()) return;
    const entry: IPEntry = {
      id: Date.now().toString(),
      address: newIP,
      cidr: newCIDR,
      country: "??",
      enabled: true,
    };
    setEntries((prev) => [entry, ...prev]);
    setNewIP("");
    setNewCIDR("/32");
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const toggleEntry = (id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)),
    );
  };

  const getCountryEmoji = (countryCode: string): string => {
    if (countryCode === "??") return "🌐";
    const codePoints = countryCode
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">IP Whitelist</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          {entries.filter((e) => e.enabled).length} of {entries.length} active
        </div>
      </div>

      {/* Add New Entry */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="font-semibold text-foreground mb-4">Add IP Address</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            placeholder="192.168.1.100 or 10.0.0.0"
            value={newIP}
            onChange={(e) => setNewIP(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
          />
          <select
            value={newCIDR}
            onChange={(e) => setNewCIDR(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="/32">Single IP (/32)</option>
            <option value="/24">Subnet (/24)</option>
            <option value="/16">Network (/16)</option>
            <option value="/8">Large (/8)</option>
          </select>
          <Button onClick={addEntry} className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* IP List */}
      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted p-8 text-center text-muted-foreground">
            No IP addresses whitelisted yet
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-lg border p-3 shadow-sm transition-opacity ${
                entry.enabled
                  ? "border-border bg-card"
                  : "border-gray-100 bg-muted opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* IP Info */}
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-2xl">
                    {getCountryEmoji(entry.country)}
                  </span>
                  <div className="flex-1">
                    <p className="font-mono text-sm font-medium text-foreground">
                      {entry.address}
                      <span className="ml-1 text-muted-foreground">
                        {entry.cidr}
                      </span>
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {entry.country}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleEntry(entry.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {entry.enabled ? (
                      <ToggleRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntry(entry.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
