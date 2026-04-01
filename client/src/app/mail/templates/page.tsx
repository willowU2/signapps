"use client"

import React, { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"
import { usePageTitle } from "@/hooks/use-page-title"
import { mailApi, type MailTemplate, type CreateMailTemplateRequest } from "@/lib/api/mail"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Plus, Search, Pencil, Trash2, Eye, X, Variable, FileText, ArrowLeft } from "lucide-react"
import Link from "next/link"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseVariables(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string")
  if (typeof raw === "string") {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
}

function substituteVariables(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MailTemplatesPage() {
  usePageTitle("Modèles d'email")
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MailTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MailTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<MailTemplate | null>(null)
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({})

  // Form state
  const [formName, setFormName] = useState("")
  const [formSubject, setFormSubject] = useState("")
  const [formBody, setFormBody] = useState("")
  const [formVariables, setFormVariables] = useState("")
  const [formAccountId, setFormAccountId] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: templates = [], isLoading, isError } = useQuery<MailTemplate[]>({
    queryKey: ["mail", "templates"],
    queryFn: async () => {
      const res = await mailApi.listTemplates({ limit: 200 })
      return (res.data as MailTemplate[] | null) ?? []
    },
    retry: 1,
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return templates
    return templates.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
    )
  }, [templates, search])

  // ── Form helpers ────────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormName("")
    setFormSubject("")
    setFormBody("")
    setFormVariables("")
    setFormAccountId("")
    setEditingTemplate(null)
  }

  const openCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEdit = (t: MailTemplate) => {
    setEditingTemplate(t)
    setFormName(t.name)
    setFormSubject(t.subject ?? "")
    setFormBody(t.body_html ?? "")
    setFormVariables(parseVariables(t.variables).join(", "))
    setFormAccountId(t.account_id)
    setIsFormOpen(true)
  }

  const openPreview = (t: MailTemplate) => {
    const vars = parseVariables(t.variables)
    const initial: Record<string, string> = {}
    vars.forEach(v => { initial[v] = "" })
    setPreviewValues(initial)
    setPreviewTemplate(t)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return
    setIsSaving(true)
    const variables = formVariables
      .split(",")
      .map(v => v.trim())
      .filter(Boolean)
    const payload: CreateMailTemplateRequest = {
      account_id: formAccountId || "default",
      name: formName.trim(),
      subject: formSubject.trim(),
      body_html: formBody,
      variables,
    }
    try {
      if (editingTemplate) {
        await mailApi.updateTemplate(editingTemplate.id, payload)
        toast.success("Modèle mis à jour.")
      } else {
        await mailApi.createTemplate(payload)
        toast.success("Modèle créé.")
      }
      queryClient.invalidateQueries({ queryKey: ["mail", "templates"] })
      setIsFormOpen(false)
      resetForm()
    } catch {
      toast.error("Impossible d'enregistrer le modèle.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    try {
      await mailApi.deleteTemplate(id)
      queryClient.invalidateQueries({ queryKey: ["mail", "templates"] })
      toast.success("Modèle supprimé.")
    } catch {
      toast.error("Impossible de supprimer le modèle.")
    }
  }

  // ── Preview variable detection ───────────────────────────────────────────────
  const detectedVars = useMemo(() => {
    if (!previewTemplate) return []
    const fromVars = parseVariables(previewTemplate.variables)
    const fromBody = [...(previewTemplate.body_html ?? "").matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])
    return [...new Set([...fromVars, ...fromBody])]
  }, [previewTemplate])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/mail/settings">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Modèles d&apos;email
              </h1>
              <p className="text-sm text-muted-foreground">
                Gérez vos modèles d&apos;email réutilisables avec variables dynamiques.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau modèle
          </Button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Rechercher un modèle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Error */}
        {isError && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            Service mail indisponible — impossible de charger les modèles.
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        )}

        {/* Template grid */}
        {!isLoading && (
          <>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-base font-medium">
                  {search ? `Aucun modèle pour « ${search} »` : "Aucun modèle créé"}
                </p>
                {!search && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Créez votre premier modèle pour accélérer la rédaction.
                  </p>
                )}
                {!search && (
                  <Button className="mt-4" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un modèle
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map(t => {
                  const vars = parseVariables(t.variables)
                  return (
                    <Card key={t.id} className="border-border/50 group">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">
                            {t.name}
                          </CardTitle>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Aperçu"
                              onClick={() => openPreview(t)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Modifier"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Supprimer"
                              onClick={() => setDeleteTarget(t)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {t.subject && (
                          <p className="text-xs text-muted-foreground truncate">
                            <span className="font-medium text-foreground">Objet : </span>
                            {t.subject}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {t.body_html?.replace(/<[^>]+>/g, " ").trim() || "—"}
                        </p>
                        {vars.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {vars.map(v => (
                              <Badge key={v} variant="outline" className="h-5 gap-1 px-1.5 text-xs">
                                <Variable className="h-2.5 w-2.5" />
                                {v}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={isFormOpen} onOpenChange={open => { if (!open) { setIsFormOpen(false); resetForm() } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Modifier le modèle" : "Nouveau modèle d'email"}
            </DialogTitle>
            <DialogDescription>
              Utilisez {`{{variable}}`} dans l&apos;objet ou le corps pour créer des variables dynamiques.
            </DialogDescription>
          </DialogHeader>

          <form id="template-form" onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nom du modèle <span className="text-destructive">*</span></Label>
              <Input
                id="tpl-name"
                required
                autoFocus
                placeholder="Ex : Relance prospect"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-subject">Objet</Label>
              <Input
                id="tpl-subject"
                placeholder="Ex : Suivi de votre demande — {{entreprise}}"
                value={formSubject}
                onChange={e => setFormSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Corps (HTML accepté)</Label>
              <Textarea
                id="tpl-body"
                rows={8}
                placeholder={"Bonjour {{prenom}},\n\nMerci pour votre intérêt..."}
                value={formBody}
                onChange={e => setFormBody(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-vars" className="flex items-center gap-1.5">
                <Variable className="h-3.5 w-3.5" />
                Variables (séparées par des virgules)
              </Label>
              <Input
                id="tpl-vars"
                placeholder="Ex : prenom, entreprise, date"
                value={formVariables}
                onChange={e => setFormVariables(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ces variables peuvent être substituées lors de l&apos;envoi. Syntaxe dans le corps : {`{{variable}}`}
              </p>
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsFormOpen(false); resetForm() }}>
              Annuler
            </Button>
            <Button type="submit" form="template-form" disabled={isSaving || !formName.trim()}>
              {isSaving ? "Enregistrement..." : editingTemplate ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewTemplate !== null} onOpenChange={open => { if (!open) setPreviewTemplate(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Aperçu — {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Renseignez les valeurs pour visualiser le rendu final.
            </DialogDescription>
          </DialogHeader>

          {detectedVars.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Variables</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {detectedVars.map(v => (
                  <div key={v} className="flex items-center gap-2">
                    <Label htmlFor={`prev-${v}`} className="w-24 shrink-0 text-xs">{v}</Label>
                    <Input
                      id={`prev-${v}`}
                      className="h-7 text-xs"
                      placeholder={`{{${v}}}`}
                      value={previewValues[v] ?? ""}
                      onChange={e => setPreviewValues(p => ({ ...p, [v]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewTemplate && (
            <div className="rounded-md border bg-background">
              {previewTemplate.subject && (
                <div className="border-b px-4 py-2.5 text-sm">
                  <span className="font-medium">Objet : </span>
                  {substituteVariables(previewTemplate.subject, previewValues)}
                </div>
              )}
              <div
                className="p-4 text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: substituteVariables(previewTemplate.body_html ?? "", previewValues),
                }}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>Fermer</Button>
            {previewTemplate && (
              <Button variant="secondary" onClick={() => { setPreviewTemplate(null); openEdit(previewTemplate) }}>
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce modèle ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>Supprimer <strong>{deleteTarget.name}</strong> ? Cette action est irréversible.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
