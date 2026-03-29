'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, CheckCircle2, AlertCircle } from 'lucide-react';

interface ArchivedDocument {
  id: string;
  name: string;
  sha256Hash: string;
  timestamp: Date;
  category: 'Contrat' | 'Facture' | 'PV' | 'Bulletin';
  verified?: boolean;
}

export function LegalArchive() {
  const [documents, setDocuments] = useState<ArchivedDocument[]>([
    {
      id: 'doc-1',
      name: 'Contrat-Client-ACME.pdf',
      sha256Hash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
      timestamp: new Date('2025-03-15'),
      category: 'Contrat',
      verified: true,
    },
    {
      id: 'doc-2',
      name: 'Facture-202503-001.pdf',
      sha256Hash: 'f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1',
      timestamp: new Date('2025-03-10'),
      category: 'Facture',
      verified: true,
    },
    {
      id: 'doc-3',
      name: 'PV-Reunion-Directrice.pdf',
      sha256Hash: 'x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6',
      timestamp: new Date('2025-03-01'),
      category: 'PV',
    },
  ]);

  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const getCategoryColor = (category: string) => {
    const colors = {
      Contrat: 'bg-blue-100 text-blue-800',
      Facture: 'bg-green-100 text-green-800',
      PV: 'bg-purple-100 text-purple-800',
      Bulletin: 'bg-orange-100 text-orange-800',
    };
    return colors[category as keyof typeof colors] || 'bg-muted text-gray-800';
  };

  const handleDownload = (doc: ArchivedDocument) => {
    // Mock download implementation
    const element = document.createElement('a');
    element.href = '#';
    element.download = doc.name;
    element.click();
  };

  const handleVerifyIntegrity = async (docId: string) => {
    setVerifyingId(docId);
    // Simulate verification delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setDocuments((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, verified: true } : doc))
    );
    setVerifyingId(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Archive Légale ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun document archivé pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-semibold">Nom</th>
                    <th className="text-left py-2 font-semibold">Catégorie</th>
                    <th className="text-left py-2 font-semibold">Hash SHA-256</th>
                    <th className="text-left py-2 font-semibold">Date</th>
                    <th className="text-left py-2 font-semibold">Intégrité</th>
                    <th className="text-right py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b hover:bg-muted">
                      <td className="py-3">{doc.name}</td>
                      <td className="py-3">
                        <Badge className={getCategoryColor(doc.category)}>
                          {doc.category}
                        </Badge>
                      </td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {doc.sha256Hash.substring(0, 16)}...
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {doc.timestamp.toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3">
                        {doc.verified ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">Vérifié</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-yellow-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs">Non vérifié</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            title="Télécharger"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVerifyIntegrity(doc.id)}
                            disabled={doc.verified || verifyingId === doc.id}
                            title="Vérifier l'intégrité"
                          >
                            {verifyingId === doc.id ? (
                              <span className="text-xs">Vérification...</span>
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
