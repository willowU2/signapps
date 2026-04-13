"use client";

import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  Eye,
  Clock,
  FileText,
  Search,
  Lock,
  AlertTriangle,
  Download,
} from "lucide-react";

// ── Types ──
interface DataRoomDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  expiresAt: string | null;
  accessLevel: "public" | "restricted" | "confidential";
  viewCount: number;
  allowDownload: boolean;
}

interface AuditEntry {
  id: string;
  documentId: string;
  documentName: string;
  userId: string;
  userName: string;
  action: "view" | "download" | "share";
  timestamp: string;
  ipAddress: string;
}

// TODO: wire to backend API when data-room endpoints are available

const ACCESS_LEVEL_COLORS: Record<string, string> = {
  public: "bg-green-100 text-green-800",
  restricted: "bg-orange-100 text-orange-800",
  confidential: "bg-red-100 text-red-800",
};

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  public: "Public",
  restricted: "Restreint",
  confidential: "Confidentiel",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Consultation",
  download: "Telechargement",
  share: "Partage",
};

// ── Watermark overlay ──
function WatermarkOverlay({ userName }: { userName: string }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="absolute text-gray-400/20 text-2xl font-bold whitespace-nowrap rotate-[-35deg]"
          style={{
            top: `${i * 20 + 5}%`,
            left: "-10%",
            fontSize: "24px",
          }}
        >
          {userName} — CONFIDENTIEL — {new Date().toLocaleDateString("fr-FR")}
        </div>
      ))}
    </div>
  );
}

// ── Document preview dialog ──
function DocumentPreviewDialog({
  doc,
  onClose,
}: {
  doc: DataRoomDocument | null;
  onClose: () => void;
}) {
  if (!doc) return null;
  const isExpired = doc.expiresAt
    ? new Date(doc.expiresAt) < new Date()
    : false;

  return (
    <Dialog open={!!doc} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {doc.name}
          </DialogTitle>
        </DialogHeader>
        <div className="relative bg-gray-50 rounded-lg border h-80 flex items-center justify-center overflow-hidden">
          {isExpired ? (
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-orange-400" />
              <p className="font-medium">Acces expire</p>
              <p className="text-sm">
                Ce document a expire le{" "}
                {new Date(doc.expiresAt!).toLocaleDateString("fr-FR")}
              </p>
            </div>
          ) : (
            <>
              <div className="text-center text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-3 text-primary/30" />
                <p className="font-medium">{doc.name}</p>
                <p className="text-sm">
                  {doc.type} · {doc.size}
                </p>
              </div>
              {doc.accessLevel === "confidential" && (
                <WatermarkOverlay userName="Utilisateur Actuel" />
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="w-4 h-4" />
            {doc.viewCount} consultation(s)
            {doc.expiresAt && (
              <>
                <span>·</span>
                <Clock className="w-4 h-4" />
                Expire le {new Date(doc.expiresAt).toLocaleDateString("fr-FR")}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {doc.allowDownload && !isExpired && (
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Telecharger
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DataRoomPage({ params }: { params: { id: string } }) {
  usePageTitle("Data Room");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"documents" | "audit">(
    "documents",
  );
  const [previewDoc, setPreviewDoc] = useState<DataRoomDocument | null>(null);
  // TODO: wire to backend API when data-room endpoints are available
  const [docs] = useState<DataRoomDocument[]>([]);
  const [audit] = useState<AuditEntry[]>([]);

  const filteredDocs = docs.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleView = (doc: DataRoomDocument) => {
    setPreviewDoc(doc);
    // In production: POST audit trail entry
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Data Room
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Espace de partage securise · ID: {params.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "documents" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("documents")}
            >
              <FileText className="w-4 h-4 mr-2" />
              Documents
            </Button>
            <Button
              variant={activeTab === "audit" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("audit")}
            >
              <Eye className="w-4 h-4 mr-2" />
              Piste d'audit
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{docs.length}</div>
              <div className="text-xs text-muted-foreground">Documents</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">
                {docs.filter((d) => d.accessLevel === "confidential").length}
              </div>
              <div className="text-xs text-muted-foreground">Confidentiels</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-500">
                {docs.filter((d) => isExpired(d.expiresAt)).length}
              </div>
              <div className="text-xs text-muted-foreground">Expires</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{audit.length}</div>
              <div className="text-xs text-muted-foreground">Acces recents</div>
            </CardContent>
          </Card>
        </div>

        {activeTab === "documents" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Documents partages</CardTitle>
                  <CardDescription>
                    Acces controle avec filigrane et traçabilite
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Acces</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead className="text-center">Vues</TableHead>
                    <TableHead className="text-center">
                      Telechargement
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Aucun document dans cette data room
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocs.map((doc) => {
                      const expired = isExpired(doc.expiresAt);
                      return (
                        <TableRow
                          key={doc.id}
                          className={expired ? "opacity-50" : ""}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm">
                                {doc.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {doc.type}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={ACCESS_LEVEL_COLORS[doc.accessLevel]}
                            >
                              {ACCESS_LEVEL_LABELS[doc.accessLevel]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {doc.expiresAt ? (
                              <span
                                className={
                                  expired
                                    ? "text-red-500"
                                    : "text-muted-foreground"
                                }
                              >
                                {expired && (
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                )}
                                {new Date(doc.expiresAt).toLocaleDateString(
                                  "fr-FR",
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                Aucune
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 text-sm">
                              <Eye className="w-3 h-3 text-muted-foreground" />
                              {doc.viewCount}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.allowDownload ? (
                              <Download className="w-4 h-4 text-green-600 mx-auto" />
                            ) : (
                              <Lock className="w-4 h-4 text-red-400 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={expired}
                              onClick={() => handleView(doc)}
                              aria-label={`Consulter ${doc.name}`}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Consulter
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "audit" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Piste d'audit
              </CardTitle>
              <CardDescription>
                Historique complet des acces aux documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Date/Heure</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Aucun acces enregistre
                      </TableCell>
                    </TableRow>
                  ) : (
                    audit.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium text-primary">
                              {entry.userName.charAt(0)}
                            </div>
                            {entry.userName}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {entry.documentName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              entry.action === "download"
                                ? "border-blue-300 text-blue-700"
                                : entry.action === "share"
                                  ? "border-purple-300 text-purple-700"
                                  : "border-green-300 text-green-700"
                            }
                          >
                            {ACTION_LABELS[entry.action]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {entry.ipAddress}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <DocumentPreviewDialog
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      </div>
    </AppLayout>
  );
}
