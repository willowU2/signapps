"use client";

// Feature 10: Notification digest → daily email summary

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Clock, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";

interface DigestPreferences {
  enabled: boolean;
  frequency: "daily" | "weekly" | "never";
  time: string; // HH:MM
  includeModules: {
    projects: boolean;
    hr: boolean;
    tasks: boolean;
    calendar: boolean;
  };
}

interface DigestPreview {
  date: string;
  sections: { module: string; count: number; items: string[] }[];
  totalNotifications: number;
}

const DEFAULT_PREFS: DigestPreferences = {
  enabled: true,
  frequency: "daily",
  time: "08:00",
  includeModules: { projects: true, hr: true, tasks: true, calendar: false },
};

const PREVIEW_DATA: DigestPreview = {
  date: new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
  totalNotifications: 7,
  sections: [
    { module: "Projets", count: 3, items: ["Jalon atteint: API JWT", "Risque: Sous-effectif QA", "Budget dépassé: Analytics"] },
    { module: "RH", count: 2, items: ["Congé approuvé: Alice Martin (7-11 avr.)", "Nouvelle embauche: Marc Dubois"] },
    { module: "Tâches", count: 2, items: ["2 tâches en retard", "4 tâches dues aujourd'hui"] },
  ],
};

export function NotificationDigest() {
  const [prefs, setPrefs] = useState<DigestPreferences>(DEFAULT_PREFS);
  const [showPreview, setShowPreview] = useState(false);

  function updateModule(module: keyof DigestPreferences["includeModules"], value: boolean) {
    setPrefs((p) => ({ ...p, includeModules: { ...p.includeModules, [module]: value } }));
  }

  function sendTestDigest() {
    toast.success("Digest de test envoyé", { description: "Vérifiez votre boîte email dans quelques instants." });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" />
            Digest email quotidien
          </CardTitle>
          <Switch checked={prefs.enabled} onCheckedChange={(v) => setPrefs((p) => ({ ...p, enabled: v }))} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {prefs.enabled && (
          <>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Fréquence</Label>
                <Select value={prefs.frequency} onValueChange={(v) => setPrefs((p) => ({ ...p, frequency: v as DigestPreferences["frequency"] }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Quotidien</SelectItem>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    <SelectItem value="never">Jamais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs flex items-center gap-1"><Clock className="size-3" /> Heure</Label>
                <input type="time" value={prefs.time} onChange={(e) => setPrefs((p) => ({ ...p, time: e.target.value }))}
                  className="h-8 w-full rounded-md border px-2 text-xs" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Modules inclus</Label>
              {(Object.keys(prefs.includeModules) as Array<keyof typeof prefs.includeModules>).map((mod) => (
                <div key={mod} className="flex items-center justify-between">
                  <Label className="text-xs capitalize">{mod}</Label>
                  <Switch checked={prefs.includeModules[mod]} onCheckedChange={(v) => updateModule(mod, v)} />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? <CheckCircle2 className="size-3" /> : null}
                Aperçu
              </Button>
              <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={sendTestDigest}>
                <Send className="size-3" /> Test
              </Button>
            </div>

            {showPreview && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Résumé du {PREVIEW_DATA.date}</p>
                  <Badge variant="secondary">{PREVIEW_DATA.totalNotifications} notifications</Badge>
                </div>
                {PREVIEW_DATA.sections.map((s) => (
                  <div key={s.module}>
                    <p className="font-medium text-muted-foreground">{s.module} ({s.count})</p>
                    <ul className="mt-0.5 space-y-0.5 pl-3">
                      {s.items.map((item, i) => <li key={i} className="text-[11px]">• {item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!prefs.enabled && (
          <p className="text-xs text-muted-foreground">Le digest email est désactivé. Activez-le pour recevoir un résumé régulier.</p>
        )}
      </CardContent>
    </Card>
  );
}
