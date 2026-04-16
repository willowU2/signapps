"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import { useParams } from "next/navigation";
import { usePageTitle } from "@/hooks/use-page-title";
import { formsApi } from "@/lib/api/forms";
import type { Form, FormField, FormAnswer } from "@/lib/api/forms";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, FileText } from "lucide-react";
import { FileUploadField } from "@/components/forms/file-upload-field";
import { SignatureField } from "@/components/forms/signature-field";
import { MultiPageWizard } from "@/components/forms/multi-page-wizard";
import { toast } from "sonner";
import { notify } from "@/lib/notify";

type ExtendedFormField = FormField & {
  show_if?: { field_id: string; operator: string; value: string };
  scores?: Record<string, number>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isFieldVisible(
  field: ExtendedFormField,
  answers: Record<string, any>,
): boolean {
  if (!field.show_if?.field_id) return true;
  const { field_id, operator, value } = field.show_if;
  const current = String(answers[field_id] ?? "");
  if (operator === "equals") return current === value;
  if (operator === "not_equals") return current !== value;
  if (operator === "contains") return current.includes(value);
  return true;
}

function validateField(field: FormField, value: any): string {
  if (field.required) {
    const empty = Array.isArray(value)
      ? value.length === 0
      : !value || String(value).trim() === "";
    if (empty) return "Ce champ est obligatoire";
  }
  if (
    field.field_type === "Email" &&
    value &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))
  )
    return "Adresse email invalide";
  if (field.field_type === "Number" && value && isNaN(Number(value)))
    return "Veuillez saisir un nombre valide";
  return "";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicFormPage() {
  usePageTitle("Formulaire");
  const params = useParams();
  const formId = params.id as string;

  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [respondentEmail, setRespondentEmail] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const loadForm = async () => {
      try {
        const res = await formsApi.get(formId);
        if (!res.data.is_published) {
          setError("Ce formulaire n'est pas encore ouvert aux réponses.");
          setLoading(false);
          return;
        }
        setForm(res.data);

        // Init answers
        const init: Record<string, any> = {};
        res.data.fields?.forEach((f: FormField) => {
          if (f.field_type === "MultipleChoice") init[f.id] = [];
          else init[f.id] = "";
        });
        setAnswers(init);
      } catch (err: unknown) {
        console.error("Failed to load form:", err);
        const e = err as { response?: { status?: number } };
        if (e?.response?.status === 403 || e?.response?.status === 404) {
          setError("Formulaire introuvable ou indisponible.");
          return;
        }
        toast.error("Impossible de charger le formulaire");
        setError("Impossible de charger le formulaire.");
      } finally {
        setLoading(false);
      }
    };
    if (formId) loadForm();
  }, [formId]);

  // Split fields into pages by PageBreak sentinels
  const pages = useMemo(() => {
    const fields = form?.fields ?? [];
    const result: ExtendedFormField[][] = [[]];
    fields.forEach((f) => {
      if (f.field_type === "PageBreak") {
        result.push([]);
      } else {
        result[result.length - 1].push(f as ExtendedFormField);
      }
    });
    return result.filter((p) => p.length > 0);
  }, [form]);

  const isMultiPage = pages.length > 1;

  const handleFieldChange = (fieldId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    // Re-validate on change if already touched
    if (touched[fieldId]) {
      const field = form?.fields?.find((f) => f.id === fieldId);
      if (field) {
        setFieldErrors((e) => ({
          ...e,
          [fieldId]: validateField(field, value),
        }));
      }
    }
  };

  const handleBlur = (field: FormField) => {
    setTouched((t) => ({ ...t, [field.id]: true }));
    setFieldErrors((e) => ({
      ...e,
      [field.id]: validateField(field, answers[field.id]),
    }));
  };

  const handleCheckboxToggle = (
    fieldId: string,
    option: string,
    checked: boolean,
  ) => {
    setAnswers((prev) => {
      const current = (prev[fieldId] || []) as string[];
      if (checked && !current.includes(option)) {
        const newVal = [...current, option];
        if (touched[fieldId]) {
          const field = form?.fields?.find((f) => f.id === fieldId);
          if (field)
            setFieldErrors((e) => ({
              ...e,
              [fieldId]: validateField(field, newVal),
            }));
        }
        return { ...prev, [fieldId]: newVal };
      } else if (!checked) {
        return { ...prev, [fieldId]: current.filter((o) => o !== option) };
      }
      return prev;
    });
  };

  const validatePageFields = (pageFields: ExtendedFormField[]): boolean => {
    const errors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    let valid = true;
    for (const field of pageFields) {
      if (!isFieldVisible(field, answers)) continue;
      newTouched[field.id] = true;
      const err = validateField(field as FormField, answers[field.id]);
      if (err) {
        errors[field.id] = err;
        valid = false;
      }
    }
    setTouched((t) => ({ ...t, ...newTouched }));
    setFieldErrors((e) => ({ ...e, ...errors }));
    return valid;
  };

  const handleNext = () => {
    const currentFields = pages[currentPage];
    if (validatePageFields(currentFields)) {
      setCurrentPage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setCurrentPage((p) => p - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all fields on all pages
    const allFields = pages.flat();
    if (!validatePageFields(allFields)) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setSubmitting(true);

    try {
      const formattedAnswers: FormAnswer[] = Object.keys(answers).map(
        (field_id) => ({
          field_id,
          value: answers[field_id],
        }),
      );

      await formsApi.respond(formId, {
        respondent: respondentEmail || undefined,
        answers: formattedAnswers,
      });

      notify({
        title: "Réponse reçue",
        body: form?.title,
        module: "forms",
        entity_type: "form",
        entity_id: formId,
        deep_link: `/forms/${formId}`,
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Submission failed:", err);
      toast.error("Une erreur s'est produite lors de l'envoi du formulaire");
      setError(
        "Une erreur s'est produite lors de l'envoi. Veuillez réessayer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Compute score for quiz mode
  const scoreResult = useMemo(() => {
    if (!form?.fields || !submitted) return null;
    const fields = form.fields as ExtendedFormField[];
    const hasScores = fields.some(
      (f) => f.scores && Object.keys(f.scores).length > 0,
    );
    if (!hasScores) return null;

    let score = 0;
    let maxScore = 0;
    fields.forEach((f) => {
      if (!f.scores) return;
      const optScores = Object.values(f.scores);
      maxScore += Math.max(...optScores, 0);
      const answer = answers[f.id];
      if (Array.isArray(answer)) {
        score += answer.reduce((s, opt) => s + (f.scores![opt] ?? 0), 0);
      } else if (answer) {
        score += f.scores[answer] ?? 0;
      }
    });
    return { score, maxScore };
  }, [form, submitted, answers]);

  // ─── Render states ──────────────────────────────────────────────────────────

  if (loading)
    return (
      <main
        id="main-content"
        className="min-h-screen flex items-center justify-center bg-muted/20"
      >
        <div className="text-muted-foreground animate-pulse" role="status">
          Chargement du formulaire...
        </div>
      </main>
    );

  if (error && !form)
    return (
      <main
        id="main-content"
        className="min-h-screen flex items-center justify-center bg-muted/20 p-4"
      >
        <Card className="max-w-md w-full shadow-lg border-destructive/20">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <FileText
              className="h-12 w-12 text-muted-foreground mb-4 opacity-30"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold mb-2">Accès restreint</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
          </CardContent>
        </Card>
      </main>
    );

  if (submitted)
    return (
      <main
        id="main-content"
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50 dark:from-indigo-950/20 dark:via-background dark:to-blue-950/20 p-4"
      >
        <Card className="max-w-md w-full shadow-xl border-t-4 border-t-emerald-500 overflow-hidden">
          <div className="h-1.5 w-full bg-emerald-500" />
          <CardContent className="pt-10 pb-8 flex flex-col items-center text-center">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Merci !</h2>
            <p className="text-muted-foreground">
              Votre réponse au formulaire "{form?.title}" a bien été
              enregistrée.
            </p>
            {scoreResult && scoreResult.maxScore > 0 && (
              <div className="mt-4 px-6 py-4 bg-primary/10 rounded-xl border border-primary/20">
                <p className="text-sm text-muted-foreground">Votre score</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  {scoreResult.score}{" "}
                  <span className="text-lg text-muted-foreground">
                    / {scoreResult.maxScore}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {Math.round((scoreResult.score / scoreResult.maxScore) * 100)}
                  %
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    );

  // ─── Field renderer ─────────────────────────────────────────────────────────

  const renderField = (field: ExtendedFormField) => {
    if (!isFieldVisible(field, answers)) return null;
    const err = touched[field.id] ? fieldErrors[field.id] : "";

    return (
      <Card
        key={field.id}
        className="shadow-sm border-border/60 hover:border-border transition-colors"
      >
        <CardContent className="pt-6">
          <Label className="text-base font-medium mb-3 flex items-start gap-1">
            {field.label}
            {field.required && (
              <span className="text-destructive font-bold ml-1">*</span>
            )}
          </Label>

          {(field.field_type === "Text" ||
            field.field_type === "Email" ||
            field.field_type === "Number" ||
            field.field_type === "Date") && (
            <Input
              type={
                field.field_type === "Text"
                  ? "text"
                  : field.field_type.toLowerCase()
              }
              placeholder={field.placeholder || "Votre réponse"}
              required={field.required}
              value={answers[field.id] || ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              onBlur={() => handleBlur(field as FormField)}
              className={`mt-2 bg-background transition-all focus-visible:ring-primary/30 ${err ? "border-destructive" : ""}`}
            />
          )}

          {field.field_type === "TextArea" && (
            <Textarea
              placeholder={field.placeholder || "Votre réponse détaillée"}
              required={field.required}
              value={answers[field.id] || ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              onBlur={() => handleBlur(field as FormField)}
              className={`mt-2 min-h-32 bg-background transition-all focus-visible:ring-primary/30 ${err ? "border-destructive" : ""}`}
            />
          )}

          {field.field_type === "SingleChoice" && (
            <RadioGroup
              className={
                field.options && field.options.length <= 3
                  ? "grid gap-3 mt-3"
                  : field.options && field.options.length <= 6
                    ? "grid sm:grid-cols-2 gap-3 mt-3"
                    : "flex flex-col gap-2 mt-3"
              }
              value={answers[field.id] || ""}
              onValueChange={(val) => handleFieldChange(field.id, val)}
              required={field.required}
            >
              {field.options?.map((opt, i) => {
                const optionCount = field.options?.length || 0;
                const activeLayout =
                  field.layout ||
                  (optionCount <= 3
                    ? "advanced-2"
                    : optionCount <= 6
                      ? "layout-3"
                      : "standard-2");
                if (activeLayout === "advanced-2") {
                  return (
                    <div
                      key={i}
                      className={`relative flex items-center space-x-3 rounded-xl border p-5 shadow-sm transition-colors hover:bg-accent/50 ${answers[field.id] === opt ? "border-primary bg-primary/5" : "bg-background"}`}
                    >
                      <RadioGroupItem
                        id={`${field.id}-${i}`}
                        value={opt}
                        className="h-5 w-5 mt-0.5"
                      />
                      <Label
                        htmlFor={`${field.id}-${i}`}
                        className="cursor-pointer font-semibold text-lg flex-1"
                      >
                        {opt}
                      </Label>
                    </div>
                  );
                } else if (activeLayout === "layout-3") {
                  return (
                    <div
                      key={i}
                      className={`relative flex items-start space-x-3 rounded-lg border p-3 shadow-sm transition-colors hover:bg-accent/50 ${answers[field.id] === opt ? "border-primary bg-primary/5" : "bg-background"}`}
                    >
                      <RadioGroupItem
                        className="mt-0.5"
                        id={`${field.id}-${i}`}
                        value={opt}
                      />
                      <div className="grid flex-1 gap-1 leading-none">
                        <Label
                          htmlFor={`${field.id}-${i}`}
                          className="cursor-pointer font-medium"
                        >
                          {opt}
                        </Label>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={i} className="flex items-center space-x-2 py-2">
                      <RadioGroupItem id={`${field.id}-${i}`} value={opt} />
                      <Label
                        htmlFor={`${field.id}-${i}`}
                        className="cursor-pointer font-normal text-base"
                      >
                        {opt}
                      </Label>
                    </div>
                  );
                }
              })}
            </RadioGroup>
          )}

          {field.field_type === "MultipleChoice" && (
            <div className="space-y-3 mt-3">
              {field.options?.map((opt, i) => {
                const isChecked = (answers[field.id] || []).includes(opt);
                return (
                  <div
                    key={i}
                    className="flex items-center space-x-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      id={`cb-${field.id}-${i}`}
                      className="h-4 w-4 bg-background border-primary rounded text-primary focus:ring-primary"
                      checked={isChecked}
                      onChange={(e) =>
                        handleCheckboxToggle(field.id, opt, e.target.checked)
                      }
                    />
                    <Label
                      htmlFor={`cb-${field.id}-${i}`}
                      className="font-normal cursor-pointer flex-1 py-1"
                    >
                      {opt}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}

          {field.field_type === "File" && (
            <FileUploadField
              fieldId={field.id}
              required={field.required}
              onChange={handleFieldChange}
            />
          )}

          {field.field_type === "Signature" && (
            <SignatureField fieldId={field.id} onChange={handleFieldChange} />
          )}

          {err && (
            <p className="text-xs text-destructive mt-2 flex items-center gap-1">
              {err}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── Main form render ────────────────────────────────────────────────────────

  const currentPageFields = pages[currentPage] ?? [];

  return (
    <main
      id="main-content"
      className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 py-12"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-t-4 border-t-primary shadow-md">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl sm:text-3xl font-bold">
              {form?.title}
            </CardTitle>
            {form?.description && (
              <CardDescription className="text-base mt-2 whitespace-pre-wrap text-foreground/80">
                {form.description}
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg font-medium border border-destructive/20">
              {error}
            </div>
          )}

          {isMultiPage ? (
            <MultiPageWizard
              totalPages={pages.length}
              currentPage={currentPage}
              onNext={handleNext}
              onBack={handleBack}
              submitting={submitting}
            >
              {currentPageFields.map((field) => renderField(field))}
              {currentPage === pages.length - 1 && (
                <Card className="shadow-sm border-border/60">
                  <CardContent className="pt-6">
                    <Label className="text-sm font-medium mb-1 block">
                      Votre adresse email (optionnel)
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Si vous souhaitez recevoir une copie ou être recontacté.
                    </p>
                    <Input
                      type="email"
                      placeholder="nom@exemple.com"
                      value={respondentEmail}
                      onChange={(e) => setRespondentEmail(e.target.value)}
                      className="bg-background"
                    />
                  </CardContent>
                </Card>
              )}
            </MultiPageWizard>
          ) : (
            <>
              {currentPageFields.map((field) => renderField(field))}

              <Card className="shadow-sm border-border/60">
                <CardContent className="pt-6">
                  <Label className="text-sm font-medium mb-1 block">
                    Votre adresse email (optionnel)
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Si vous souhaitez recevoir une copie ou être recontacté.
                  </p>
                  <Input
                    type="email"
                    placeholder="nom@exemple.com"
                    value={respondentEmail}
                    onChange={(e) => setRespondentEmail(e.target.value)}
                    className="bg-background"
                  />
                </CardContent>
              </Card>

              <div className="pt-4 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Protégé par SignApps Security
                </p>
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="min-w-32 shadow-lg hover:shadow-xl transition-all"
                >
                  {submitting ? "Envoi en cours..." : "Envoyer"}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </main>
  );
}
