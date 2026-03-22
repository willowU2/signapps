"use client";

import { useState } from "react";
import { Copy, Trash2, Plus, Link2, Clock } from "lucide-react";

interface AccessLink {
  id: string;
  token: string;
  ttlHours: number;
  createdAt: string;
  expiresAt: string;
  permissions: string[];
  accessCount: number;
}

const DEFAULT_LINKS: AccessLink[] = [
  {
    id: "1",
    token: "guest_abc123def456",
    ttlHours: 24,
    createdAt: "2026-03-22 10:00",
    expiresAt: "2026-03-23 10:00",
    permissions: ["view", "comment"],
    accessCount: 3,
  },
  {
    id: "2",
    token: "guest_xyz789uvw012",
    ttlHours: 72,
    createdAt: "2026-03-20 14:30",
    expiresAt: "2026-03-23 14:30",
    permissions: ["view"],
    accessCount: 8,
  },
];

export function GuestAccess() {
  const [links, setLinks] = useState<AccessLink[]>(DEFAULT_LINKS);
  const [selectedTTL, setSelectedTTL] = useState<number>(24);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "view",
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerateLink = () => {
    const token = `guest_${Math.random().toString(36).substring(2, 15)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + selectedTTL * 60 * 60 * 1000);

    const newLink: AccessLink = {
      id: Date.now().toString(),
      token,
      ttlHours: selectedTTL,
      createdAt: now.toLocaleString(),
      expiresAt: expiresAt.toLocaleString(),
      permissions: selectedPermissions,
      accessCount: 0,
    };

    setLinks([newLink, ...links]);
  };

  const handleCopyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/guest/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeLink = (id: string) => {
    setLinks(links.filter((l) => l.id !== id));
  };

  const togglePermission = (perm: string) => {
    if (selectedPermissions.includes(perm)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== perm));
    } else {
      setSelectedPermissions([...selectedPermissions, perm]);
    }
  };

  const activeLinks = links.filter(
    (l) =>
      new Date(l.expiresAt) > new Date()
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Guest Access</h2>
          <p className="text-gray-600">Generate temporary guest access links</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700 font-medium">Active Links</p>
        <p className="text-2xl font-bold text-blue-900">{activeLinks}</p>
      </div>

      <div className="border rounded-lg p-6 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4">Generate New Link</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (hours)
            </label>
            <div className="flex gap-2">
              {[1, 24, 72, 168].map((hours) => (
                <button
                  key={hours}
                  onClick={() => setSelectedTTL(hours)}
                  className={`px-3 py-2 rounded-lg border font-medium transition-colors ${
                    selectedTTL === hours
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-300"
                  }`}
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              {["view", "comment", "edit", "download"].map((perm) => (
                <label key={perm} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm)}
                    onChange={() => togglePermission(perm)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {perm}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateLink}
            disabled={selectedPermissions.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Generate Link
          </button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Active Links</h3>
        </div>

        <div className="divide-y">
          {links.map((link) => (
            <div key={link.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-900">
                      {link.token.substring(0, 20)}...
                    </code>
                    <button
                      onClick={() => handleCopyLink(link.token, link.id)}
                      className="text-gray-500 hover:text-blue-600"
                      title="Copy link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {copiedId === link.id && (
                      <span className="text-xs text-green-600 font-medium">
                        Copied!
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {link.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>Created: {link.createdAt}</span>
                    <span>Accesses: {link.accessCount}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                    <Clock className="w-4 h-4" />
                    Expires: {link.expiresAt}
                  </div>
                  <button
                    onClick={() => handleRevokeLink(link.id)}
                    className="text-red-600 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
