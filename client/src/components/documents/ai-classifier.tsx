"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export interface AICategory {
  id: string;
  name: string;
  confidence: number;
}

export interface ClassifiedFile {
  fileId: string;
  fileName: string;
  suggestedCategories: AICategory[];
  accepted: boolean;
  selectedCategoryId?: string;
}

export interface AIClassifierProps {
  files: ClassifiedFile[];
  onAcceptAll?: (files: ClassifiedFile[]) => Promise<void>;
  onAcceptCategory?: (fileId: string, categoryId: string) => Promise<void>;
  onRejectCategory?: (fileId: string) => Promise<void>;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const color =
    percentage >= 80
      ? "bg-green-500"
      : percentage >= 60
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-muted-foreground w-10 text-right">
        {percentage}%
      </span>
    </div>
  );
}

export function AIClassifier({
  files,
  onAcceptAll,
  onAcceptCategory,
  onRejectCategory,
}: AIClassifierProps) {
  const [localFiles, setLocalFiles] = useState(files);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const [processingFileId, setProcessingFileId] = useState<string | null>(null);

  const acceptedCount = localFiles.filter((f) => f.accepted).length;
  const totalFiles = localFiles.length;

  const handleAcceptAll = async () => {
    if (!onAcceptAll) {
      toast.error("Action non disponible");
      return;
    }

    setIsAcceptingAll(true);
    try {
      const filesToAccept = localFiles.map((f) => ({
        ...f,
        accepted: true,
        selectedCategoryId: f.suggestedCategories[0]?.id,
      }));

      await onAcceptAll(filesToAccept);

      setLocalFiles(filesToAccept);
      toast.success(`${filesToAccept.length} fichiers acceptés et classifiés`);
    } catch (error) {
      toast.error("Erreur lors de l'acceptation des fichiers");
    } finally {
      setIsAcceptingAll(false);
    }
  };

  const handleAcceptCategory = async (fileId: string, categoryId: string) => {
    if (!onAcceptCategory) {
      toast.error("Action non disponible");
      return;
    }

    setProcessingFileId(fileId);
    try {
      await onAcceptCategory(fileId, categoryId);

      setLocalFiles((prev) =>
        prev.map((f) =>
          f.fileId === fileId
            ? { ...f, accepted: true, selectedCategoryId: categoryId }
            : f,
        ),
      );

      toast.success("Classification acceptée");
    } catch (error) {
      toast.error("Erreur lors de l'acceptation de la classification");
    } finally {
      setProcessingFileId(null);
    }
  };

  const handleRejectCategory = async (fileId: string) => {
    if (!onRejectCategory) {
      toast.error("Action non disponible");
      return;
    }

    setProcessingFileId(fileId);
    try {
      await onRejectCategory(fileId);

      setLocalFiles((prev) =>
        prev.map((f) =>
          f.fileId === fileId
            ? { ...f, accepted: false, selectedCategoryId: undefined }
            : f,
        ),
      );

      toast.success("Classification rejetée");
    } catch (error) {
      toast.error("Erreur lors du rejet de la classification");
    } finally {
      setProcessingFileId(null);
    }
  };

  if (localFiles.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Aucun fichier à classer</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">
            Classification IA par catégorie
          </h3>
          <p className="text-sm text-muted-foreground">
            {acceptedCount} sur {totalFiles} fichiers acceptés
          </p>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${(acceptedCount / totalFiles) * 100}%` }}
        />
      </div>

      {/* Accept All Button */}
      {acceptedCount < totalFiles && (
        <Button
          onClick={handleAcceptAll}
          disabled={isAcceptingAll}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isAcceptingAll ? "Acceptation..." : "✓ Accepter tous"}
        </Button>
      )}

      {/* Files List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {localFiles.map((file) => (
          <div
            key={file.fileId}
            className={`p-4 rounded-lg border transition-colors ${
              file.accepted
                ? "bg-green-50 border-green-200"
                : "bg-card border-border"
            }`}
          >
            {/* File Header */}
            <div className="flex items-start gap-3 mb-3">
              <FileText className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.fileName}
                </p>
                {file.accepted && (
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-700">Accepté</span>
                  </div>
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-2 pl-8">
              {file.suggestedCategories.map((category, idx) => (
                <div key={category.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={idx === 0 ? "default" : "outline"}
                      className={
                        idx === 0
                          ? "bg-blue-600"
                          : file.selectedCategoryId === category.id
                            ? "border-blue-600 text-blue-600"
                            : ""
                      }
                    >
                      {category.name}
                    </Badge>
                  </div>
                  <ConfidenceBar confidence={category.confidence} />
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            {!file.accepted && (
              <div className="flex gap-2 mt-4 pl-8">
                <Button
                  onClick={() =>
                    handleAcceptCategory(
                      file.fileId,
                      file.suggestedCategories[0]?.id,
                    )
                  }
                  disabled={processingFileId === file.fileId}
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {processingFileId === file.fileId ? "..." : "✓ Accepter"}
                </Button>
                <Button
                  onClick={() => handleRejectCategory(file.fileId)}
                  disabled={processingFileId === file.fileId}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  {processingFileId === file.fileId ? "..." : "✗ Rejeter"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {acceptedCount === totalFiles && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
          <p className="text-sm font-semibold text-green-700">
            ✓ Tous les fichiers ont été classifiés
          </p>
        </div>
      )}
    </Card>
  );
}
