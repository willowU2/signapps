"use client";

/**
 * Notification Settings Page
 * Configure email, SMS, and push notifications
 */

import { SpinnerInfinity } from "spinners-react";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  MessageSquare,
  Bell,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  History,
  Settings,
} from "lucide-react";
import { calendarApi } from "@/lib/api";
import { VAPID_PUBLIC_KEY } from "@/lib/api/core";
import { useAuth } from "@/hooks/use-auth";
import { PushSubscriptionManager } from "@/components/notifications/push-subscription-manager";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { NotificationHistory } from "@/components/notifications/notification-history";
import { SendNotificationAdmin } from "@/components/notifications/send-notification-admin";
import { NotificationGranularPrefs } from "@/components/notifications/notification-granular-prefs";
import { NotificationSounds } from "@/components/notifications/notification-sounds";
import { NotificationDndSchedule } from "@/components/notifications/notification-dnd-schedule";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";

interface NotificationPreferences {
  id: string;
  email_enabled: boolean;
  email_frequency: "instant" | "digest" | "disabled";
  sms_enabled: boolean;
  phone_number: string | null;
  push_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  reminder_times: number[];
  updated_at: string;
}

export default function NotificationSettingsPage() {
  usePageTitle("Preferences notifications");
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushRegistered, setPushRegistered] = useState(false);

  // Load preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await calendarApi.get("/notifications/preferences");
        setPrefs(response.data as NotificationPreferences);
        checkPushRegistration();
      } catch {
        setError("Failed to load notification preferences");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadPreferences();
    }
  }, [user]);

  const checkPushRegistration = async () => {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      setPushRegistered(!!registration);
    }
  };

  const handleChange = (field: string, value: any) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [field]: value });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setError(null);

    try {
      await calendarApi.put("/notifications/preferences", {
        email_enabled: prefs.email_enabled,
        email_frequency: prefs.email_frequency,
        sms_enabled: prefs.sms_enabled,
        phone_number: prefs.phone_number,
        push_enabled: prefs.push_enabled,
        quiet_hours_enabled: prefs.quiet_hours_enabled,
        quiet_start: prefs.quiet_start,
        quiet_end: prefs.quiet_end,
        reminder_times: prefs.reminder_times,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Impossible d'enregistrer preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterPush = async () => {
    try {
      if (!("serviceWorker" in navigator)) {
        setError("Service workers not supported");
        return;
      }

      const registration =
        await navigator.serviceWorker.register("/service-worker.js");

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission denied");
        return;
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY || undefined,
      });

      // Send to backend
      await calendarApi.post("/notifications/subscriptions/push", {
        subscription,
        browser_name: getBrowserName(),
      });

      setPushRegistered(true);
      handleChange("push_enabled", true);
    } catch {
      setError("Failed to register push notifications");
    }
  };

  const getBrowserName = () => {
    const ua = navigator.userAgent;
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return "Unknown";
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-10 flex items-center justify-center">
          <SpinnerInfinity
            size={24}
            secondaryColor="rgba(128,128,128,0.2)"
            color="currentColor"
            speed={120}
            className="h-8 w-8  text-muted-foreground"
          />
        </div>
      </AppLayout>
    );
  }

  if (!prefs) {
    return (
      <AppLayout>
        <div className="container mx-auto py-10">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load notification settings
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Notification Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage how you receive notifications across all devices
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {saved && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Paramètres enregistrés successfully
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <TabsTrigger value="email" className="flex gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="push" className="flex gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Push</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="quiet" className="flex gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Quiet Hours</span>
            </TabsTrigger>
          </TabsList>

          {/* EMAIL TAB */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>
                  Receive calendar reminders via email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="email-enabled">
                      Enable Email Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Send reminders to your email address
                    </p>
                  </div>
                  <Switch
                    id="email-enabled"
                    checked={prefs.email_enabled}
                    onCheckedChange={(value) =>
                      handleChange("email_enabled", value)
                    }
                  />
                </div>

                {prefs.email_enabled && (
                  <div className="space-y-3 border-t pt-6">
                    <Label>Frequency</Label>
                    <Select
                      value={prefs.email_frequency}
                      onValueChange={(value) =>
                        handleChange("email_frequency", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instant">
                          Instant - One email per reminder
                        </SelectItem>
                        <SelectItem value="digest">
                          Digest - Daily email at 8 AM
                        </SelectItem>
                        <SelectItem value="disabled">
                          Disabled - No emails
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {prefs.email_frequency === "instant" &&
                        "You will receive an email for each event reminder"}
                      {prefs.email_frequency === "digest" &&
                        "You will receive one email per day with all reminders"}
                      {prefs.email_frequency === "disabled" &&
                        "Email reminders are disabled"}
                    </p>
                  </div>
                )}

                <div className="border-t pt-6 space-y-3">
                  <Label>Reminder Timing</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive reminders:
                  </p>
                  <div className="space-y-2">
                    {[15, 60, 1440].map((minutes) => (
                      <div key={minutes} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`reminder-${minutes}`}
                          checked={prefs.reminder_times.includes(minutes)}
                          onChange={(e) => {
                            const times = prefs.reminder_times;
                            if (e.target.checked) {
                              handleChange(
                                "reminder_times",
                                [...times, minutes].sort((a, b) => a - b),
                              );
                            } else {
                              handleChange(
                                "reminder_times",
                                times.filter((t) => t !== minutes),
                              );
                            }
                          }}
                          className="rounded border-border"
                        />
                        <label
                          htmlFor={`reminder-${minutes}`}
                          className="text-sm"
                        >
                          {minutes === 15 && "15 minutes before"}
                          {minutes === 60 && "1 hour before"}
                          {minutes === 1440 && "1 day before"}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PUSH TAB */}
          <TabsContent value="push">
            <Card>
              <CardHeader>
                <CardTitle>Push Notifications</CardTitle>
                <CardDescription>
                  Receive browser notifications in real-time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Browser Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get instant alerts in your browser
                      </p>
                    </div>
                    {pushRegistered && (
                      <Badge className="bg-green-600">Registered</Badge>
                    )}
                  </div>

                  {!pushRegistered ? (
                    <Button onClick={handleRegisterPush} className="w-full">
                      <Bell className="h-4 w-4 mr-2" />
                      Enable Push Notifications
                    </Button>
                  ) : (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Push notifications enabled on this device
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {pushRegistered && (
                  <div className="border-t pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="push-enabled">Allow Notifications</Label>
                      <Switch
                        id="push-enabled"
                        checked={prefs.push_enabled}
                        onCheckedChange={(value) =>
                          handleChange("push_enabled", value)
                        }
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You can disable notifications anytime. Browser settings
                      will still override this.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Push Subscription Manager */}
            <div className="mt-6">
              <PushSubscriptionManager />
            </div>
          </TabsContent>

          {/* PREFERENCES TAB */}
          <TabsContent value="preferences" className="space-y-6">
            <NotificationPreferencesForm />
            <NotificationGranularPrefs />
            <NotificationSounds />
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="space-y-6">
            <div className="space-y-4">
              <NotificationHistory limit={100} />
            </div>

            {/* Admin Test Tool */}
            <div className="mt-8">
              <SendNotificationAdmin />
            </div>
          </TabsContent>

          {/* QUIET HOURS TAB */}
          <TabsContent value="quiet" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quiet Hours</CardTitle>
                <CardDescription>
                  Don&apos;t receive notifications during these hours
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="quiet-enabled">Enable Quiet Hours</Label>
                    <p className="text-sm text-muted-foreground">
                      Pause notifications during specific times
                    </p>
                  </div>
                  <Switch
                    id="quiet-enabled"
                    checked={prefs.quiet_hours_enabled}
                    onCheckedChange={(value) =>
                      handleChange("quiet_hours_enabled", value)
                    }
                  />
                </div>

                {prefs.quiet_hours_enabled && (
                  <div className="space-y-4 border-t pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quiet-start">Start Time</Label>
                        <Input
                          id="quiet-start"
                          type="time"
                          value={prefs.quiet_start || "22:00"}
                          onChange={(e) =>
                            handleChange("quiet_start", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quiet-end">End Time</Label>
                        <Input
                          id="quiet-end"
                          type="time"
                          value={prefs.quiet_end || "08:00"}
                          onChange={(e) =>
                            handleChange("quiet_end", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {prefs.quiet_start && prefs.quiet_end
                        ? `Quiet hours: ${prefs.quiet_start} - ${prefs.quiet_end}`
                        : "Set your quiet hours"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            <NotificationDndSchedule />
          </TabsContent>
        </Tabs>

        {/* SAVE BUTTON */}
        <div className="mt-8 flex justify-end gap-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="gap-2"
          >
            {saving ? (
              <>
                <SpinnerInfinity
                  size={24}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="h-4 w-4 "
                />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
