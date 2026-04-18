"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormsListResponse } from "@/lib/server/forms";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Edit,
  Trash,
  Eye,
  Globe,
  Link as LinkIcon,
  Send,
  FileX,
  BarChart3,
  Calendar,
  UserRound,
  MessageSquare,
  ClipboardCheck,
  Star,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

interface Form {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  response_count: number;
  created_at: string;
  public_url?: string;
}

interface FormResponse {
  id: string;
  form_id: string;
  form_title: string;
  submitted_at: string;
  data: Record<string, string>;
}

import { formsApi } from "@/lib/api/forms";
import type { FieldType } from "@/lib/api/forms";
import { toast } from "sonner";
import { EntityLinks } from "@/components/crosslinks/EntityLinks";
import {
  FormResponseToContact,
  FormResponseToSheet,
} from "@/components/interop/forms-contacts-bridge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Templates catalogue
// ---------------------------------------------------------------------------

interface FormTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  fields: Array<{
    label: string;
    field_type: FieldType;
    required: boolean;
    options?: string[];
  }>;
}

const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "contact",
    title: "Formulaire de contact",
    description: "Collectez les coordonnées et messages de vos visiteurs",
    icon: UserRound,
    color: "text-blue-500",
    fields: [
      { label: "Nom complet", field_type: "Text", required: true },
      { label: "Adresse email", field_type: "Email", required: true },
      { label: "Sujet", field_type: "Text", required: false },
      { label: "Message", field_type: "TextArea", required: true },
    ],
  },
  {
    id: "feedback",
    title: "Sondage de satisfaction",
    description:
      "Recueillez l'avis de vos clients sur vos produits ou services",
    icon: Star,
    color: "text-amber-500",
    fields: [
      {
        label: "Comment évaluez-vous notre service ?",
        field_type: "SingleChoice",
        required: true,
        options: ["Excellent", "Bien", "Correct", "À améliorer", "Mauvais"],
      },
      {
        label: "Recommanderiez-vous nos services ?",
        field_type: "SingleChoice",
        required: true,
        options: ["Oui, certainement", "Probablement", "Pas sûr(e)", "Non"],
      },
      { label: "Vos commentaires", field_type: "TextArea", required: false },
      { label: "Email (optionnel)", field_type: "Email", required: false },
    ],
  },
  {
    id: "registration",
    title: "Formulaire d'inscription",
    description: "Inscriptions à un événement, une formation ou un webinaire",
    icon: ClipboardCheck,
    color: "text-emerald-500",
    fields: [
      { label: "Prénom", field_type: "Text", required: true },
      { label: "Nom", field_type: "Text", required: true },
      { label: "Email professionnel", field_type: "Email", required: true },
      { label: "Entreprise", field_type: "Text", required: false },
      { label: "Date de préférence", field_type: "Date", required: false },
      {
        label: "Commentaires ou questions",
        field_type: "TextArea",
        required: false,
      },
    ],
  },
  {
    id: "survey",
    title: "Sondage d'équipe",
    description: "Collectez des retours internes : humeur, besoins, idées",
    icon: MessageSquare,
    color: "text-violet-500",
    fields: [
      {
        label: "Comment vous sentez-vous cette semaine ?",
        field_type: "SingleChoice",
        required: true,
        options: ["Très bien", "Bien", "Neutre", "Pas super", "Mal"],
      },
      {
        label: "Quels sujets souhaitez-vous aborder ?",
        field_type: "MultipleChoice",
        required: false,
        options: ["Organisation", "Technique", "RH", "Stratégie", "Autre"],
      },
      { label: "Vos suggestions", field_type: "TextArea", required: false },
    ],
  },
];

interface FormsListClientProps {
  /** Server-prefetched forms + response counts used to seed TanStack. */
  initialList: FormsListResponse;
}

