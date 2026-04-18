"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import { formsApi } from "@/lib/api/forms";
import type { Form, FormField } from "@/lib/api/forms";
import { FIELD_CATEGORIES } from "@/lib/forms/field-catalog";
import { FormFieldStylePanel } from "@/components/forms/form-field-style-panel";
import { FormLivePreview } from "@/components/forms/form-live-preview";
import { ImageChoiceEditor } from "@/components/forms/image-choice-editor";
import { MatrixEditor } from "@/components/forms/matrix-editor";
import { cn } from "@/lib/utils";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  GripVertical,
  Eye,
  Type,
  List,
  CheckSquare,
  Calendar,
  Hash,
  Mail,
  Image as ImageIcon,
  CircleDot,
  ChevronUp,
  ChevronDown,
  PenLine,
  Layers,
  BarChart3,
  Settings,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { useBreadcrumbStore } from "@/lib/store/breadcrumb-store";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDndMonitor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ConditionalLogicEditor,
  type ConditionGroup,
} from "@/components/forms/conditional-logic-editor";
import { ScoringEditor } from "@/components/forms/scoring-editor";
import { ResponseAnalytics } from "@/components/forms/response-analytics";
import { ExportResponses } from "@/components/forms/export-responses";
import { FormBrandingPanel } from "@/components/forms/form-branding-panel";
import { useQuery } from "@tanstack/react-query";

// Extended FormField type to handle new properties
type ExtendedFormField = FormField & {
  show_if?: ConditionGroup;
  scores?: Record<string, number>;
  page?: number;
};

interface SortableFieldProps {
  field: ExtendedFormField;
  index: number;
  allFields: ExtendedFormField[];
  updateField: (id: string, updates: Partial<ExtendedFormField>) => void;
  removeField: (id: string) => void;
  quizMode: boolean;
}

/**
 * Collapsible toggle for the conditional-logic editor.
 * Hidden by default — user clicks the pill button to configure a rule,
 * or it auto-expands if a rule is already set.
 */
function ConditionalLogicToggle({
  field,
  allFields,
  onUpdate,
}: {
  field: FormField;
  allFields: FormField[];
  onUpdate: (cond: ConditionGroup | undefined) => void;
}) {
  const cond = (field as FormField & { show_if?: ConditionGroup }).show_if;
  const hasLogic = Boolean(
    cond &&
    ((cond as ConditionGroup).conditions?.some((c) => c.field_id) ||
      (cond as unknown as { field_id?: string }).field_id),
  );
  const [open, setOpen] = useState(hasLogic);

  if (!open) {
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-full px-2.5 py-1 transition-colors"
          title="Ajouter une règle d'affichage conditionnel"
        >
          <Plus className="h-3 w-3" />
          Logique conditionnelle
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 relative">
      <button
        type="button"
        onClick={() => {
          onUpdate(undefined);
          setOpen(false);
        }}
        className="absolute -top-2 right-2 z-10 text-[10px] text-muted-foreground hover:text-destructive bg-background border rounded-full px-2 py-0.5"
        title="Retirer la logique conditionnelle"
      >
        Retirer
      </button>
      <ConditionalLogicEditor
        field={field}
        allFields={allFields}
        onChange={(cond) => onUpdate(cond)}
      />
    </div>
  );
}

