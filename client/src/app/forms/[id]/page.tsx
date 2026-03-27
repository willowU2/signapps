"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { AppLayout } from "@/components/layout/app-layout"
import { formsApi } from "@/lib/api/forms"
import type { Form, FormField } from "@/lib/api/forms"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Save, Trash2, GripVertical, Eye, Type, List, CheckSquare, Calendar, Hash, Mail, Image as ImageIcon, CircleDot } from "lucide-react"
import { useBreadcrumbStore } from "@/lib/store/breadcrumb-store"

export default function FormBuilderPage() {
    const params = useParams()
    const router = useRouter()
    const formId = params.id as string
    const setCustomLabel = useBreadcrumbStore(s => s.setCustomLabel)

    const [form, setForm] = useState<Form | null>(null)
    const [fields, setFields] = useState<FormField[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadForm = async () => {
            try {
                const res = await formsApi.get(formId)
                setForm(res.data)
                setCustomLabel(formId, res.data.title)
                setFields(res.data.fields || [])
            } catch (err) {
                console.error("Failed to load form builder:", err)
                setError("Impossible de charger le formulaire.")
            } finally {
                setLoading(false)
            }
        }
        if (formId) loadForm()
    }, [formId])

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        try {
            // Assigner les bons ordres
            const updatedFields = fields.map((f, i) => ({ ...f, order: i }))
            await formsApi.update(formId, { fields: updatedFields })
            setFields(updatedFields)
            alert("Formulaire sauvegardé avec succès 🎉")
        } catch (err) {
            console.error("Failed to save form:", err)
            setError("Erreur lors de la sauvegarde du formulaire.")
        } finally {
            setSaving(false)
        }
    }

    const addField = (type: FormField['field_type']) => {
        const newField: FormField = {
            id: crypto.randomUUID(),
            label: `Nouveau champ ${fields.length + 1}`,
            field_type: type,
            required: false,
            order: fields.length,
            options: type === 'SingleChoice' || type === 'MultipleChoice' ? ['Option 1'] : undefined
        }
        setFields([...fields, newField])
    }

    const updateField = (id: string, updates: Partial<FormField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
    }

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id))
    }

    const moveField = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === fields.length - 1) return
        
        const newFields = [...fields]
        const swapIndex = direction === 'up' ? index - 1 : index + 1
        const temp = newFields[index]
        newFields[index] = newFields[swapIndex]
        newFields[swapIndex] = temp
        setFields(newFields)
    }

    if (loading) return <AppLayout><div className="flex justify-center p-20">Chargement de l'éditeur...</div></AppLayout>
    if (error || !form) return <AppLayout><div className="p-8 text-destructive">{error || "Formulaire introuvable"}</div></AppLayout>

    return (
        <AppLayout>
            <div className="flex-1 space-y-6 max-w-5xl mx-auto p-4 md:p-8">
                
                {/* Header Navbar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/forms">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold">{form.title}</h1>
                            <p className="text-xs text-muted-foreground">Éditeur de questions</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={`/f/${formId}`} target="_blank">
                                <Eye className="h-4 w-4 mr-2" /> Aperçu public
                            </Link>
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md">
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? "Enregistrement..." : "Sauvegarder"}
                        </Button>
                    </div>
                </div>

                {/* Builder Area */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Fields List */}
                    <div className="flex-1 space-y-4">
                        {fields.length === 0 ? (
                            <div className="border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground bg-muted/20">
                                <Plus className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <h3 className="text-lg font-medium text-foreground mb-1">Votre formulaire est vide</h3>
                                <p className="text-sm">Ajoutez votre première question en utilisant le panneau latéral.</p>
                            </div>
                        ) : (
                            fields.map((field, index) => (
                                <Card key={field.id} className="relative group border-border/60 hover:border-primary/50 transition-colors shadow-sm">
                                    <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col items-center justify-center border-r bg-muted/30 rounded-l-xl opacity-50 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => moveField(index, 'up')} className="p-1 hover:text-primary"><GripVertical className="h-4 w-4" /></button>
                                        <div className="text-xs font-mono font-medium text-muted-foreground my-2">{index + 1}</div>
                                        <button onClick={() => moveField(index, 'down')} className="p-1 hover:text-primary"><GripVertical className="h-4 w-4" /></button>
                                    </div>
                                    <div className="pl-12 p-5">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1 mr-4">
                                                <Input 
                                                    value={field.label}
                                                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                    className="text-lg font-medium border-none shadow-none px-0 h-auto focus-visible:ring-0 focus-visible:bg-muted/50 rounded-sm"
                                                    placeholder="Titre de la question"
                                                />
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => removeField(field.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Type de champ</Label>
                                                <Select value={field.field_type} onValueChange={(val: any) => updateField(field.id, { field_type: val })}>
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Text">Texte court</SelectItem>
                                                        <SelectItem value="TextArea">Paragraphe</SelectItem>
                                                        <SelectItem value="Number">Nombre</SelectItem>
                                                        <SelectItem value="Email">Email</SelectItem>
                                                        <SelectItem value="SingleChoice">Choix unique (Radio)</SelectItem>
                                                        <SelectItem value="MultipleChoice">Cases à cocher</SelectItem>
                                                        <SelectItem value="Date">Date</SelectItem>
                                                        <SelectItem value="File">Fichier</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            
                                            {(field.field_type === 'Text' || field.field_type === 'TextArea' || field.field_type === 'Number' || field.field_type === 'Email') && (
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-muted-foreground">Texte indicatif (Placeholder)</Label>
                                                    <Input 
                                                        className="h-9 text-sm"
                                                        value={field.placeholder || ''} 
                                                        onChange={e => updateField(field.id, { placeholder: e.target.value })} 
                                                        placeholder="Ex: Saisissez votre réponse ici..."
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {(field.field_type === 'SingleChoice' || field.field_type === 'MultipleChoice') && (
                                            <div className="space-y-4 mb-4 bg-muted/20 p-3 rounded-md border">
                                                <div>
                                                    <Label className="text-xs font-semibold text-muted-foreground mb-2 block">Options disponibles (séparées par une virgule)</Label>
                                                    <Input 
                                                        className="h-9 text-sm bg-background"
                                                        value={field.options?.join(', ') || ''}
                                                        onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                        placeholder="Option A, Option B, Option C"
                                                    />
                                                    <p className="text-[10px] text-muted-foreground mt-1">Les choix s'afficheront sous forme de boutons radio ou de cases à cocher.</p>
                                                </div>
                                                
                                                {field.field_type === 'SingleChoice' && (
                                                    <div>
                                                        <Label className="text-xs font-semibold text-muted-foreground mb-2 block">Style d'affichage</Label>
                                                        <Select 
                                                            value={field.layout || 'auto'} 
                                                            onValueChange={(val) => updateField(field.id, { layout: val === 'auto' ? undefined : val })}
                                                        >
                                                            <SelectTrigger className="h-9 text-sm bg-background">
                                                                <SelectValue placeholder="Sélectionner un style" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="auto">🌟 Automatique (Recommandé)</SelectItem>
                                                                <SelectItem value="advanced-2">Grandes Cartes de Tarification</SelectItem>
                                                                <SelectItem value="layout-3">Grille Compacte (2 colonnes)</SelectItem>
                                                                <SelectItem value="standard-2">Liste Verticale Classique</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="text-[10px] text-muted-foreground mt-1">L'affichage automatique s'adapte en fonction du nombre de choix.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end border-t pt-3 mt-2">
                                            <div className="flex items-center space-x-2">
                                                <Switch 
                                                    id={`req-${field.id}`} 
                                                    checked={field.required} 
                                                    onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                                                />
                                                <Label htmlFor={`req-${field.id}`} className="text-sm cursor-pointer">Champ obligatoire</Label>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* Toolbar Sidebar */}
                    <div className="w-full lg:w-72 shrink-0">
                        <div className="sticky top-6">
                            <Card className="shadow-lg border-border/50 bg-card/60 backdrop-blur-md">
                                <CardHeader className="pb-3 border-b">
                                    <CardTitle className="text-md">Outils</CardTitle>
                                    <CardDescription>Ajoutez des champs au formulaire</CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 grid grid-cols-2 gap-2">
                                    <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('Text')}>
                                        <Type className="h-4 w-4 mr-2 text-blue-500" />
                                        <span className="text-xs">Texte Court</span>
                                    </Button>
                                    <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('TextArea')}>
                                        <List className="h-4 w-4 mr-2 text-indigo-500" />
                                        <span className="text-xs">Paragraphe</span>
                                    </Button>
                                    <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('SingleChoice')}>
                                        <CircleDot className="h-4 w-4 mr-2 text-emerald-500" />
                                        <span className="text-xs">Choix unique</span>
                                    </Button>
                                    <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('MultipleChoice')}>
                                        <CheckSquare className="h-4 w-4 mr-2 text-emerald-500" />
                                        <span className="text-xs">Choix multiple</span>
                                    </Button>
                                    <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('Number')}>
                                        <Hash className="h-4 w-4 mr-2 text-orange-500" />
                                        <span className="text-xs">Nombre</span>
                                    </Button>
                                    <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('Email')}>
                                        <Mail className="h-4 w-4 mr-2 text-sky-500" />
                                        <span className="text-xs">Email</span>
                                    </Button>
                                    <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('Date')}>
                                        <Calendar className="h-4 w-4 mr-2 text-rose-500" />
                                        <span className="text-xs">Date</span>
                                    </Button>
                                    <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50 col-span-2" onClick={() => addField('File')}>
                                        <ImageIcon className="h-4 w-4 mr-2 text-fuchsia-500" />
                                        <span className="text-xs">Upload Fichier</span>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

            </div>
        </AppLayout>
    )
}
