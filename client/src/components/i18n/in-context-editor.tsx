"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Edit2, Check, X, Languages, Eye } from "lucide-react";

interface TranslationKey {
  key: string;
  source: string;
  translations: Record<string, string>;
}

const LOCALES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
];

const KEYS: TranslationKey[] = [
  {
    key: "common.save",
    source: "Save",
    translations: {
      fr: "Enregistrer",
      en: "Save",
      de: "Speichern",
      es: "Guardar",
      ar: "حفظ",
    },
  },
  {
    key: "common.cancel",
    source: "Cancel",
    translations: {
      fr: "Annuler",
      en: "Cancel",
      de: "Abbrechen",
      es: "Cancelar",
      ar: "إلغاء",
    },
  },
  {
    key: "common.delete",
    source: "Delete",
    translations: {
      fr: "Supprimer",
      en: "Delete",
      de: "Löschen",
      es: "Eliminar",
      ar: "حذف",
    },
  },
  {
    key: "nav.dashboard",
    source: "Dashboard",
    translations: {
      fr: "Tableau de bord",
      en: "Dashboard",
      de: "Dashboard",
      es: "Panel",
      ar: "لوحة القيادة",
    },
  },
  {
    key: "nav.settings",
    source: "Settings",
    translations: {
      fr: "Paramètres",
      en: "Settings",
      de: "Einstellungen",
      es: "Configuración",
      ar: "الإعدادات",
    },
  },
  {
    key: "auth.login",
    source: "Login",
    translations: {
      fr: "Connexion",
      en: "Login",
      de: "Anmelden",
      es: "Iniciar sesión",
      ar: "تسجيل الدخول",
    },
  },
];

export function InContextEditor() {
  const [keys, setKeys] = useState<TranslationKey[]>(KEYS);
  const [selectedLocale, setSelectedLocale] = useState("fr");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  const startEdit = (key: TranslationKey) => {
    setEditingKey(key.key);
    setEditValue(key.translations[selectedLocale] || "");
  };

  const saveEdit = (keyStr: string) => {
    setKeys((ks) =>
      ks.map((k) =>
        k.key === keyStr
          ? {
              ...k,
              translations: { ...k.translations, [selectedLocale]: editValue },
            }
          : k,
      ),
    );
    setEditingKey(null);
    toast.success("Translation saved");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const locale = LOCALES.find((l) => l.code === selectedLocale)!;
  const isRTL = selectedLocale === "ar" || selectedLocale === "he";
  const missing = keys.filter((k) => !k.translations[selectedLocale]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" /> In-Context Translation Editor
              </CardTitle>
              <CardDescription>
                Edit translations inline for each locale
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={previewMode ? "default" : "outline"}
                onClick={() => setPreviewMode((v) => !v)}
              >
                <Eye className="mr-2 h-4 w-4" /> Preview
              </Button>
              <Select value={selectedLocale} onValueChange={setSelectedLocale}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant={missing.length === 0 ? "default" : "destructive"}>
              {keys.length - missing.length}/{keys.length} translated
            </Badge>
            {missing.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {missing.length} missing for {locale.label}
              </span>
            )}
          </div>

          <div className="space-y-2" dir={isRTL ? "rtl" : "ltr"}>
            {keys.map((k) => {
              const translation = k.translations[selectedLocale];
              const isMissing = !translation;
              const isEditing = editingKey === k.key;

              return (
                <div
                  key={k.key}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2 ${isMissing ? "border-orange-500/30 bg-orange-500/5" : ""}`}
                >
                  <code
                    className="text-xs text-muted-foreground w-32 shrink-0 font-mono"
                    dir="ltr"
                  >
                    {k.key}
                  </code>
                  <span
                    className="text-xs text-muted-foreground w-24 shrink-0 truncate"
                    dir="ltr"
                  >
                    {k.source}
                  </span>
                  <div className="flex-1">
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        dir={isRTL ? "rtl" : "ltr"}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(k.key);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <span
                        className={`text-sm ${isMissing ? "text-orange-500 italic" : ""}`}
                      >
                        {translation || "Missing translation"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-green-500"
                          onClick={() => saveEdit(k.key)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={cancelEdit}
                          aria-label="Fermer"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEdit(k)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            size="sm"
            onClick={() =>
              toast.success("All translations exported to messages files")
            }
          >
            Export to JSON
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