export function FormsListClient({ initialList }: FormsListClientProps) {
  usePageTitle("Formulaires");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [responses] = useState<FormResponse[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteFormId, setDeleteFormId] = useState<string | null>(null);

  // Transform the server-prefetched shell into the UI `Form` shape.  Runs
  // once (memoised) and is handed to TanStack as `initialData` so the first
  // paint already renders the full table — no loading flicker.
  const seededForms = useMemo<Form[]>(() => {
    if (initialList.forms.length === 0) return [];
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return initialList.forms.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description || "",
      status: (f.is_published ? "published" : "draft") as "published" | "draft",
      response_count: initialList.responseCounts[f.id] ?? 0,
      created_at: f.created_at,
      public_url: f.is_published && origin ? `${origin}/f/${f.id}` : undefined,
    }));
  }, [initialList]);

  const { data: forms = [], isLoading: formsLoading } = useQuery<Form[]>({
    queryKey: ["forms"],
    initialData: seededForms.length > 0 ? seededForms : undefined,
    queryFn: async () => {
      // 2 parallel requests instead of 1 + N (was: list + N× responses(f.id)).
      // The bulk endpoint returns { form_id: count } for all owned forms.
      // Graceful fallback to empty counts if the bulk endpoint fails.
      const [listRes, countsRes] = await Promise.all([
        formsApi.list(),
        formsApi
          .responseCounts()
          .catch(() => ({ data: {} as Record<string, number> })),
      ]);
      const counts = countsRes.data ?? {};
      return listRes.data.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description || "",
        status: (f.is_published ? "published" : "draft") as
          | "published"
          | "draft",
        response_count: counts[f.id] ?? 0,
        created_at: f.created_at,
        public_url: f.is_published
          ? `${window.location.origin}/f/${f.id}`
          : undefined,
      }));
    },
  });

  const loadForms = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["forms"] });
  }, [queryClient]);

  const openCreate = () => {
    setEditingForm(null);
    setNewTitle("");
    setNewDescription("");
    setIsDialogOpen(true);
  };

  const openEdit = (form: Form) => {
    setEditingForm(form);
    setNewTitle(form.title);
    setNewDescription(form.description);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!newTitle.trim()) return;
    if (editingForm) {
      try {
        await formsApi.update(editingForm.id, {
          title: newTitle,
          description: newDescription,
        });
        toast.success("Formulaire mis à jour");
        loadForms();
        setIsDialogOpen(false);
        return;
      } catch (e) {
        console.error("Impossible de mettre à jour form", e);
        toast.error("Échec de la mise à jour du formulaire");
      }
    } else {
      try {
        const res = await formsApi.create({
          title: newTitle,
          description: newDescription,
          fields: [],
        });
        setIsDialogOpen(false);
        toast.success("Formulaire créé");
        if (res.data && res.data.id) {
          router.push(`/forms/${res.data.id}`);
        } else {
          loadForms();
        }
      } catch (e) {
        console.error("Impossible de créer form", e);
        toast.error("Échec de la création du formulaire");
      }
    }
  };

  const togglePublish = async (form: Form) => {
    if (form.status === "draft") {
      try {
        await formsApi.publish(form.id);
        loadForms();
        return;
      } catch (e) {
        console.error("Failed to publish form", e);
        toast.error("Échec de la publication du formulaire");
      }
    } else {
      try {
        await formsApi.unpublish(form.id);
        loadForms();
        return;
      } catch (e) {
        console.error("Failed to unpublish form", e);
        toast.error("Échec de la dépublication du formulaire");
      }
    }
  };

  const handleDelete = (id: string) => {
    setDeleteFormId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteFormId) return;
    setDeleteFormId(null);
    try {
      await formsApi.delete(deleteFormId);
      toast.success("Formulaire supprimé");
      loadForms();
    } catch (e) {
      console.error("Impossible de supprimer form", e);
      toast.error("Échec de la suppression du formulaire");
    }
  };

  const copyLink = (form: Form) => {
    const url = form.public_url ?? `${window.location.origin}/f/${form.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(form.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const createFromTemplate = async (tpl: FormTemplate) => {
    try {
      const res = await formsApi.create({
        title: tpl.title,
        description: tpl.description,
        fields: tpl.fields.map((f, i) => ({
          id: crypto.randomUUID(),
          label: f.label,
          field_type: f.field_type,
          required: f.required,
          options: f.options,
          order: i,
        })),
      });
      toast.success(`Formulaire créé depuis le modèle "${tpl.title}"`);
      if (res.data?.id) router.push(`/forms/${res.data.id}`);
      else loadForms();
    } catch (e) {
      console.error("Impossible de créer depuis le modèle", e);
      toast.error("Échec de la création depuis le modèle");
    }
  };

  const publishedCount = forms.filter((f) => f.status === "published").length;
  const totalResponses = forms.reduce((acc, f) => acc + f.response_count, 0);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-full min-w-0">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Formulaires
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Créez et gérez vos formulaires en ligne.
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="shadow-lg shadow-primary/20"
            data-testid="forms-new-button"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Formulaire
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Total",
              value: forms.length,
              icon: FileText,
              gradient: "from-blue-500 to-indigo-500",
            },
            {
              label: "Publiés",
              value: publishedCount,
              icon: Globe,
              gradient: "from-emerald-500 to-teal-500",
            },
            {
              label: "Réponses",
              value: totalResponses,
              icon: BarChart3,
              gradient: "from-purple-500 to-fuchsia-500",
            },
          ].map(({ label, value, icon: Icon, gradient }) => (
            <Card
              key={label}
              className="border-border/50 bg-card overflow-hidden relative group"
            >
              <div
                className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${gradient} transform translate-y-1 group-hover:translate-y-0 transition-transform`}
              />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="forms">
          <TabsList>
            <TabsTrigger value="forms">Mes Formulaires</TabsTrigger>
            <TabsTrigger value="templates">Modèles</TabsTrigger>
            <TabsTrigger value="responses">Réponses</TabsTrigger>
          </TabsList>

          <TabsContent value="forms" className="mt-4">
            {formsLoading ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card
                    key={i}
                    className="border-border/50 bg-card overflow-hidden"
                  >
                    <CardHeader className="pb-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-full mt-2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : forms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <FileX className="h-12 w-12 opacity-30" />
                <p className="text-sm">Aucun formulaire. Créez-en un !</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {forms.map((form) => (
                  <Card
                    key={form.id}
                    className="border-border/50 bg-card hover:shadow-md transition-shadow min-w-0 overflow-hidden flex flex-col"
                    data-testid={`forms-list-item-${form.id}`}
                    data-form-status={form.status}
                    data-form-title={form.title}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                          {form.title}
                        </CardTitle>
                        <Badge
                          variant={
                            form.status === "published"
                              ? "default"
                              : "secondary"
                          }
                          className="shrink-0 text-xs"
                        >
                          {form.status === "published" ? "Publié" : "Brouillon"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {form.description}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1 flex flex-col justify-end">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          {form.response_count} réponse
                          {form.response_count !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(form.created_at).toLocaleDateString(
                            "fr-FR",
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full text-xs"
                          asChild
                          data-testid={`forms-list-item-edit-${form.id}`}
                        >
                          <Link href={`/forms/${form.id}`}>
                            <Edit className="h-3 w-3 mr-1" /> Éditeur
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs whitespace-nowrap overflow-hidden text-ellipsis px-2"
                          onClick={() => openEdit(form)}
                        >
                          Paramètres
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`w-full text-xs ${form.status === "draft" ? "col-span-2" : ""}`}
                          onClick={() => togglePublish(form)}
                          data-testid={`forms-list-item-publish-${form.id}`}
                        >
                          <Globe className="h-3 w-3 mr-1" />
                          {form.status === "published"
                            ? "Dépublier"
                            : "Publier"}
                        </Button>
                        {form.status === "published" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs"
                            onClick={() => copyLink(form)}
                          >
                            <LinkIcon className="h-3 w-3 mr-1" />
                            {copiedId === form.id ? "Copié" : "Lien"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="col-span-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 mt-1"
                          onClick={() => handleDelete(form.id)}
                          data-testid={`forms-list-item-delete-${form.id}`}
                        >
                          <Trash className="h-3 w-3 mr-1" /> Mettre à la
                          corbeille
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Templates tab */}
          <TabsContent value="templates" className="mt-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {FORM_TEMPLATES.map((tpl) => (
                <Card
                  key={tpl.id}
                  className="border-border/50 bg-card hover:shadow-md transition-shadow flex flex-col"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <tpl.icon className={`h-5 w-5 ${tpl.color}`} />
                      <CardTitle className="text-base font-semibold leading-tight">
                        {tpl.title}
                      </CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tpl.description}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col justify-end">
                    <p className="text-xs text-muted-foreground mb-3">
                      {tpl.fields.length} champs prédéfinis
                    </p>
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => createFromTemplate(tpl)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Utiliser ce modèle
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="responses" className="mt-4">
            {responses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <BarChart3 className="h-12 w-12 opacity-30" />
                <p className="text-sm">Aucune réponse pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {responses.map((r) => (
                  <Card key={r.id} className="border-border/50">
                    <CardContent className="py-3 flex justify-between items-center gap-2">
                      <div>
                        <p className="text-sm font-medium">{r.form_title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.submitted_at).toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Ideas 1+2: Create contact or push to Sheets */}
                        <FormResponseToContact response={r} />
                        <FormResponseToSheet response={r} />
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3 mr-1" /> Voir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="form-create-dialog">
          <DialogHeader>
            <DialogTitle>
              {editingForm ? "Modifier le formulaire" : "Nouveau formulaire"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="form-title">Titre</Label>
              <Input
                id="form-title"
                placeholder="Mon formulaire..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                data-testid="form-create-dialog-title"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="form-desc">Description</Label>
              <Textarea
                id="form-desc"
                placeholder="Description optionnelle..."
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                data-testid="form-create-dialog-description"
              />
            </div>
            {editingForm && (
              <div className="border-t pt-4">
                <EntityLinks entityType="form" entityId={editingForm.id} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={!newTitle.trim()}
              data-testid="form-create-dialog-submit"
            >
              {editingForm ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteFormId}
        onOpenChange={() => setDeleteFormId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mettre ce formulaire à la corbeille ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              data-testid="forms-delete-confirm"
            >
              Mettre à la corbeille
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
