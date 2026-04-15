"use client";

import { useEffect, useState } from "react";
import { Copy, HardDrive, Monitor, Apple, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { webdavApi } from "@/lib/api/storage";

interface WebDavConfig {
  enabled: boolean;
  url: string;
}

interface OsInstructionProps {
  icon: React.ReactNode;
  title: string;
  command: string;
}

function OsInstruction({ icon, title, command }: OsInstructionProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      toast.success("Command copied to clipboard");
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
        <code className="flex-1 text-xs font-mono text-muted-foreground break-all">
          {command}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleCopy}
          title="Copy command"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function WebDavConfig() {
  const [config, setConfig] = useState<WebDavConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    webdavApi
      .getConfig()
      .then((res) => setConfig(res.data as WebDavConfig))
      .catch(() => {
        // Fallback defaults if backend not yet running
        setConfig({ enabled: true, url: "http://localhost:3004/webdav/" });
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleEnabled = async (value: boolean) => {
    setSaving(true);
    try {
      const res = await webdavApi.updateConfig({ enabled: value });
      setConfig((prev) =>
        prev ? { ...prev, enabled: (res.data as WebDavConfig).enabled } : prev,
      );
      toast.success(value ? "WebDAV access enabled" : "WebDAV access disabled");
    } catch {
      toast.error("Failed to update WebDAV configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = () => {
    if (config?.url) {
      navigator.clipboard.writeText(config.url).then(() => {
        toast.success("WebDAV URL copied to clipboard");
      });
    }
  };

  const webdavUrl = config?.url ?? "http://localhost:3004/webdav/";

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">WebDAV Access</CardTitle>
                <CardDescription className="text-sm">
                  Mount the Drive as a network folder from any OS
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!loading && (
                <Badge variant={config?.enabled ? "default" : "secondary"}>
                  {config?.enabled ? "Enabled" : "Disabled"}
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="webdav-enabled"
                  checked={config?.enabled ?? true}
                  onCheckedChange={toggleEnabled}
                  disabled={loading || saving}
                />
                <Label htmlFor="webdav-enabled" className="text-sm">
                  {saving ? "Saving..." : "Global toggle"}
                </Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">
              WebDAV URL
            </p>
            <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
              <code className="flex-1 text-sm font-mono">{webdavUrl}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopyUrl}
                title="Copy URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Authenticate with your SignApps username and password (Basic
              Auth).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Per-OS instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Instructions</CardTitle>
          <CardDescription>
            How to mount the Drive as a network folder on each operating system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <OsInstruction
            icon={<Monitor className="h-4 w-4 text-blue-500" />}
            title="Windows — map a network drive (Command Prompt)"
            command={`net use Z: ${webdavUrl} /user:your_username`}
          />

          <OsInstruction
            icon={<Monitor className="h-4 w-4 text-blue-500" />}
            title="Windows — PowerShell"
            command={`New-PSDrive -Name Z -PSProvider FileSystem -Root ${webdavUrl} -Credential (Get-Credential)`}
          />

          <OsInstruction
            icon={<Apple className="h-4 w-4 text-gray-500" />}
            title="macOS — Finder"
            command={`open "${webdavUrl}"`}
          />

          <div className="text-sm text-muted-foreground rounded-md bg-muted/50 border px-4 py-3">
            <p className="font-medium mb-1">macOS — Finder (manual)</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>
                Open Finder and press{" "}
                <kbd className="px-1 py-0.5 rounded border text-xs">
                  Cmd + K
                </kbd>
              </li>
              <li>
                Enter the server address:{" "}
                <code className="font-mono">{webdavUrl}</code>
              </li>
              <li>Click Connect, then enter your credentials</li>
            </ol>
          </div>

          <OsInstruction
            icon={<Terminal className="h-4 w-4 text-green-500" />}
            title="Linux — davfs2"
            command={`sudo mount -t davfs ${webdavUrl} /mnt/signapps-drive`}
          />

          <OsInstruction
            icon={<Terminal className="h-4 w-4 text-green-500" />}
            title="Linux — rclone"
            command={`rclone copy signapps-drive: ./local-backup --webdav-url ${webdavUrl} --webdav-user your_username`}
          />

          <div className="text-sm text-muted-foreground rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3">
            <p className="font-medium text-amber-600 dark:text-amber-400 mb-1">
              Security note
            </p>
            <p className="text-xs">
              WebDAV uses HTTP Basic Auth which transmits credentials in base64
              encoding. For production use, ensure the service is behind HTTPS
              (via the Proxy module) to protect credentials in transit.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
