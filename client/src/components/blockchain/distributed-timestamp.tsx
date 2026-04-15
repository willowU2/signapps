"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  FileText,
  CheckCircle2,
  Clock4,
  RotateCw,
  Download,
} from "lucide-react";

interface TimestampFile {
  id: string;
  filename: string;
  timestamp: Date;
  status: "anchored" | "pending";
  hash: string;
  proofUrl?: string;
}

interface DistributedTimestampProps {
  files: TimestampFile[];
  onVerify?: (fileId: string) => Promise<void>;
  onDownloadProof?: (fileId: string) => Promise<void>;
}

export const DistributedTimestamp: React.FC<DistributedTimestampProps> = ({
  files,
  onVerify,
  onDownloadProof,
}) => {
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleVerify = async (file: TimestampFile) => {
    setVerifyingId(file.id);
    try {
      if (onVerify) {
        await onVerify(file.id);
      }
      // Default: open verification
      window.open(
        `https://www.proof.bnktrust.com/?file_hash=${file.hash}`,
        "_blank",
      );
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDownloadProof = async (file: TimestampFile) => {
    setDownloadingId(file.id);
    try {
      if (onDownloadProof) {
        await onDownloadProof(file.id);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: TimestampFile["status"]) => {
    if (status === "anchored") {
      return (
        <Badge
          variant="default"
          className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
        >
          <CheckCircle2 className="size-3" />
          Ancré
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock4 className="size-3" />
        En attente
      </Badge>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "À l'instant";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Il y a ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Horodatage Distribué
            </CardTitle>
            <CardDescription>
              Fichiers avec preuve de temps et intégrité
            </CardDescription>
          </div>
          <Badge variant="outline">{files.length} fichiers</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun fichier avec horodatage trouvé
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div
                  className="p-3 cursor-pointer flex items-start gap-3"
                  onClick={() =>
                    setExpandedId(expandedId === file.id ? null : file.id)
                  }
                >
                  <FileText className="size-4 flex-shrink-0 mt-1 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm break-all">
                        {file.filename}
                      </span>
                      {getStatusBadge(file.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getRelativeTime(file.timestamp)} •{" "}
                      {file.timestamp.toLocaleString("fr-FR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === file.id && (
                  <div className="border-t bg-muted/30 p-3 space-y-3 text-xs">
                    <div>
                      <p className="text-muted-foreground font-medium mb-1">
                        Hash du fichier
                      </p>
                      <code className="bg-background rounded px-2 py-1.5 block break-all text-muted-foreground font-mono">
                        {file.hash}
                      </code>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-background rounded border">
                      <Clock className="size-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        Horodatage: {file.timestamp.toISOString()}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleVerify(file)}
                        disabled={verifyingId === file.id}
                      >
                        {verifyingId === file.id ? (
                          <>
                            <RotateCw className="size-3 animate-spin" />
                            Vérification...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-3" />
                            Vérifier
                          </>
                        )}
                      </Button>
                      {file.proofUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDownloadProof(file)}
                          disabled={downloadingId === file.id}
                        >
                          {downloadingId === file.id ? (
                            <>
                              <RotateCw className="size-3 animate-spin" />
                              Téléchargement...
                            </>
                          ) : (
                            <>
                              <Download className="size-3" />
                              Preuve
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {files.filter((f) => f.status === "anchored").length} ancré·s /{" "}
              {files.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {(
                (files.filter((f) => f.status === "anchored").length /
                  files.length) *
                100
              ).toFixed(0)}
              % de conformité
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
