"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Lock, Unlock, RefreshCw, Shield, Search } from "lucide-react";

interface LockedAccount {
  id: string;
  username: string;
  email: string;
  locked_at: string;
  attempt_count: number;
  unlock_at: string;
  ip: string;
}

const SAMPLE: LockedAccount[] = [
  {
    id: "1",
    username: "jdupont",
    email: "jdupont@corp.local",
    locked_at: new Date(Date.now() - 600000).toISOString(),
    attempt_count: 8,
    unlock_at: new Date(Date.now() + 1800000).toISOString(),
    ip: "192.168.1.55",
  },
  {
    id: "2",
    username: "mmartin",
    email: "mmartin@corp.local",
    locked_at: new Date(Date.now() - 3600000).toISOString(),
    attempt_count: 12,
    unlock_at: new Date(Date.now() - 600000).toISOString(),
    ip: "10.0.2.77",
  },
  {
    id: "3",
    username: "service_bot",
    email: "bot@unknown.com",
    locked_at: new Date(Date.now() - 7200000).toISOString(),
    attempt_count: 50,
    unlock_at: new Date(Date.now() + 86400000).toISOString(),
    ip: "45.33.22.11",
  },
];

export function BruteForceDashboard() {
  const [accounts, setAccounts] = useState<LockedAccount[]>(SAMPLE);
  const [search, setSearch] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("5");
  const [lockDuration, setLockDuration] = useState("30");
  const [autoUnlock, setAutoUnlock] = useState(true);

  const unlock = (id: string) => {
    setAccounts((as) => as.filter((a) => a.id !== id));
    toast.success("Account unlocked");
  };

  const unlockAll = () => {
    setAccounts([]);
    toast.success("All accounts unlocked");
  };

  const filtered = accounts.filter(
    (a) =>
      !search ||
      a.username.includes(search) ||
      a.email.includes(search) ||
      a.ip.includes(search),
  );

  const isStillLocked = (a: LockedAccount) =>
    new Date(a.unlock_at) > new Date();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Brute Force Protection Settings
          </CardTitle>
          <CardDescription>
            Configure lockout policy for failed login attempts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Max Failed Attempts</Label>
              <Input
                type="number"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                min="1"
                max="20"
              />
              <p className="text-xs text-muted-foreground">
                Before account is locked
              </p>
            </div>
            <div className="space-y-2">
              <Label>Lockout Duration (minutes)</Label>
              <Input
                type="number"
                value={lockDuration}
                onChange={(e) => setLockDuration(e.target.value)}
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                0 = permanent until manual unlock
              </p>
            </div>
            <div className="space-y-2">
              <Label>Auto-unlock after duration</Label>
              <div className="flex items-center gap-2 mt-2">
                <Switch checked={autoUnlock} onCheckedChange={setAutoUnlock} />
                <span className="text-sm">
                  {autoUnlock ? "Enabled" : "Manual unlock required"}
                </span>
              </div>
            </div>
          </div>
          <Button onClick={() => toast.success("Brute force settings saved")}>
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" /> Locked Accounts
                <Badge variant="destructive">{accounts.length}</Badge>
              </CardTitle>
              <CardDescription>
                Accounts currently locked due to too many failed attempts
              </CardDescription>
            </div>
            {accounts.length > 0 && (
              <Button variant="outline" size="sm" onClick={unlockAll}>
                <Unlock className="mr-2 h-4 w-4" /> Unlock All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filter by username, email or IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between border rounded-lg p-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isStillLocked(a) ? "bg-red-100" : "bg-yellow-100"}`}
                  >
                    <Lock
                      className={`h-4 w-4 ${isStillLocked(a) ? "text-red-600" : "text-yellow-600"}`}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{a.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.email} · {a.ip}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {a.attempt_count} attempts
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Locked {new Date(a.locked_at).toLocaleString()}
                      </span>
                      {isStillLocked(a) ? (
                        <Badge variant="destructive" className="text-xs">
                          Unlocks {new Date(a.unlock_at).toLocaleTimeString()}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Lockout expired
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unlock(a.id)}
                >
                  <Unlock className="mr-1 h-3 w-3" /> Unlock
                </Button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>
                  {accounts.length === 0
                    ? "No locked accounts"
                    : "No results for this filter"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
