"use client";

import { SpinnerInfinity } from "spinners-react";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, FileCode, Box, Network, HardDrive, Eye } from "lucide-react";
import { composeApi, ComposeServicePreview } from "@/lib/api";
import { toast } from "sonner";

interface ComposeImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ComposeImportSheet({
  open,
  onOpenChange,
  onSuccess,
}: ComposeImportSheetProps) {
  const [yaml, setYaml] = useState("");
  const [autoStart, setAutoStart] = useState(true);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ComposeServicePreview[] | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setYaml(content);
      setPreview(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!yaml.trim()) return;
    setPreviewing(true);
    try {
      const res = await composeApi.preview(yaml);
      setPreview(res.data.services);
    } catch {
      toast.error("Erreur lors du parsing du fichier compose");
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!yaml.trim()) return;
    setLoading(true);
    try {
      const res = await composeApi.import(yaml, autoStart);
      const count = res.data.length;
      toast.success(`${count} container(s) importe(s) avec succes`);
      onSuccess();
      onOpenChange(false);
      setYaml("");
      setPreview(null);
    } catch {
      toast.error("Erreur lors de l'import du compose");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setYaml("");
      setPreview(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="overflow-y-auto sm:max-w-xl w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Importer un Docker Compose
          </SheetTitle>
          <SheetDescription>
            Deploy multiple services simultaneously directly from a
            docker-compose.yml file.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* File upload */}
          <div className="space-y-3">
            <Label>Fichier docker-compose.yml</Label>
            <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Glisser un fichier ou cliquer pour parcourir
              </span>
              <input
                type="file"
                accept=".yml,.yaml,.json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* YAML textarea */}
          <div className="space-y-3">
            <Label>Ou collez le contenu YAML</Label>
            <textarea
              className="w-full h-48 rounded-lg border p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={`version: '3'\nservices:\n  app:\n    image: nginx:latest\n    ports:\n      - "8080:80"`}
              value={yaml}
              onChange={(e) => {
                setYaml(e.target.value);
                setPreview(null);
              }}
            />
          </div>

          {/* Options */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Demarrer automatiquement</Label>
              <p className="text-xs text-muted-foreground">
                Lancer les containers apres creation
              </p>
            </div>
            <Switch checked={autoStart} onCheckedChange={setAutoStart} />
          </div>

          {/* Preview button */}
          {!preview && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handlePreview}
              disabled={!yaml.trim() || previewing}
            >
              {previewing ? (
                <SpinnerInfinity
                  size={24}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="h-4 w-4 "
                />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Apercu des services
            </Button>
          )}

          {/* Preview results */}
          {preview && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Services detectes</Label>
                  <Badge variant="secondary">{preview.length} service(s)</Badge>
                </div>
                {preview.map((svc: ComposeServicePreview) => (
                  <div
                    key={svc.service_name}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-primary" />
                      <span className="font-medium">{svc.service_name}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {svc.image}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {svc.ports.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Network className="h-3 w-3" />
                          {svc.ports
                            .map((p) => `${p.host}:${p.container}`)
                            .join(", ")}
                        </span>
                      )}
                      {svc.volumes.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <HardDrive className="h-3 w-3" />
                          {svc.volumes.length} volume(s)
                        </span>
                      )}
                      {svc.environment.length > 0 && (
                        <span>{svc.environment.length} variable(s) env</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={loading || !yaml.trim()}
            className="gap-2"
          >
            {loading && (
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-4 w-4 "
              />
            )}
            Importer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
