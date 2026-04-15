"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  backupsApi,
  containersApi,
  BackupProfile,
  CreateBackupProfileRequest,
} from "@/lib/api";
import { toast } from "sonner";

interface BackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: BackupProfile | null;
}

export function BackupDialog({
  open,
  onOpenChange,
  profile,
}: BackupDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!profile;

  const [name, setName] = useState("");
  const [destinationType, setDestinationType] = useState("local");
  const [schedule, setSchedule] = useState("");
  const [password, setPassword] = useState("");
  const [selectedContainers, setSelectedContainers] = useState<string[]>([]);

  // Destination config fields
  const [localPath, setLocalPath] = useState("/var/backups/signapps");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [sftpHost, setSftpHost] = useState("");
  const [sftpUser, setSftpUser] = useState("");
  const [sftpPath, setSftpPath] = useState("");

  // Retention
  const [keepLast, setKeepLast] = useState("5");
  const [keepDaily, setKeepDaily] = useState("7");
  const [keepWeekly, setKeepWeekly] = useState("4");

  const { data: containers = [] } = useQuery({
    queryKey: ["containers-for-backup"],
    queryFn: async () => {
      const res = await containersApi.list();
      return res.data || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDestinationType(profile.destination_type);
      setSchedule(profile.schedule || "");
      setSelectedContainers(profile.container_ids);
      const dc = profile.destination_config;
      if (profile.destination_type === "local") {
        setLocalPath((dc.path as string) || "/var/backups/signapps");
      } else if (profile.destination_type === "s3") {
        setS3Endpoint((dc.endpoint as string) || "");
        setS3Bucket((dc.bucket as string) || "");
        setS3AccessKey((dc.access_key as string) || "");
        setS3SecretKey((dc.secret_key as string) || "");
      } else if (profile.destination_type === "sftp") {
        setSftpHost((dc.host as string) || "");
        setSftpUser((dc.user as string) || "");
        setSftpPath((dc.path as string) || "");
      }
      const rp = profile.retention_policy;
      if (rp) {
        setKeepLast(String(rp.keep_last || 5));
        setKeepDaily(String(rp.keep_daily || 7));
        setKeepWeekly(String(rp.keep_weekly || 4));
      }
    } else {
      setName("");
      setDestinationType("local");
      setSchedule("");
      setPassword("");
      setSelectedContainers([]);
      setLocalPath("/var/backups/signapps");
    }
  }, [profile, open]);

  const createMutation = useMutation({
    mutationFn: (data: CreateBackupProfileRequest) => backupsApi.create(data),
    onSuccess: () => {
      toast.success("Backup profile created");
      queryClient.invalidateQueries({ queryKey: ["backup-profiles"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Impossible de créer backup profile"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<BackupProfile>) =>
      backupsApi.update(profile!.id, data),
    onSuccess: () => {
      toast.success("Backup profile updated");
      queryClient.invalidateQueries({ queryKey: ["backup-profiles"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Impossible de mettre à jour backup profile"),
  });

  const buildDestinationConfig = () => {
    switch (destinationType) {
      case "s3":
        return {
          endpoint: s3Endpoint,
          bucket: s3Bucket,
          access_key: s3AccessKey,
          secret_key: s3SecretKey,
        };
      case "sftp":
        return { host: sftpHost, user: sftpUser, path: sftpPath };
      default:
        return { path: localPath };
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || selectedContainers.length === 0) return;

    const destinationConfig = buildDestinationConfig();
    const retentionPolicy = {
      keep_last: parseInt(keepLast) || undefined,
      keep_daily: parseInt(keepDaily) || undefined,
      keep_weekly: parseInt(keepWeekly) || undefined,
    };

    if (isEdit) {
      updateMutation.mutate({
        name,
        container_ids: selectedContainers,
        schedule: schedule || undefined,
        destination_type: destinationType,
        destination_config: destinationConfig,
        retention_policy: retentionPolicy,
      } as Partial<BackupProfile>);
    } else {
      if (!password.trim()) {
        toast.error("Password is required");
        return;
      }
      createMutation.mutate({
        name,
        container_ids: selectedContainers,
        schedule: schedule || undefined,
        destination_type: destinationType,
        destination_config: destinationConfig,
        retention_policy: retentionPolicy,
        password,
      });
    }
  };

  const toggleContainer = (id: string) => {
    setSelectedContainers((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const loading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Backup Profile" : "New Backup Profile"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              placeholder="My Backup"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label>Schedule (optional)</Label>
            <Input
              placeholder="every 6h, every 24h, every 1d"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Examples: every 6h, every 24h, every 1d
            </p>
          </div>

          <div>
            <Label>Destination</Label>
            <Select value={destinationType} onValueChange={setDestinationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="s3">S3 / MinIO</SelectItem>
                <SelectItem value="sftp">SFTP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {destinationType === "local" && (
            <div>
              <Label>Path</Label>
              <Input
                placeholder="/var/backups/signapps"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
              />
            </div>
          )}

          {destinationType === "s3" && (
            <div className="space-y-2">
              <div>
                <Label>Endpoint</Label>
                <Input
                  placeholder="http://localhost:9000"
                  value={s3Endpoint}
                  onChange={(e) => setS3Endpoint(e.target.value)}
                />
              </div>
              <div>
                <Label>Bucket</Label>
                <Input
                  placeholder="backups"
                  value={s3Bucket}
                  onChange={(e) => setS3Bucket(e.target.value)}
                />
              </div>
              <div>
                <Label>Access Key</Label>
                <Input
                  value={s3AccessKey}
                  onChange={(e) => setS3AccessKey(e.target.value)}
                />
              </div>
              <div>
                <Label>Secret Key</Label>
                <Input
                  type="password"
                  value={s3SecretKey}
                  onChange={(e) => setS3SecretKey(e.target.value)}
                />
              </div>
            </div>
          )}

          {destinationType === "sftp" && (
            <div className="space-y-2">
              <div>
                <Label>Host</Label>
                <Input
                  placeholder="backup.example.com"
                  value={sftpHost}
                  onChange={(e) => setSftpHost(e.target.value)}
                />
              </div>
              <div>
                <Label>User</Label>
                <Input
                  placeholder="backup"
                  value={sftpUser}
                  onChange={(e) => setSftpUser(e.target.value)}
                />
              </div>
              <div>
                <Label>Remote Path</Label>
                <Input
                  placeholder="/backups"
                  value={sftpPath}
                  onChange={(e) => setSftpPath(e.target.value)}
                />
              </div>
            </div>
          )}

          {!isEdit && (
            <div>
              <Label>Encryption Password</Label>
              <Input
                type="password"
                placeholder="Strong password for backup encryption"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used to encrypt backups. Keep it safe — lost password means lost
                data.
              </p>
            </div>
          )}

          <div>
            <Label>Retention Policy</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div>
                <Label className="text-xs">Keep last</Label>
                <Input
                  type="number"
                  value={keepLast}
                  onChange={(e) => setKeepLast(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Keep daily</Label>
                <Input
                  type="number"
                  value={keepDaily}
                  onChange={(e) => setKeepDaily(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Keep weekly</Label>
                <Input
                  type="number"
                  value={keepWeekly}
                  onChange={(e) => setKeepWeekly(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Containers to Backup</Label>
            <div className="mt-1 max-h-40 overflow-y-auto space-y-1 rounded border p-2">
              {containers.map((c: { id: string; name: string }) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 cursor-pointer rounded p-1 hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={selectedContainers.includes(c.id)}
                    onChange={() => toggleContainer(c.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
              {containers.length === 0 && (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  No containers found
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading || !name.trim() || selectedContainers.length === 0
            }
          >
            {loading ? "Enregistrement..." : isEdit ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
