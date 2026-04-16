"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mail, Printer, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Envelope {
  id: string;
  recipient: string;
  address1: string;
  address2: string;
  city: string;
  postalCode: string;
  country: string;
}

interface SenderConfig {
  name: string;
  address: string;
}

export function EnvelopeAddressing() {
  const [sender, setSender] = useState<SenderConfig>({
    name: "SignApps SAS",
    address: "12 Rue de la Innovation, 75001 Paris",
  });
  const [envelopes, setEnvelopes] = useState<Envelope[]>([
    {
      id: "1",
      recipient: "M. Jean-Pierre Martin",
      address1: "45 Avenue des Champs-Élysées",
      address2: "",
      city: "Paris",
      postalCode: "75008",
      country: "France",
    },
  ]);
  const [csvText, setCsvText] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const add = () =>
    setEnvelopes((p) => [
      ...p,
      {
        id: Date.now().toString(),
        recipient: "",
        address1: "",
        address2: "",
        city: "",
        postalCode: "",
        country: "France",
      },
    ]);
  const remove = (id: string) =>
    setEnvelopes((p) => p.filter((e) => e.id !== id));
  const update = (id: string, f: keyof Envelope, v: string) =>
    setEnvelopes((p) => p.map((e) => (e.id === id ? { ...e, [f]: v } : e)));

  const importCsv = () => {
    const lines = csvText.trim().split("\n").filter(Boolean);
    const imported = lines.map((line) => {
      const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      return {
        id: Date.now().toString() + Math.random(),
        recipient: parts[0] || "",
        address1: parts[1] || "",
        address2: parts[2] || "",
        city: parts[3] || "",
        postalCode: parts[4] || "",
        country: parts[5] || "France",
      };
    });
    setEnvelopes((prev) => [...prev, ...imported]);
    setCsvText("");
    toast.success(`${imported.length} envelopes imported`);
  };

  const print = () => {
    if (!printRef.current) return;
    const html = envelopes
      .map(
        (e) => `
      <div style="page-break-after:always;width:230mm;height:110mm;position:relative;padding:10mm;box-sizing:border-box;font-family:Arial,sans-serif;border:1px solid #ddd;">
        <div style="position:absolute;top:10mm;left:10mm;font-size:10pt;color:#555;">
          <p style="margin:0;font-weight:bold;">${sender.name}</p>
          <p style="margin:0;">${sender.address}</p>
        </div>
        <div style="position:absolute;bottom:20mm;right:20mm;text-align:right;font-size:12pt;">
          <p style="margin:0;font-weight:bold;">${e.recipient}</p>
          <p style="margin:0;">${e.address1}${e.address2 ? ", " + e.address2 : ""}</p>
          <p style="margin:0;">${e.postalCode} ${e.city}</p>
          ${e.country !== "France" ? `<p style="margin:0;text-transform:uppercase;">${e.country}</p>` : ""}
        </div>
      </div>
    `,
      )
      .join("");

    const win = window.open("", "_blank");
    win?.document.write(
      `<html><head><style>@media print{div{border:none!important}}</style></head><body>${html}</body></html>`,
    );
    win?.document.close();
    win?.print();
    toast.success(`Printing ${envelopes.length} envelope(s)`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-primary" />
            Envelope Addressing
            <Badge variant="secondary">{envelopes.length}</Badge>
          </CardTitle>
          <Button size="sm" onClick={print} className="gap-1.5">
            <Printer className="h-4 w-4" />
            Print All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sender */}
        <div className="p-3 bg-muted/30 rounded-lg space-y-2">
          <p className="text-xs font-semibold">Return Address (sender)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={sender.name}
              onChange={(e) =>
                setSender((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="Company Name"
              className="h-7 text-xs"
            />
            <Input
              value={sender.address}
              onChange={(e) =>
                setSender((p) => ({ ...p, address: e.target.value }))
              }
              placeholder="Address"
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* CSV Import */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Upload className="h-3.5 w-3.5" />
            Import from CSV (Name, Addr1, Addr2, City, PostalCode, Country)
          </summary>
          <div className="mt-2 space-y-2">
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={3}
              placeholder='"Alice Dupont","12 Rue Victor Hugo","","Lyon","69001","France"'
              className="text-xs font-mono"
            />
            <Button size="sm" variant="outline" onClick={importCsv}>
              Import
            </Button>
          </div>
        </details>

        {/* Envelopes */}
        <div className="space-y-2">
          {envelopes.map((env) => (
            <div key={env.id} className="p-3 border rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">Envelope</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => remove(env.id)}
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  value={env.recipient}
                  onChange={(e) => update(env.id, "recipient", e.target.value)}
                  placeholder="Recipient"
                  className="h-7 text-xs col-span-2"
                />
                <Input
                  value={env.address1}
                  onChange={(e) => update(env.id, "address1", e.target.value)}
                  placeholder="Address line 1"
                  className="h-7 text-xs"
                />
                <Input
                  value={env.address2}
                  onChange={(e) => update(env.id, "address2", e.target.value)}
                  placeholder="Address line 2"
                  className="h-7 text-xs"
                />
                <Input
                  value={env.postalCode}
                  onChange={(e) => update(env.id, "postalCode", e.target.value)}
                  placeholder="Postal Code"
                  className="h-7 text-xs"
                />
                <Input
                  value={env.city}
                  onChange={(e) => update(env.id, "city", e.target.value)}
                  placeholder="City"
                  className="h-7 text-xs"
                />
                <Input
                  value={env.country}
                  onChange={(e) => update(env.id, "country", e.target.value)}
                  placeholder="Country"
                  className="h-7 text-xs col-span-2"
                />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Envelope
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
