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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Share2 } from "lucide-react";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    bucket: string;
    key: string;
    expires_in_hours?: number;
    password?: string;
    max_downloads?: number;
    access_type?: "view" | "download";
  }) => Promise<void>;
  initialBucket?: string;
  initialKey?: string;
}

const EXPIRATION_OPTIONS = [
  { value: "1", label: "1 heure" },
  { value: "24", label: "24 heures" },
  { value: "168", label: "7 jours" },
  { value: "720", label: "30 jours" },
  { value: "0", label: "Jamais" },
];

export function ShareDialog({
  open,
  onOpenChange,
  onSubmit,
  initialBucket = "",
  initialKey = "",
}: ShareDialogProps) {
  const [bucket, setBucket] = useState(initialBucket);
  const [key, setKey] = useState(initialKey);
  const [expiresIn, setExpiresIn] = useState("168");
  const [accessType, setAccessType] = useState<"view" | "download">("download");
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setBucket(initialBucket);
      setKey(initialKey);
      setExpiresIn("168");
      setAccessType("download");
      setUsePassword(false);
      setPassword("");
      setMaxDownloads("");
      setError("");
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!bucket.trim() || !key.trim()) {
      setError("Le bucket et le chemin sont requis");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit({
        bucket: bucket.trim(),
        key: key.trim(),
        expires_in_hours: expiresIn === "0" ? undefined : parseInt(expiresIn),
        password: usePassword && password ? password : undefined,
        max_downloads: maxDownloads ? parseInt(maxDownloads) : undefined,
        access_type: accessType,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Créer un lien de partage
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Bucket */}
          <div className="space-y-2">
            <Label htmlFor="bucket">Bucket</Label>
            <Input
              id="bucket"
              placeholder="documents"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
            />
          </div>

          {/* Key/Path */}
          <div className="space-y-2">
            <Label htmlFor="key">Chemin du fichier</Label>
            <Input
              id="key"
              placeholder="path/to/file.pdf"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>

          {/* Access Type */}
          <div className="space-y-2">
            <Label>Type d'accès</Label>
            <Select
              value={accessType}
              onValueChange={(v: "view" | "download") => setAccessType(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Visualisation uniquement</SelectItem>
                <SelectItem value="download">Téléchargement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label>Expiration</Label>
            <Select value={expiresIn} onValueChange={setExpiresIn}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Password Protection */}
          <div className="flex items-center justify-between">
            <Label htmlFor="use-password">Protection par mot de passe</Label>
            <Switch
              id="use-password"
              checked={usePassword}
              onCheckedChange={setUsePassword}
            />
          </div>
          {usePassword && (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {/* Max Downloads */}
          <div className="space-y-2">
            <Label htmlFor="max-downloads">
              Limite de téléchargements (optionnel)
            </Label>
            <Input
              id="max-downloads"
              type="number"
              min="1"
              placeholder="Illimité"
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && (
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="mr-2 h-4 w-4 "
              />
            )}
            Créer le lien
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