function SortableField({
  field,
  index,
  allFields,
  updateField,
  removeField,
  quizMode,
}: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: { type: "form-field" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  // PageBreak sentinel
  if (field.field_type === "PageBreak") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="flex items-center gap-3 py-3 cursor-grab"
      >
        <div className="flex-1 border-t-2 border-dashed border-primary/40" />
        <span className="text-xs font-medium text-primary/60 px-2 border border-dashed border-primary/40 rounded-full">
          — Saut de page —
        </span>
        <div className="flex-1 border-t-2 border-dashed border-primary/40" />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive/50 hover:text-destructive"
          onClick={() => removeField(field.id)}
          aria-label={`Supprimer le champ ${field.label || "sans titre"}`}
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`relative group border-border/60 hover:border-primary/50 transition-colors shadow-sm bg-card ${isDragging ? "shadow-lg border-primary outline outline-1 outline-primary" : ""}`}
      data-testid={`form-field-item-${index}`}
      data-field-id={field.id}
      data-field-type={field.field_type}
      data-field-required={field.required ? "true" : "false"}
    >
      {/* DRAG HANDLE */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex flex-col items-center justify-center border-r bg-muted/30 rounded-l-xl opacity-50 group-hover:opacity-100 transition-opacity cursor-grab hover:bg-muted/50 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        <div className="text-[10px] font-mono font-medium text-muted-foreground my-2 select-none">
          {index + 1}
        </div>
        <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
      </div>

      <div className="pl-12 p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 mr-4">
            <Input
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              className="text-lg font-medium border-none shadow-none px-0 h-auto focus-visible:ring-0 focus-visible:bg-muted/50 rounded-sm"
              placeholder="Titre de la question"
              data-testid={`form-field-label-${index}`}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            onClick={() => removeField(field.id)}
            data-testid={`form-field-delete-${index}`}
            aria-label={`Supprimer le champ ${field.label || "sans titre"}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Type de champ
            </Label>
            <Select
              value={field.field_type}
              onValueChange={(val) =>
                updateField(field.id, {
                  field_type: val as FormField["field_type"],
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choisir un type..." />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {FIELD_CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 sticky top-0">
                      {cat.label}
                    </div>
                    {cat.fields.map((fdef) => {
                      const Icon = fdef.icon;
                      return (
                        <SelectItem
                          key={fdef.type}
                          value={fdef.type}
                          className="text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "h-5 w-5 rounded flex items-center justify-center text-white shrink-0",
                                fdef.accent,
                              )}
                            >
                              <Icon className="h-3 w-3" />
                            </div>
                            <span>{fdef.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(field.field_type === "Text" ||
            field.field_type === "TextArea" ||
            field.field_type === "Number" ||
            field.field_type === "Email") && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Texte indicatif (Placeholder)
              </Label>
              <Input
                className="h-9 text-sm"
                value={field.placeholder || ""}
                onChange={(e) =>
                  updateField(field.id, { placeholder: e.target.value })
                }
                placeholder="Ex: Saisissez votre réponse ici..."
              />
            </div>
          )}
        </div>

        {(field.field_type === "SingleChoice" ||
          field.field_type === "MultipleChoice" ||
          field.field_type === "Dropdown" ||
          field.field_type === "Ranking") && (
          <div className="space-y-4 mb-4 bg-muted/20 p-3 rounded-md border">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
                {field.field_type === "Ranking"
                  ? "Éléments à classer (ordre initial proposé au répondant)"
                  : "Options disponibles"}
              </Label>
              <div className="space-y-2">
                {(field.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input
                      className="h-9 text-sm bg-background flex-1"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...(field.options || [])];
                        newOpts[i] = e.target.value;
                        updateField(field.id, { options: newOpts });
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                    <div className="flex bg-muted/50 rounded-md border">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={i === 0}
                        onClick={() => {
                          const newOpts = [...(field.options || [])];
                          [newOpts[i], newOpts[i - 1]] = [
                            newOpts[i - 1],
                            newOpts[i],
                          ];
                          updateField(field.id, { options: newOpts });
                        }}
                        className="h-9 w-7 rounded-none rounded-l-md hover:bg-muted"
                        aria-label="Monter cette option"
                      >
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={i === (field.options?.length || 0) - 1}
                        onClick={() => {
                          const newOpts = [...(field.options || [])];
                          [newOpts[i], newOpts[i + 1]] = [
                            newOpts[i + 1],
                            newOpts[i],
                          ];
                          updateField(field.id, { options: newOpts });
                        }}
                        className="h-9 w-7 rounded-none border-l hover:bg-muted"
                        aria-label="Descendre cette option"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newOpts = [...(field.options || [])];
                        newOpts.splice(i, 1);
                        updateField(field.id, { options: newOpts });
                      }}
                      className="h-9 w-9 text-destructive/70 hover:text-destructive hover:bg-destructive/10 ml-1"
                      aria-label="Supprimer cette option"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs border-dashed"
                  onClick={() => {
                    const newOpts = [
                      ...(field.options || []),
                      `Option ${(field.options?.length || 0) + 1}`,
                    ];
                    updateField(field.id, { options: newOpts });
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Ajouter une option
                </Button>
              </div>
            </div>

            {field.field_type === "SingleChoice" && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
                  Style d'affichage
                </Label>
                <Select
                  value={field.layout || "auto"}
                  onValueChange={(val) =>
                    updateField(field.id, {
                      layout: val === "auto" ? undefined : val,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Sélectionner un style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      Automatique (Recommandé)
                    </SelectItem>
                    <SelectItem value="advanced-2">
                      Grandes Cartes de Tarification
                    </SelectItem>
                    <SelectItem value="layout-3">
                      Grille Compacte (2 colonnes)
                    </SelectItem>
                    <SelectItem value="standard-2">
                      Liste Verticale Classique
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Scoring editor for quiz mode */}
            {quizMode && (
              <ScoringEditor
                field={field as FormField}
                onChange={(scores) => updateField(field.id, { scores })}
              />
            )}
          </div>
        )}

        {/* Image choice options editor */}
        {field.field_type === "ImageChoice" && (
          <ImageChoiceEditor
            field={field as FormField}
            onUpdate={(patch) => updateField(field.id, patch)}
          />
        )}

        {/* Matrix rows/columns editor */}
        {field.field_type === "Matrix" && (
          <MatrixEditor
            field={field as FormField}
            onUpdate={(patch) => updateField(field.id, patch)}
          />
        )}

        {/* Conditional logic — collapsed by default, shown only if active */}
        <ConditionalLogicToggle
          field={field as FormField}
          allFields={allFields as FormField[]}
          onUpdate={(cond) => updateField(field.id, { show_if: cond })}
        />

        <div className="flex items-center justify-end border-t pt-3 mt-2">
          <div className="flex items-center space-x-2">
            <Switch
              id={`req-${field.id}`}
              checked={field.required}
              onCheckedChange={(checked) =>
                updateField(field.id, { required: checked })
              }
            />
            <Label
              htmlFor={`req-${field.id}`}
              className="text-sm cursor-pointer"
            >
              Champ obligatoire
            </Label>
          </div>
        </div>

        {/* Per-field style panel — collapsible, appears after each field */}
        <div className="mt-3">
          <FormFieldStylePanel
            field={field}
            onChange={(patch) => updateField(field.id, patch)}
          />
        </div>
      </div>
    </Card>
  );
}

export default function FormBuilderPage() {
  usePageTitle("Éditeur de formulaire");
  const params = useParams();
  const formId = params.id as string;
  const setCustomLabel = useBreadcrumbStore((s) => s.setCustomLabel);

  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<ExtendedFormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [notifyOnResponse, setNotifyOnResponse] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`form:notify:${formId}`) === "true";
    }
    return false;
  });

  // Load responses for analytics
  const { data: responses = [] } = useQuery({
    queryKey: ["form-responses", formId],
    queryFn: () => formsApi.responses(formId).then((r) => r.data),
    enabled: !!formId,
  });

  useEffect(() => {
    const loadForm = async () => {
      try {
        const res = await formsApi.get(formId);
        setForm(res.data);
        setCustomLabel(formId, res.data.title);
        setFields(res.data.fields || []);
      } catch (err) {
        console.error("Failed to load form builder:", err);
        toast.error("Impossible de charger le formulaire");
        setError("Impossible de charger le formulaire.");
      } finally {
        setLoading(false);
      }
    };
    if (formId) loadForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updatedFields = fields.map((f, i) => ({ ...f, order: i }));
      await formsApi.update(formId, { fields: updatedFields as FormField[] });
      setFields(updatedFields);
      toast.success("Formulaire sauvegardé avec succès !");
    } catch (err) {
      console.error("Impossible d'enregistrer form:", err);
      toast.error("Erreur lors de la sauvegarde du formulaire");
      setError("Erreur lors de la sauvegarde du formulaire.");
    } finally {
      setSaving(false);
    }
  };

  const addField = (type: string) => {
    const newField: ExtendedFormField = {
      id: crypto.randomUUID(),
      label:
        type === "PageBreak"
          ? ""
          : `Nouveau champ ${fields.filter((f) => f.field_type !== "PageBreak").length + 1}`,
      field_type: type as FormField["field_type"],
      required: false,
      order: fields.length,
      options:
        type === "SingleChoice" || type === "MultipleChoice"
          ? ["Option 1"]
          : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<ExtendedFormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (loading)
    return (
      <AppLayout>
        <div className="flex justify-center p-20">
          Chargement de l'éditeur...
        </div>
      </AppLayout>
    );
  if (error || !form)
    return (
      <AppLayout>
        <div className="p-8 text-destructive">
          {error || "Formulaire introuvable"}
        </div>
      </AppLayout>
    );

  return (
    <AppLayout>
      <div
        className="flex-1 space-y-6 w-full p-4 md:p-8"
        data-testid="form-editor-root"
        data-form-id={formId}
        data-form-title={form.title}
      >
        {/* Header Navbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label="Retour aux formulaires"
            >
              <Link href="/forms">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{form.title}</h1>
              <p className="text-xs text-muted-foreground">
                Éditeur de questions
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild data-testid="form-editor-preview">
              <Link href={`/f/${formId}?preview=1`} target="_blank">
                <Eye className="h-4 w-4 mr-2" /> Aperçu public
              </Link>
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
              data-testid="form-editor-save"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="builder">
          <TabsList data-testid="form-editor-tabs">
            <TabsTrigger value="builder" data-testid="form-editor-tab-builder">
              Éditeur
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="form-editor-tab-preview">
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Aperçu
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              data-testid="form-editor-tab-analytics"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Analyses {responses.length > 0 && `(${responses.length})`}
            </TabsTrigger>
            <TabsTrigger
              value="branding"
              data-testid="form-editor-tab-branding"
            >
              <Palette className="h-3.5 w-3.5 mr-1.5" />
              Apparence
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              data-testid="form-editor-tab-settings"
            >
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Paramètres
            </TabsTrigger>
          </TabsList>

          {/* Builder Tab */}
          <TabsContent value="builder" className="mt-4">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Fields List */}
              <div
                className="flex-1 space-y-4"
                data-testid="form-field-list"
                data-field-count={fields.length}
              >
                {fields.length === 0 ? (
                  <div className="border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground bg-muted/20">
                    <Plus className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      Votre formulaire est vide
                    </h3>
                    <p className="text-sm">
                      Ajoutez votre première question en utilisant le panneau
                      latéral.
                    </p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={fields.map((f) => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {fields.map((field, index) => (
                        <SortableField
                          key={field.id}
                          field={field}
                          index={index}
                          allFields={fields}
                          updateField={updateField}
                          removeField={removeField}
                          quizMode={quizMode}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              {/* Toolbar Sidebar */}
              <div className="w-full lg:w-72 shrink-0">
                <div className="sticky top-6">
                  <Card className="shadow-lg border-border/50 bg-card/60 backdrop-blur-md">
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="text-md">Outils</CardTitle>
                      <CardDescription>
                        Ajoutez des champs au formulaire
                      </CardDescription>
                    </CardHeader>
                    <CardContent
                      className="p-3 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto"
                      data-testid="form-field-palette"
                    >
                      {FIELD_CATEGORIES.map((cat) => (
                        <div key={cat.id} className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                            {cat.label}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {cat.fields.map((fdef) => {
                              const Icon = fdef.icon;
                              return (
                                <button
                                  key={fdef.type}
                                  type="button"
                                  onClick={() => addField(fdef.type)}
                                  className="flex items-center gap-2 rounded-md border border-border bg-background hover:border-primary/50 hover:bg-muted/30 p-2 transition-all group"
                                  title={fdef.description}
                                  data-testid={`form-field-palette-${fdef.type.toLowerCase()}`}
                                >
                                  <div
                                    className={cn(
                                      "h-6 w-6 rounded flex items-center justify-center text-white shrink-0",
                                      fdef.accent,
                                    )}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="text-[10px] text-left leading-tight flex-1 truncate">
                                    {fdef.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Preview Tab — live WYSIWYG of what respondents see, no publish needed */}
          <TabsContent value="preview" className="mt-4">
            {form ? (
              <FormLivePreview form={{ ...form, fields }} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Chargement du formulaire...
              </p>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {responses.length} réponse(s) collectée(s)
                </p>
                <ExportResponses
                  fields={fields as FormField[]}
                  responses={responses}
                />
              </div>
              <ResponseAnalytics
                formId={formId}
                fields={fields as FormField[]}
              />
            </div>
          </TabsContent>

          {/* FM2: Branding Tab */}
          <TabsContent value="branding" className="mt-4">
            <FormBrandingPanel formId={formId} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Paramètres du formulaire
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Mode Quiz / Score</p>
                    <p className="text-xs text-muted-foreground">
                      Attribuez des points aux options de choix et affichez le
                      score total
                    </p>
                  </div>
                  <Switch checked={quizMode} onCheckedChange={setQuizMode} />
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <p className="text-sm font-medium">Notification email</p>
                    <p className="text-xs text-muted-foreground">
                      Me notifier à chaque nouvelle réponse
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnResponse}
                    onCheckedChange={(v) => {
                      setNotifyOnResponse(v);
                      localStorage.setItem(`form:notify:${formId}`, String(v));
                    }}
                  />
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Lien public</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 truncate">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/f/${formId}`
                        : `/f/${formId}`}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/f/${formId}`,
                        );
                        toast.success("Lien copié !");
                      }}
                    >
                      Copier
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
