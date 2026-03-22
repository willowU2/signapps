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
import { Check, Copy, Share2, Shield } from "lucide-react";

interface DiplomaProps {
  id: string;
  name: string;
  institution: string;
  issueDate: Date;
  nftHash: string;
  verified: boolean;
}

interface NFTDiplomasProps {
  diplomas: DiplomaProps[];
}

export const NFTDiplomas: React.FC<NFTDiplomasProps> = ({ diplomas }) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleShare = (diploma: DiplomaProps) => {
    const shareText = `Diplôme: ${diploma.name} de ${diploma.institution}\nHash NFT: ${diploma.nftHash}`;
    if (navigator.share) {
      navigator.share({
        title: "Diploma NFT",
        text: shareText,
      });
    } else {
      navigator.clipboard.writeText(shareText);
    }
  };

  const handleVerify = (hash: string) => {
    // Open verification in new tab or modal
    const verificationUrl = `https://etherscan.io/tx/${hash}`;
    window.open(verificationUrl, "_blank");
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Diplômes NFT</h2>
        <Badge variant="outline">{diplomas.length} diplômes</Badge>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {diplomas.map((diploma) => (
          <Card key={diploma.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <CardTitle className="text-base">{diploma.name}</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {diploma.institution}
                  </CardDescription>
                </div>
                {diploma.verified && (
                  <Shield className="size-5 text-green-600 flex-shrink-0" />
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-4">
              {/* Issue Date */}
              <div className="text-sm">
                <p className="text-muted-foreground">Émis le</p>
                <p className="font-medium">
                  {diploma.issueDate.toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              {/* NFT Hash Display */}
              <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground font-medium">
                  NFT Hash
                </p>
                <div className="flex items-center gap-2 break-all">
                  <code className="text-xs font-mono text-muted-foreground">
                    {diploma.nftHash.substring(0, 16)}...
                  </code>
                  <button
                    onClick={() => handleCopyHash(diploma.nftHash)}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    {copiedHash === diploma.nftHash ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Verification Status */}
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    diploma.verified
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                  }`}
                >
                  <Check className="size-3" />
                  {diploma.verified ? "Vérifié" : "En attente"}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleVerify(diploma.nftHash)}
                >
                  <Shield className="size-4" />
                  Vérifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleShare(diploma)}
                >
                  <Share2 className="size-4" />
                  Partager
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {diplomas.length === 0 && (
        <Card className="text-center py-8">
          <Shield className="size-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">
            Aucun diplôme NFT trouvé
          </p>
        </Card>
      )}
    </div>
  );
};
