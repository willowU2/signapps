"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SignaturePad } from "./signature-pad";
import { toast } from "sonner";

export interface Signataire {
  id: string;
  name: string;
  email: string;
  status: "pending" | "signed";
  signatureBase64?: string;
  signedAt?: string;
}

interface SignDocumentProps {
  documentName: string;
  signataires: Signataire[];
  onSignatureSubmit: (
    signataireId: string,
    signatureBase64: string,
  ) => Promise<void>;
  currentSignataireId?: string;
}

export function SignDocument({
  documentName,
  signataires,
  onSignatureSubmit,
  currentSignataireId,
}: SignDocumentProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSignataireId, setSelectedSignataireId] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSignataire =
    signataires.find((s) => s.id === selectedSignataireId) ||
    (currentSignataireId
      ? signataires.find((s) => s.id === currentSignataireId)
      : signataires.find((s) => s.status === "pending"));

  const handleSignClick = (signataireId: string) => {
    setSelectedSignataireId(signataireId);
    setDialogOpen(true);
  };

  const handleSignatureAccepted = async (signatureBase64: string) => {
    if (!selectedSignataireId) return;

    setIsSubmitting(true);
    try {
      await onSignatureSubmit(selectedSignataireId, signatureBase64);
      toast.success("Signature enregistrée avec succès");
      setDialogOpen(false);
      setSelectedSignataireId(null);
    } catch (error) {
      console.error("Erreur lors de la soumission de la signature:", error);
      toast.error("Erreur lors de la sauvegarde de la signature");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setSelectedSignataireId(null);
  };

  const statusBadgeVariant = (status: "pending" | "signed") => {
    return status === "signed" ? "default" : "outline";
  };

  const statusLabel = (status: "pending" | "signed") => {
    return status === "signed" ? "Signé" : "En attente";
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="border rounded-lg p-6 bg-card shadow-sm">
        {/* Document Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">{documentName}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Signature électronique
          </p>
        </div>

        {/* Signataires List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Signataires
          </h3>
          <div className="space-y-2">
            {signataires.map((signataire) => (
              <div
                key={signataire.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-muted hover:bg-muted transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {signataire.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {signataire.email}
                  </p>
                  {signataire.signedAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Signé le{" "}
                      {new Date(signataire.signedAt).toLocaleDateString(
                        "fr-FR",
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={statusBadgeVariant(signataire.status)}>
                    {statusLabel(signataire.status)}
                  </Badge>

                  {signataire.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => handleSignClick(signataire.id)}
                      disabled={isSubmitting}
                    >
                      Signer
                    </Button>
                  )}

                  {signataire.status === "signed" &&
                    signataire.signatureBase64 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = signataire.signatureBase64!;
                          link.download = `signature_${signataire.id}.png`;
                          link.click();
                        }}
                      >
                        Télécharger
                      </Button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signature Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signer le document</DialogTitle>
          </DialogHeader>

          {selectedSignataire && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                <span className="font-semibold">{selectedSignataire.name}</span>
                , veuillez signer ci-dessous :
              </p>
              <SignaturePad
                onSignature={handleSignatureAccepted}
                onCancel={handleCancel}
              />
            </div>
          )}

          <DialogFooter className="hidden">
            {/* Footer handled by SignaturePad component */}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
