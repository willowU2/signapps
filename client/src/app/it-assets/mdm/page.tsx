"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Smartphone,
  Shield,
  ShieldOff,
  Trash2,
  Plus,
  QrCode,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Settings,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceOS = "iOS" | "Android" | "Windows" | "macOS";
type ComplianceStatus = "compliant" | "non_compliant" | "pending" | "unknown";

interface MdmDevice {
  id: string;
  name: string;
  os: DeviceOS;
  osVersion: string;
  lastCheckIn: string;
  compliance: ComplianceStatus;
  enrolledAt: string;
  owner?: string;
  serialNumber?: string;
}

// ─── Mock data (localStorage persistence) ─────────────────────────────────────

const STORAGE_KEY = "signapps_mdm_devices";

const DEFAULT_DEVICES: MdmDevice[] = [
  {
    id: "dev-001",
    name: "iPhone 14 Pro — Etienne",
    os: "iOS",
    osVersion: "17.4",
    lastCheckIn: new Date(Date.now() - 300_000).toISOString(),
    compliance: "compliant",
    enrolledAt: "2026-01-10",
    owner: "Etienne Dupont",
  },
  {
    id: "dev-002",
    name: "Galaxy S23 — Marie",
    os: "Android",
    osVersion: "14.0",
    lastCheckIn: new Date(Date.now() - 900_000).toISOString(),
    compliance: "non_compliant",
    enrolledAt: "2026-01-15",
    owner: "Marie Laurent",
  },
  {
    id: "dev-003",
    name: "iPad Air — Support",
    os: "iOS",
    osVersion: "17.2",
    lastCheckIn: new Date(Date.now() - 3_600_000).toISOString(),
    compliance: "compliant",
    enrolledAt: "2026-02-01",
    owner: "Support Team",
  },
  {
    id: "dev-004",
    name: "Pixel 8 — Julien",
    os: "Android",
    osVersion: "14.1",
    lastCheckIn: new Date(Date.now() - 7_200_000).toISOString(),
    compliance: "pending",
    enrolledAt: "2026-03-20",
    owner: "Julien Martin",
  },
];

function loadDevices(): MdmDevice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_DEVICES;
  } catch {
    return DEFAULT_DEVICES;
  }
}

