"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
    FileText, Plus, Edit, Trash, Eye, Globe, Link, Send, FileX, BarChart3
} from "lucide-react"

interface Form {
    id: string
    title: string
    description: string
    status: "draft" | "published"
    response_count: number
    created_at: string
    public_url?: string
}

interface FormResponse {
    id: string
    form_id: string
    form_title: string
    submitted_at: string
    data: Record<string, string>
}

import { formsApi } from "@/lib/api/forms"

export default function FormsPage() {
    const [forms, setForms] = useState<Form[]>([])
    const [responses, setResponses] = useState<FormResponse[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingForm, setEditingForm] = useState<Form | null>(null)
    const [newTitle, setNewTitle] = useState("")
    const [newDescription, setNewDescription] = useState("")
    const [copiedId, setCopiedId] = useState<string | null>(null)

    useEffect(() => {
        loadForms()
    }, [])

    const loadForms = async () => {
        try {
            const res = await formsApi.list()
            const mapped = res.data.map((f: any) => ({
                id: f.id,
                title: f.title,
                description: f.description || "",
                status: (f.is_published ? "published" : "draft") as "published" | "draft",
                response_count: 0,
                created_at: f.created_at,
                public_url: f.is_published ? `${window.location.origin}/f/${f.id}` : undefined
            }))
            setForms(mapped)
        } catch (e) {
            console.error("Failed to load forms", e)
        }
    }

    const openCreate = () => {
        setEditingForm(null)
        setNewTitle("")
        setNewDescription("")
        setIsDialogOpen(true)
    }

    const openEdit = (form: Form) => {
        setEditingForm(form)
        setNewTitle(form.title)
        setNewDescription(form.description)
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        if (!newTitle.trim()) return
        if (editingForm) {
            try {
                await formsApi.update(editingForm.id, { title: newTitle, description: newDescription })
                loadForms(); setIsDialogOpen(false); return 
            } catch (e) {
                console.error("Failed to update form", e)
            }
        } else {
            try {
                await formsApi.create({ title: newTitle, description: newDescription, fields: [] })
                loadForms(); setIsDialogOpen(false); return 
            } catch (e) {
                console.error("Failed to create form", e)
            }
        }
    }

    const togglePublish = async (form: Form) => {
        if (form.status === "draft") {
            try {
                await formsApi.publish(form.id)
                loadForms(); return 
            } catch (e) {
                console.error("Failed to publish form", e)
            }
        } else {
            // Actuellement l'API backend ne supporte pas unpublish, on peut l'ignorer ou simuler localement
            console.warn("Unpublish is not supported by API yet")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce formulaire ?")) return
        try {
            await formsApi.delete(id)
            loadForms(); return 
        } catch (e) {
            console.error("Failed to delete form", e)
        }
    }

    const copyLink = (form: Form) => {
        const url = form.public_url ?? `${window.location.origin}/f/${form.id}`
        navigator.clipboard.writeText(url).catch(() => {})
        setCopiedId(form.id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const publishedCount = forms.filter(f => f.status === "published").length
    const totalResponses = forms.reduce((acc, f) => acc + f.response_count, 0)

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
                            <FileText className="h-8 w-8 text-primary" />
                            Formulaires
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">Créez et gérez vos formulaires en ligne.</p>
                    </div>
                    <Button onClick={openCreate} className="shadow-lg shadow-primary/20">
                        <Plus className="h-4 w-4 mr-2" />
                        Nouveau Formulaire
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        { label: "Total", value: forms.length, icon: FileText, gradient: "from-blue-500 to-indigo-500" },
                        { label: "Publiés", value: publishedCount, icon: Globe, gradient: "from-emerald-500 to-teal-500" },
                        { label: "Réponses", value: totalResponses, icon: BarChart3, gradient: "from-purple-500 to-fuchsia-500" },
                    ].map(({ label, value, icon: Icon, gradient }) => (
                        <Card key={label} className="border-border/50 bg-card overflow-hidden relative group">
                            <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${gradient} transform translate-y-1 group-hover:translate-y-0 transition-transform`} />
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
                        <TabsTrigger value="responses">Réponses</TabsTrigger>
                    </TabsList>

                    <TabsContent value="forms" className="mt-4">
                        {forms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                                <FileX className="h-12 w-12 opacity-30" />
                                <p className="text-sm">Aucun formulaire. Créez-en un !</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {forms.map(form => (
                                    <Card key={form.id} className="border-border/50 bg-card hover:shadow-md transition-shadow">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                                                    {form.title}
                                                </CardTitle>
                                                <Badge variant={form.status === "published" ? "default" : "secondary"} className="shrink-0 text-xs">
                                                    {form.status === "published" ? "Publié" : "Brouillon"}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{form.description}</p>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Send className="h-3 w-3" />
                                                    {form.response_count} réponse{form.response_count !== 1 ? "s" : ""}
                                                </span>
                                                <span>{new Date(form.created_at).toLocaleDateString("fr-FR")}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" onClick={() => openEdit(form)}>
                                                    <Edit className="h-3 w-3 mr-1" /> Éditer
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => togglePublish(form)}>
                                                    <Globe className="h-3 w-3 mr-1" />
                                                    {form.status === "published" ? "Dépublier" : "Publier"}
                                                </Button>
                                                <Button size="sm" variant="outline">
                                                    <Eye className="h-3 w-3 mr-1" /> Réponses
                                                </Button>
                                                {form.status === "published" && (
                                                    <Button size="sm" variant="outline" onClick={() => copyLink(form)}>
                                                        <Link className="h-3 w-3 mr-1" />
                                                        {copiedId === form.id ? "Copié !" : "Copier le lien"}
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(form.id)}>
                                                    <Trash className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="responses" className="mt-4">
                        {responses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                                <BarChart3 className="h-12 w-12 opacity-30" />
                                <p className="text-sm">Aucune réponse pour le moment.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {responses.map(r => (
                                    <Card key={r.id} className="border-border/50">
                                        <CardContent className="py-3 flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-medium">{r.form_title}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(r.submitted_at).toLocaleString("fr-FR")}</p>
                                            </div>
                                            <Button size="sm" variant="outline"><Eye className="h-3 w-3 mr-1" /> Voir</Button>
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingForm ? "Modifier le formulaire" : "Nouveau formulaire"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label htmlFor="form-title">Titre</Label>
                            <Input id="form-title" placeholder="Mon formulaire..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="form-desc">Description</Label>
                            <Textarea id="form-desc" placeholder="Description optionnelle..." rows={3} value={newDescription} onChange={e => setNewDescription(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                        <Button onClick={handleSave} disabled={!newTitle.trim()}>
                            {editingForm ? "Enregistrer" : "Créer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    )
}
