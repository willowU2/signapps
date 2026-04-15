"use client";

import { SpinnerInfinity } from "spinners-react";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Database, HardDrive } from "lucide-react";
import { raidApi, type DiskInfo } from "@/lib/api";

interface CreateArrayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    raid_level: string;
    disk_ids: string[];
  }) => Promise<void>;
}

const RAID_LEVELS = [
  {
    value: "raid0",
    label: "RAID 0 (Striping)",
    minDisks: 2,
    description: "Performance maximale, aucune redondance",
  },
  {
    value: "raid1",
    label: "RAID 1 (Mirroring)",
    minDisks: 2,
    description: "Mirroir complet, 50% de capacité",
  },
  {
    value: "raid5",
    label: "RAID 5 (Parity)",
    minDisks: 3,
    description: "Bon équilibre performance/sécurité",
  },
  {
    value: "raid6",
    label: "RAID 6 (Double Parity)",
    minDisks: 4,
    description: "Tolère 2 pannes de disque",
  },
  {
    value: "raid10",
    label: "RAID 10 (Stripe + Mirror)",
    minDisks: 4,
    description: "Performance + redondance",
  },
];

export function CreateArrayDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateArrayDialogProps) {
  const [name, setName] = useState("");
  const [raidLevel, setRaidLevel] = useState("");
  const [selectedDisks, setSelectedDisks] = useState<string[]>([]);
  const [availableDisks, setAvailableDisks] = useState<DiskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDisks, setLoadingDisks] = useState(false);
  const [error, setError] = useState("");

  const selectedLevel = RAID_LEVELS.find((l) => l.value === raidLevel);
  const canSubmit =
    name.trim() &&
    raidLevel &&
    selectedLevel &&
    selectedDisks.length >= selectedLevel.minDisks;

  const loadDisks = async () => {
    setLoadingDisks(true);
    try {
      const response = await raidApi.listDisks();
      // Filter out disks already in an array
      const available = response.data.filter(
        (d) => !d.array_id && d.status !== "failed",
      );
      setAvailableDisks(available);
    } catch {
      // ignore
    } finally {
      setLoadingDisks(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      loadDisks();
    } else {
      setName("");
      setRaidLevel("");
      setSelectedDisks([]);
      setError("");
    }
    onOpenChange(newOpen);
  };

  const toggleDisk = (diskId: string) => {
    setSelectedDisks((prev) =>
      prev.includes(diskId)
        ? prev.filter((id) => id !== diskId)
        : [...prev, diskId],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError("");
    try {
      await onSubmit({
        name: name.trim(),
        raid_level: raidLevel,
        disk_ids: selectedDisks,
      });
      handleOpenChange(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(0)} GB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Créer un Array RAID
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nom de l'array</Label>
            <Input
              id="name"
              placeholder="md0"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* RAID Level */}
          <div className="space-y-2">
            <Label>Niveau RAID</Label>
            <Select value={raidLevel} onValueChange={setRaidLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un niveau" />
              </SelectTrigger>
              <SelectContent>
                {RAID_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <div>
                      <span className="font-medium">{level.label}</span>
                      <p className="text-xs text-muted-foreground">
                        {level.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLevel && (
              <p className="text-sm text-muted-foreground">
                Minimum {selectedLevel.minDisks} disques requis
              </p>
            )}
          </div>

          {/* Disk Selection */}
          <div className="space-y-2">
            <Label>
              Disques ({selectedDisks.length} sélectionné
              {selectedDisks.length > 1 ? "s" : ""})
            </Label>
            {loadingDisks ? (
              <div className="flex items-center justify-center py-8">
                <SpinnerInfinity
                  size={24}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="h-6 w-6 "
                />
              </div>
            ) : availableDisks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Aucun disque disponible
              </div>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border p-2">
                {availableDisks.map((disk) => (
                  <label
                    key={disk.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedDisks.includes(disk.id)}
                      onCheckedChange={() => toggleDisk(disk.id)}
                    />
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <span className="font-medium">{disk.device_path}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {disk.model || "Unknown"} -{" "}
                        {formatBytes(disk.size_bytes)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
            {loading && (
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="mr-2 h-4 w-4 "
              />
            )}
            Créer l'Array
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
