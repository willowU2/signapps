"use client";

import { useState } from "react";
import { Edit2, Settings, Bell, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface WelcomeMessage {
  title: string;
  subtitle: string;
}

interface QuickLink {
  id: string;
  label: string;
  icon: string;
  url: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: Date;
  priority: "high" | "medium" | "low";
}

interface Module {
  id: string;
  name: string;
  enabled: boolean;
}

interface TenantLandingPageProps {
  tenantId: string;
  welcomeMessage?: WelcomeMessage;
  onWelcomeUpdate?: (message: WelcomeMessage) => void;
  quickLinks?: QuickLink[];
  onQuickLinksChange?: (links: QuickLink[]) => void;
  announcements?: Announcement[];
  modules?: Module[];
  onModulesChange?: (modules: Module[]) => void;
}

export function TenantLandingPage({
  tenantId,
  welcomeMessage = { title: "Welcome", subtitle: "Get started with SignApps" },
  onWelcomeUpdate,
  quickLinks = [],
  onQuickLinksChange,
  announcements = [],
  modules = [],
  onModulesChange,
}: TenantLandingPageProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedWelcome, setEditedWelcome] = useState(welcomeMessage);
  const [editedLinks, setEditedLinks] = useState(quickLinks);

  const handleSaveWelcome = () => {
    onWelcomeUpdate?.(editedWelcome);
    setEditMode(false);
  };

  const toggleModule = (moduleId: string) => {
    const updated = modules.map((m) =>
      m.id === moduleId ? { ...m, enabled: !m.enabled } : m
    );
    onModulesChange?.(updated);
  };

  const removeQuickLink = (linkId: string) => {
    const updated = editedLinks.filter((l) => l.id !== linkId);
    setEditedLinks(updated);
    onQuickLinksChange?.(updated);
  };

  const priorityColors = {
    high: "bg-red-100 text-red-800 dark:bg-red-900/30",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30",
    low: "bg-green-100 text-green-800 dark:bg-green-900/30",
  };

  return (
    <div className="w-full space-y-6 p-6">
      {/* Welcome Section */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {editMode ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editedWelcome.title}
                  onChange={(e) =>
                    setEditedWelcome({ ...editedWelcome, title: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2 text-xl font-bold"
                  placeholder="Welcome title"
                />
                <input
                  type="text"
                  value={editedWelcome.subtitle}
                  onChange={(e) =>
                    setEditedWelcome({ ...editedWelcome, subtitle: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Welcome subtitle"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveWelcome} size="sm">
                    Save
                  </Button>
                  <Button onClick={() => setEditMode(false)} variant="outline" size="sm">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl font-bold">{editedWelcome.title}</h1>
                <p className="text-gray-600 mt-2">{editedWelcome.subtitle}</p>
              </div>
            )}
          </div>
          {!editMode && (
            <Button
              onClick={() => setEditMode(true)}
              variant="ghost"
              size="icon"
            >
              <Edit2 className="size-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {editedLinks.map((link) => (
            <Card key={link.id} className="p-4 relative group">
              <a href={link.url} className="block hover:opacity-70">
                <div className="text-3xl mb-2">{link.icon}</div>
                <p className="text-sm font-medium">{link.label}</p>
              </a>
              {editMode && (
                <button
                  onClick={() => removeQuickLink(link.id)}
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="size-3 text-red-500" />
                </button>
              )}
            </Card>
          ))}
          {editMode && (
            <Card className="p-4 flex items-center justify-center border-dashed border-2 cursor-pointer hover:bg-gray-50">
              <Button variant="ghost" size="icon">
                <Plus className="size-4" />
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Announcements Widget */}
      {announcements.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="size-5" />
            <h2 className="text-lg font-semibold">Announcements</h2>
          </div>
          <div className="space-y-3">
            {announcements.slice(0, 3).map((announcement) => (
              <div key={announcement.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{announcement.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{announcement.content}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      priorityColors[announcement.priority]
                    }`}
                  >
                    {announcement.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {announcement.date.toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Customizable Modules */}
      {modules.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="size-5" />
            <h2 className="text-lg font-semibold">Modules</h2>
          </div>
          <div className="space-y-3">
            {modules.map((module) => (
              <div key={module.id} className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium">{module.name}</span>
                <button
                  onClick={() => toggleModule(module.id)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    module.enabled
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {module.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