function saveDevices(devices: MdmDevice[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const map: Record<
    ComplianceStatus,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    compliant: { label: "Compliant", variant: "default" },
    non_compliant: { label: "Non-compliant", variant: "destructive" },
    pending: { label: "Pending", variant: "secondary" },
    unknown: { label: "Unknown", variant: "outline" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function osBadge(os: DeviceOS) {
  const colors: Record<DeviceOS, string> = {
    iOS: "bg-gray-800 text-white",
    Android: "bg-green-700 text-white",
    Windows: "bg-blue-700 text-white",
    macOS: "bg-gray-600 text-white",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[os]}`}
    >
      {os}
    </span>
  );
}

// ─── QR Enrollment ────────────────────────────────────────────────────────────

function EnrollmentPanel() {
  const serverUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/mdm/enroll`
      : "https://your-server/mdm/enroll";
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          Device Enrollment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 items-start flex-wrap">
          {/* QR Code placeholder (real implementation would use a QR library) */}
          <div className="flex-shrink-0 w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground bg-muted/30">
            <QrCode className="h-10 w-10 opacity-40" />
            <span className="text-xs text-center">
              QR Code
              <br />
              (production)
            </span>
          </div>
          <div className="flex-1 min-w-64 space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Enrollment URL</p>
              <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                {serverUrl}
              </code>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Instructions:</p>
              <p>
                <strong>iOS:</strong> Settings → General → VPN & Device
                Management → Add MDM Profile → scan QR or enter URL
              </p>
              <p>
                <strong>Android:</strong> Settings → Biometrics and security →
                Device admin apps → Enroll → scan QR
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Action Dialog ────────────────────────────────────────────────────────────

type DeviceAction = "lock" | "wipe" | "profile";

function ActionDialog({
  device,
  action,
  onClose,
}: {
  device: MdmDevice;
  action: DeviceAction;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  const labels: Record<
    DeviceAction,
    {
      title: string;
      desc: string;
      confirm: string;
      variant: "default" | "destructive";
    }
  > = {
    lock: {
      title: "Remote Lock",
      desc: `Lock ${device.name} immediately. The user will need their PIN to unlock.`,
      confirm: "Lock Device",
      variant: "default",
    },
    wipe: {
      title: "Remote Wipe",
      desc: `Permanently erase all data on ${device.name}. This action CANNOT be undone.`,
      confirm: "Wipe Device",
      variant: "destructive",
    },
    profile: {
      title: "Install Profile",
      desc: `Push the standard configuration profile to ${device.name}. This will apply security policies.`,
      confirm: "Install",
      variant: "default",
    },
  };
  const { title, desc, confirm, variant } = labels[action];

  function execute() {
    // In production: POST /api/v1/it-assets/mdm/devices/${device.id}/action  { action }
    setConfirmed(true);
    setTimeout(onClose, 1500);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{desc}</p>
        {confirmed && (
          <p className="text-sm text-primary font-medium">
            Command sent. Waiting for device response…
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!confirmed && (
            <Button variant={variant} onClick={execute}>
              {confirm}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Device Dialog ────────────────────────────────────────────────────────

function AddDeviceDialog({
  onAdd,
  onClose,
}: {
  onAdd: (d: MdmDevice) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    os: "iOS" as DeviceOS,
    osVersion: "",
    owner: "",
  });
  function submit() {
    if (!form.name) return;
    onAdd({
      id: `dev-${Date.now()}`,
      name: form.name,
      os: form.os,
      osVersion: form.osVersion || "latest",
      owner: form.owner,
      lastCheckIn: new Date().toISOString(),
      compliance: "pending",
      enrolledAt: new Date().toISOString().slice(0, 10),
    });
    onClose();
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Device</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Device name</Label>
            <Input
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="iPhone 15 — John"
            />
          </div>
          <div>
            <Label>OS</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.os}
              onChange={(e) =>
                setForm((f) => ({ ...f, os: e.target.value as DeviceOS }))
              }
            >
              <option>iOS</option>
              <option>Android</option>
              <option>Windows</option>
              <option>macOS</option>
            </select>
          </div>
          <div>
            <Label>OS Version</Label>
            <Input
              className="mt-1"
              value={form.osVersion}
              onChange={(e) =>
                setForm((f) => ({ ...f, osVersion: e.target.value }))
              }
              placeholder="17.4"
            />
          </div>
          <div>
            <Label>Owner</Label>
            <Input
              className="mt-1"
              value={form.owner}
              onChange={(e) =>
                setForm((f) => ({ ...f, owner: e.target.value }))
              }
              placeholder="Full name"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add Device</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MdmPage() {
  usePageTitle("MDM");
  const [devices, setDevices] = useState<MdmDevice[]>([]);
  const [pendingAction, setPendingAction] = useState<{
    device: MdmDevice;
    action: DeviceAction;
  } | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    setDevices(loadDevices());
  }, []);

  function removeDevice(id: string) {
    const updated = devices.filter((d) => d.id !== id);
    setDevices(updated);
    saveDevices(updated);
  }

  function addDevice(d: MdmDevice) {
    const updated = [...devices, d];
    setDevices(updated);
    saveDevices(updated);
  }

  const stats = {
    total: devices.length,
    compliant: devices.filter((d) => d.compliance === "compliant").length,
    nonCompliant: devices.filter((d) => d.compliance === "non_compliant")
      .length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="h-6 w-6 text-primary" />
              Mobile Device Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enroll, monitor and manage mobile devices
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total devices</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-emerald-600">
                {stats.compliant}
              </p>
              <p className="text-xs text-muted-foreground">Compliant</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-destructive">
                {stats.nonCompliant}
              </p>
              <p className="text-xs text-muted-foreground">Non-compliant</p>
            </CardContent>
          </Card>
        </div>

        {/* Enrollment */}
        <EnrollmentPanel />

        {/* Device List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Enrolled Devices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Last check-in</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Smartphone className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold">
                          Aucun appareil
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                          Enrolez votre premier appareil mobile pour commencer
                          la gestion de flotte.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {devices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{d.name}</div>
                      {d.owner && (
                        <div className="text-xs text-muted-foreground">
                          {d.owner}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {osBadge(d.os)}{" "}
                      <span className="text-xs text-muted-foreground ml-1">
                        {d.osVersion}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {fmtRelative(d.lastCheckIn)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ComplianceBadge status={d.compliance} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Remote Lock"
                          onClick={() =>
                            setPendingAction({ device: d, action: "lock" })
                          }
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Install Profile"
                          onClick={() =>
                            setPendingAction({ device: d, action: "profile" })
                          }
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Remote Wipe"
                          onClick={() =>
                            setPendingAction({ device: d, action: "wipe" })
                          }
                          className="text-destructive hover:text-destructive"
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Remove"
                          onClick={() => removeDevice(d.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {pendingAction && (
        <ActionDialog
          device={pendingAction.device}
          action={pendingAction.action}
          onClose={() => setPendingAction(null)}
        />
      )}
      {showAdd && (
        <AddDeviceDialog onAdd={addDevice} onClose={() => setShowAdd(false)} />
      )}
    </AppLayout>
  );
}
