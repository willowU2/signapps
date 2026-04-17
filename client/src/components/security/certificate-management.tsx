"use client";

import { useState, useRef } from "react";
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Trash2,
  Download,
} from "lucide-react";

interface Certificate {
  id: string;
  domain: string;
  issuer: string;
  issued_at: string;
  expires_at: string;
  auto_renew: boolean;
  fingerprint: string;
}

const SAMPLE: Certificate[] = [
  {
    id: "1",
    domain: "*.signapps.local",
    issuer: "Let's Encrypt Authority X3",
    issued_at: new Date(Date.now() - 86400000 * 60).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    auto_renew: true,
    fingerprint: "AA:BB:CC:DD:EE:FF:00:11",
  },
  {
    id: "2",
    domain: "mail.signapps.local",
    issuer: "Internal CA",
    issued_at: new Date(Date.now() - 86400000 * 200).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 165).toISOString(),
    auto_renew: false,
    fingerprint: "11:22:33:44:55:66:77:88",
  },
  {
    id: "3",
    domain: "meet.signapps.local",
    issuer: "Let's Encrypt Authority X3",
    issued_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    expires_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    auto_renew: false,
    fingerprint: "99:AA:BB:CC:DD:EE:FF:00",
  },
];

function getCertStatus(cert: Certificate): {
  label: string;
  variant: "default" | "destructive" | "secondary";
  pct: number;
} {
  const now = Date.now();
  const expiry = new Date(cert.expires_at).getTime();
  const issued = new Date(cert.issued_at).getTime();
  const total = expiry - issued;
  const elapsed = now - issued;
  const pct = Math.max(0, Math.min(100, (1 - elapsed / total) * 100));
  const daysLeft = (expiry - now) / 86400000;
  if (daysLeft < 0) return { label: "Expired", variant: "destructive", pct: 0 };
  if (daysLeft < 30)
    return {
      label: `Expiring in ${Math.ceil(daysLeft)}d`,
      variant: "destructive",
      pct,
    };
  return { label: `${Math.ceil(daysLeft)}d left`, variant: "default", pct };
}

export function CertificateManagement() {
  const [certs, setCerts] = useState<Certificate[]>(SAMPLE);
  const [newDomain, setNewDomain] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = () => {
    if (!newDomain.trim()) {
      toast.error("Domain required");
      return;
    }
    const newCert: Certificate = {
      id: Date.now().toString(),
      domain: newDomain,
      issuer: "Uploaded Certificate",
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000 * 365).toISOString(),
      auto_renew: false,
      fingerprint: Array.from({ length: 8 }, () =>
        Math.random().toString(16).slice(2, 4).toUpperCase(),
      ).join(":"),
    };
    setCerts((cs) => [...cs, newCert]);
    setNewDomain("");
    toast.success("Certificate uploaded");
  };

  const renew = (id: string) => {
    setCerts((cs) =>
      cs.map((c) =>
        c.id === id
          ? {
              ...c,
              expires_at: new Date(Date.now() + 86400000 * 90).toISOString(),
            }
          : c,
      ),
    );
    toast.success("Certificate renewed");
  };

  const remove = (id: string) => {
    setCerts((cs) => cs.filter((c) => c.id !== id));
    toast.success("Certificate removed");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> TLS Certificate Management
          </CardTitle>
          <CardDescription>
            Upload, track and renew TLS certificates for your services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Domain</Label>
              <Input
                placeholder="app.example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".pem,.crt,.cer"
                className="hidden"
                onChange={() => upload()}
              />
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Upload PEM
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {certs.map((cert) => {
              const status = getCertStatus(cert);
              return (
                <div key={cert.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {status.variant === "default" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium text-sm">{cert.domain}</span>
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                      {cert.auto_renew && (
                        <Badge variant="outline" className="text-xs">
                          Auto-renew
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Renew"
                        onClick={() => renew(cert.id)}
                        aria-label="Renew"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Download chain"
                        aria-label="Download chain"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove(cert.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Progress value={status.pct} className="h-2" />
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>Issuer: {cert.issuer}</span>
                    <span>
                      Issued: {new Date(cert.issued_at).toLocaleDateString()}
                    </span>
                    <span>
                      Expires: {new Date(cert.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    SHA1: {cert.fingerprint}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
