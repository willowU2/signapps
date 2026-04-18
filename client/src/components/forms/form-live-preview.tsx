"use client";

/**
 * Live preview of a form — shows exactly what respondents will see.
 * Used in the builder as a "Preview" tab so the creator can visualize
 * the form without publishing (publishing gates the public /f/[id] URL).
 */

import { useEffect, useState } from "react";
import type { Form, FormField } from "@/lib/api/forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormFieldRenderer } from "./form-field-renderer";
import {
  loadBranding,
  applyBranding,
  brandingShadowClass,
  FONT_CSS,
  type FormBranding,
} from "./form-branding-panel";
import { Eye, Smartphone, Tablet, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormLivePreviewProps {
  form: Form;
}

type Viewport = "mobile" | "tablet" | "desktop";

export function FormLivePreview({ form }: FormLivePreviewProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [branding, setBranding] = useState<FormBranding | null>(null);

  useEffect(() => {
    setBranding(loadBranding(form.id));
    const interval = setInterval(
      () => setBranding(loadBranding(form.id)),
      2000,
    );
    return () => clearInterval(interval);
  }, [form.id]);

  const widthClass =
    viewport === "mobile"
      ? "max-w-sm"
      : viewport === "tablet"
        ? "max-w-xl"
        : "max-w-3xl";

  const brandingStyle = branding ? applyBranding(branding) : {};
  const fontClass = branding ? FONT_CSS[branding.font] : "";
  const shadowClass = branding ? brandingShadowClass(branding) : "shadow-lg";

  return (
    <div className="space-y-4">
      {/* Viewport switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span>Aperçu en direct — identique à ce que verra le répondant</span>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1">
          {(
            [
              { id: "mobile", Icon: Smartphone, label: "Mobile" },
              { id: "tablet", Icon: Tablet, label: "Tablette" },
              { id: "desktop", Icon: Monitor, label: "Bureau" },
            ] as { id: Viewport; Icon: typeof Eye; label: string }[]
          ).map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewport(id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors",
                viewport === id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview card */}
      <div
        className={cn(
          "rounded-lg p-6 min-h-[400px] flex justify-center transition-colors",
          fontClass,
        )}
        style={brandingStyle}
      >
        <div className={cn("w-full transition-all duration-300", widthClass)}>
          {branding?.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.coverImageUrl}
              alt="Cover"
              className="w-full h-40 object-cover rounded-t-lg"
              style={{
                borderRadius: `${branding?.borderRadius ?? 8}px ${branding?.borderRadius ?? 8}px 0 0`,
              }}
            />
          )}
          <Card
            className={cn(shadowClass)}
            style={{
              backgroundColor: branding?.backgroundColor,
              borderRadius: branding?.coverImageUrl
                ? `0 0 ${branding.borderRadius}px ${branding.borderRadius}px`
                : `${branding?.borderRadius ?? 8}px`,
            }}
          >
            <CardHeader>
              {branding?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="h-10 w-auto mb-2"
                />
              )}
              <CardTitle
                className="text-2xl"
                style={{ color: branding?.primaryColor }}
              >
                {form.title}
              </CardTitle>
              {form.description && (
                <CardDescription
                  className="text-base"
                  style={{ color: branding?.textColor }}
                >
                  {form.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {(form.fields || []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-8">
                  Aucun champ. Retourne à l&apos;onglet Éditeur pour ajouter des
                  questions.
                </p>
              ) : (
                (form.fields || []).map((field: FormField) => (
                  <FormFieldRenderer
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    onChange={(v) =>
                      setValues((prev) => ({ ...prev, [field.id]: v }))
                    }
                  />
                ))
              )}

              {(form.fields || []).length > 0 && (
                <div className="pt-4 border-t">
                  <Button
                    type="button"
                    className="w-full"
                    style={{
                      backgroundColor: branding?.primaryColor,
                      color: "#ffffff",
                      borderRadius: `${branding?.borderRadius ?? 8}px`,
                    }}
                    onClick={() =>
                      alert(
                        "Aperçu uniquement — les réponses ne sont pas enregistrées ici.",
                      )
                    }
                  >
                    Envoyer (aperçu)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        💡 Les réponses saisies dans cet aperçu ne sont pas enregistrées.
      </p>
    </div>
  );
}
