"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Folder, Check } from "lucide-react";
import { toast } from "sonner";

export interface OCRResult {
  fileId: string;
  fileName: string;
  status: "pending" | "processing" | "completed" | "failed";
  extractedText?: string;
  confidence?: number;
  error?: string;
}

export interface OCRBatchProps {
  folderPath?: string;
  fileCount?: number;
  onStartOCR?: (folderPath: string) => Promise<OCRResult[]>;
  onFolderSelect?: () => Promise<string | null>;
}

export function OCRBatch({
  folderPath: initialFolderPath,
  fileCount: initialFileCount = 0,
  onStartOCR,
  onFolderSelect,
}: OCRBatchProps) {
  const [folderPath, setFolderPath] = useState(initialFolderPath || "");
  const [fileCount, setFileCount] = useState(initialFileCount);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OCRResult[]>([]);
  const [expandedResults, setExpandedResults] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    if (!onFolderSelect) {
      toast.error("Sélection de dossier non disponible");
      return;
    }

    try {
      const selected = await onFolderSelect();
      if (selected) {
        setFolderPath(selected);
        // Extract file count from the selected folder path
        // This is a placeholder - actual implementation would query the backend
        setFileCount(Math.floor(Math.random() * 50) + 1);
        setResults([]);
        setProgress(0);
      }
    } catch (error) {
      toast.error("Erreur lors de la sélection du dossier");
    }
  };

  const handleStartOCR = async () => {
    if (!folderPath) {
      toast.error("Veuillez sélectionner un dossier");
      return;
    }

    if (!onStartOCR) {
      toast.error("OCR non disponible");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 20;
        });
      }, 200);

      const ocrResults = await onStartOCR(folderPath);
      clearInterval(progressInterval);

      setResults(ocrResults);
      setProgress(100);

      const successCount = ocrResults.filter((r) => r.status === "completed").length;
      const failedCount = ocrResults.filter((r) => r.status === "failed").length;

      toast.success(
        `OCR terminé: ${successCount} fichiers traités, ${failedCount} erreurs`
      );
    } catch (error) {
      toast.error("Erreur lors du traitement OCR");
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Traitement OCR par lot</h3>
        <p className="text-sm text-gray-600">Extrayez le texte de plusieurs fichiers à la fois</p>
      </div>

      {/* Folder Selection */}
      <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <Folder className="w-5 h-5 text-gray-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Dossier sélectionné</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {folderPath || "Aucun dossier sélectionné"}
            </p>
          </div>
        </div>

        <Button
          onClick={handleSelectFolder}
          disabled={isProcessing}
          variant="outline"
          className="w-full"
        >
          📁 Parcourir et sélectionner
        </Button>
      </div>

      {/* File Count Info */}
      {folderPath && fileCount > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            <span className="font-semibold">{fileCount}</span> fichier(s) détecté(s) dans le dossier
          </p>
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-gray-700">Progression</p>
            <p className="text-sm font-semibold text-gray-600">{Math.round(progress)}%</p>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Start Button */}
      <Button
        onClick={handleStartOCR}
        disabled={isProcessing || !folderPath}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {isProcessing ? "Traitement en cours..." : "▶ Démarrer OCR"}
      </Button>

      {/* Results List */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Résultats</h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {results.map((result) => (
              <div
                key={result.fileId}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  result.status === "completed"
                    ? "bg-green-50 border-green-200 hover:bg-green-100"
                    : result.status === "failed"
                    ? "bg-red-50 border-red-200 hover:bg-red-100"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                }`}
                onClick={() =>
                  setExpandedResults(
                    expandedResults === result.fileId ? null : result.fileId
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <FileText className="w-4 h-4 text-gray-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {result.fileName}
                      </p>
                      {result.status === "completed" && result.confidence && (
                        <p className="text-xs text-gray-500">
                          Confiance: {Math.round(result.confidence * 100)}%
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {result.status === "completed" && (
                      <Check className="w-4 h-4 text-green-600" />
                    )}
                    {result.status === "failed" && (
                      <span className="text-xs font-semibold text-red-600">Erreur</span>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedResults === result.fileId && result.extractedText && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs font-semibold text-gray-600 mb-2">
                      Texte extrait:
                    </p>
                    <div className="bg-white p-2 rounded border border-gray-300 text-xs text-gray-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {result.extractedText.substring(0, 300)}
                      {result.extractedText.length > 300 && "..."}
                    </div>
                  </div>
                )}

                {expandedResults === result.fileId && result.error && (
                  <div className="mt-3 pt-3 border-t border-red-300">
                    <p className="text-xs text-red-700">{result.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
