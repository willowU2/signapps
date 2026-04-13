"use client";

import { useState } from "react";
import Image from "next/image";
import { User, Bell, Moon, Globe, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface ActionHistory {
  id: string;
  timestamp: string;
  action: string;
  status: "success" | "pending" | "error";
  details: string;
}

export function SelfServicePortal() {
  const [user, setUser] = useState({
    name: "John Doe",
    email: "john.doe@example.com",
    role: "Admin",
    avatar: "https://via.placeholder.com/80",
  });

  const [preferences, setPreferences] = useState({
    notifications: true,
    emailAlerts: true,
    darkMode: false,
    language: "en",
    timezone: "UTC",
    twoFactorEnabled: true,
  });

  const [subscriptions, setSubscriptions] = useState({
    documents: true,
    spreadsheets: true,
    presentations: true,
    communications: true,
    analytics: true,
    aiTools: false,
  });

  const [actionHistory] = useState<ActionHistory[]>([
    {
      id: "1",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      action: "Updated profile",
      status: "success",
      details: "Changed email address",
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      action: "Enabled 2FA",
      status: "success",
      details: "Two-factor authentication activated",
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      action: "Module subscription",
      status: "success",
      details: "Subscribed to Analytics module",
    },
  ]);

  const handleSavePreferences = () => {
    toast.success("Préférences enregistrées");
  };

  const handleSubscriptionChange = (key: keyof typeof subscriptions) => {
    setSubscriptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-muted text-gray-800";
    }
  };

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Self-Service Portal
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your profile, preferences, and module subscriptions
        </p>
      </div>

      {/* User Profile Card */}
      <Card className="border border-border overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-24" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-6">
            <Image
              src={user.avatar}
              alt={user.name}
              width={96}
              height={96}
              className="rounded-lg border-4 border-white shadow"
            />
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {user.name}
              </h2>
              <p className="text-muted-foreground">{user.role}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800">Admin Access</Badge>
              <Badge className="bg-green-100 text-green-800">2FA Enabled</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Preferences Section */}
      <Card className="border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Notification Preferences
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 hover:bg-muted rounded">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  Push Notifications
                </p>
                <p className="text-sm text-muted-foreground">
                  Get notified about important events
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.notifications}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({
                  ...prev,
                  notifications: checked,
                }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between p-3 hover:bg-muted rounded">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Email Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Send alerts to your email address
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.emailAlerts}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({
                  ...prev,
                  emailAlerts: checked,
                }))
              }
            />
          </div>
        </div>
      </Card>

      {/* Display Preferences */}
      <Card className="border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Display Preferences
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 hover:bg-muted rounded">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Dark Mode</p>
                <p className="text-sm text-muted-foreground">
                  Use dark theme across the platform
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.darkMode}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({
                  ...prev,
                  darkMode: checked,
                }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between p-3 hover:bg-muted rounded">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Language</p>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred language
                </p>
              </div>
            </div>
            <Select
              value={preferences.language}
              onValueChange={(value) =>
                setPreferences((prev) => ({
                  ...prev,
                  language: value,
                }))
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between p-3 hover:bg-muted rounded">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Timezone</p>
                <p className="text-sm text-muted-foreground">
                  Set your local timezone
                </p>
              </div>
            </div>
            <Select
              value={preferences.timezone}
              onValueChange={(value) =>
                setPreferences((prev) => ({
                  ...prev,
                  timezone: value,
                }))
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="EST">EST</SelectItem>
                <SelectItem value="CST">CST</SelectItem>
                <SelectItem value="PST">PST</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Module Subscriptions */}
      <Card className="border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Module Subscriptions
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(subscriptions).map(([key, enabled]) => (
            <div
              key={key}
              className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted"
            >
              <Switch
                checked={enabled}
                onCheckedChange={() =>
                  handleSubscriptionChange(key as keyof typeof subscriptions)
                }
              />
              <div className="flex-1">
                <p className="font-medium text-foreground capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {enabled ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Action History */}
      <Card className="border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Recent Actions
        </h3>

        <div className="space-y-2">
          {actionHistory.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 hover:bg-muted rounded border border-gray-100"
            >
              <div className="flex-1">
                <p className="font-medium text-foreground">{item.action}</p>
                <p className="text-sm text-muted-foreground">{item.details}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(item.timestamp).toLocaleString()}
                </p>
              </div>
              <Badge className={getStatusColor(item.status)}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline">Annuler</Button>
        <Button onClick={handleSavePreferences}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
