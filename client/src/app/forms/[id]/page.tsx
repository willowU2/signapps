"use client"

import { useEffect, useState, lazy, Suspense } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AppLayout } from "@/components/layout/app-layout"
import { formsApi } from "@/lib/api/forms"
import type { Form, FormField } from "@/lib/api/forms"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    ArrowLeft, Plus, Save, Trash2, GripVertical, Eye, Type, List, CheckSquare,
    Calendar, Hash, Mail, Image as ImageIcon, CircleDot, ChevronUp, ChevronDown,
    PenLine, Layers, BarChart3, Settings, Palette
} from "lucide-react"
import { toast } from "sonner"
import { useBreadcrumbStore } from "@/lib/store/breadcrumb-store"
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ConditionalLogicEditor, type ConditionGroup } from "@/components/forms/conditional-logic-editor"
import { ScoringEditor } from "@/components/forms/scoring-editor"
import { ResponseAnalytics } from "@/components/forms/response-analytics"
import { ExportResponses } from "@/components/forms/export-responses"
import { FormBrandingPanel } from "@/components/forms/form-branding-panel"
import { useQuery } from "@tanstack/react-query"

// Extended FormField type to handle new properties
type ExtendedFormField = FormField & {
    show_if?: ConditionGroup
    scores?: Record<string, number>
    page?: number
}

interface SortableFieldProps {
    field: ExtendedFormField
    index: number
    allFields: ExtendedFormField[]
    updateField: (id: string, updates: Partial<ExtendedFormField>) => void
    removeField: (id: string) => void
    quizMode: boolean
}

function SortableField({ field, index, allFields, updateField, removeField, quizMode }: SortableFieldProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: field.id,
        data: { type: 'form-field' }
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
        opacity: isDragging ? 0.8 : 1,
    }

    // PageBreak sentinel
    if (field.field_type === 'PageBreak') {
        return (
            <div ref={setNodeRef} style={style} {...attributes} {...listeners}
                className="flex items-center gap-3 py-3 cursor-grab">
                <div className="flex-1 border-t-2 border-dashed border-primary/40" />
                <span className="text-xs font-medium text-primary/60 px-2 border border-dashed border-primary/40 rounded-full">
                    — Saut de page —
                </span>
                <div className="flex-1 border-t-2 border-dashed border-primary/40" />
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/50 hover:text-destructive" onClick={() => removeField(field.id)}>
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        )
    }

    return (
        <Card ref={setNodeRef} style={style} className={`relative group border-border/60 hover:border-primary/50 transition-colors shadow-sm bg-card ${isDragging ? 'shadow-lg border-primary outline outline-1 outline-primary' : ''}`}>
            {/* DRAG HANDLE */}
            <div
                {...attributes}
                {...listeners}
                className="absolute left-0 top-0 bottom-0 w-8 flex flex-col items-center justify-center border-r bg-muted/30 rounded-l-xl opacity-50 group-hover:opacity-100 transition-opacity cursor-grab hover:bg-muted/50 active:cursor-grabbing"
            >
                <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                <div className="text-[10px] font-mono font-medium text-muted-foreground my-2 select-none">{index + 1}</div>
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
                        />
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => removeField(field.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Type de champ</Label>
                        <Select value={field.field_type} onValueChange={(val) => updateField(field.id, { field_type: val as FormField['field_type'] })}>
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
                                <SelectItem value="Signature">Signature</SelectItem>
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
                            <Label className="text-xs font-semibold text-muted-foreground mb-2 block">Options disponibles</Label>
                            <div className="space-y-2">
                                {(field.options || []).map((opt, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <Input
                                            className="h-9 text-sm bg-background flex-1"
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...(field.options || [])]
                                                newOpts[i] = e.target.value
                                                updateField(field.id, { options: newOpts })
                                            }}
                                            placeholder={`Option ${i + 1}`}
                                        />
                                        <div className="flex bg-muted/50 rounded-md border">
                                            <Button
                                                variant="ghost" size="icon"
                                                disabled={i === 0}
                                                onClick={() => {
                                                    const newOpts = [...(field.options || [])]
                                                    ;[newOpts[i], newOpts[i - 1]] = [newOpts[i - 1], newOpts[i]]
                                                    updateField(field.id, { options: newOpts })
                                                }}
                                                className="h-9 w-7 rounded-none rounded-l-md hover:bg-muted"
                                            >
                                                <ChevronUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon"
                                                disabled={i === (field.options?.length || 0) - 1}
                                                onClick={() => {
                                                    const newOpts = [...(field.options || [])]
                                                    ;[newOpts[i], newOpts[i + 1]] = [newOpts[i + 1], newOpts[i]]
                                                    updateField(field.id, { options: newOpts })
                                                }}
                                                className="h-9 w-7 rounded-none border-l hover:bg-muted"
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <Button
                                            variant="ghost" size="icon"
                                            onClick={() => {
                                                const newOpts = [...(field.options || [])]
                                                newOpts.splice(i, 1)
                                                updateField(field.id, { options: newOpts })
                                            }}
                                            className="h-9 w-9 text-destructive/70 hover:text-destructive hover:bg-destructive/10 ml-1"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline" size="sm"
                                    className="mt-2 text-xs border-dashed"
                                    onClick={() => {
                                        const newOpts = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`]
                                        updateField(field.id, { options: newOpts })
                                    }}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Ajouter une option
                                </Button>
                            </div>
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
                                        <SelectItem value="auto">Automatique (Recommandé)</SelectItem>
                                        <SelectItem value="advanced-2">Grandes Cartes de Tarification</SelectItem>
                                        <SelectItem value="layout-3">Grille Compacte (2 colonnes)</SelectItem>
                                        <SelectItem value="standard-2">Liste Verticale Classique</SelectItem>
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

                {/* Conditional logic */}
                <div className="mb-4">
                    <ConditionalLogicEditor
                        field={field as FormField}
                        allFields={allFields as FormField[]}
                        onChange={(cond) => updateField(field.id, { show_if: cond })}
                    />
                </div>

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
    )
}

export default function FormBuilderPage() {
    const params = useParams()
    const formId = params.id as string
    const setCustomLabel = useBreadcrumbStore(s => s.setCustomLabel)

    const [form, setForm] = useState<Form | null>(null)
    const [fields, setFields] = useState<ExtendedFormField[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [quizMode, setQuizMode] = useState(false)
    const [notifyOnResponse, setNotifyOnResponse] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(`form:notify:${formId}`) === 'true'
        }
        return false
    })

    // Load responses for analytics
    const { data: responses = [] } = useQuery({
        queryKey: ['form-responses', formId],
        queryFn: () => formsApi.responses(formId).then(r => r.data),
        enabled: !!formId,
    })

    useEffect(() => {
        const loadForm = async () => {
            try {
                const res = await formsApi.get(formId)
                setForm(res.data)
                setCustomLabel(formId, res.data.title)
                setFields(res.data.fields || [])
            } catch (err) {
                console.error("Failed to load form builder:", err)
                toast.error("Impossible de charger le formulaire")
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
            const updatedFields = fields.map((f, i) => ({ ...f, order: i }))
            await formsApi.update(formId, { fields: updatedFields as FormField[] })
            setFields(updatedFields)
            toast.success("Formulaire sauvegardé avec succès !")
        } catch (err) {
            console.error("Impossible d'enregistrer form:", err)
            toast.error("Erreur lors de la sauvegarde du formulaire")
            setError("Erreur lors de la sauvegarde du formulaire.")
        } finally {
            setSaving(false)
        }
    }

    const addField = (type: string) => {
        const newField: ExtendedFormField = {
            id: crypto.randomUUID(),
            label: type === 'PageBreak' ? '' : `Nouveau champ ${fields.filter(f => f.field_type !== 'PageBreak').length + 1}`,
            field_type: type as FormField['field_type'],
            required: false,
            order: fields.length,
            options: (type === 'SingleChoice' || type === 'MultipleChoice') ? ['Option 1'] : undefined
        }
        setFields([...fields, newField])
    }

    const updateField = (id: string, updates: Partial<ExtendedFormField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
    }

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id))
    }

    useDndMonitor({
        onDragEnd(event: DragEndEvent) {
            const { active, over } = event
            if (active.data.current?.type === 'form-field' && over && active.id !== over.id) {
                setFields((items) => {
                    const oldIndex = items.findIndex(item => item.id === active.id)
                    const newIndex = items.findIndex(item => item.id === over.id)
                    return arrayMove(items, oldIndex, newIndex)
                })
            }
        }
    })

    if (loading) return <AppLayout><div className="flex justify-center p-20">Chargement de l'éditeur...</div></AppLayout>
    if (error || !form) return <AppLayout><div className="p-8 text-destructive">{error || "Formulaire introuvable"}</div></AppLayout>

    return (
        <AppLayout>
            <div className="flex-1 space-y-6 w-full p-4 md:p-8">

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

                {/* Tabs */}
                <Tabs defaultValue="builder">
                    <TabsList>
                        <TabsTrigger value="builder">Éditeur</TabsTrigger>
                        <TabsTrigger value="analytics">
                            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                            Analyses {responses.length > 0 && `(${responses.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="branding">
                            <Palette className="h-3.5 w-3.5 mr-1.5" />
                            Apparence
                        </TabsTrigger>
                        <TabsTrigger value="settings">
                            <Settings className="h-3.5 w-3.5 mr-1.5" />
                            Paramètres
                        </TabsTrigger>
                    </TabsList>

                    {/* Builder Tab */}
                    <TabsContent value="builder" className="mt-4">
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
                                    <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
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
                                            <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('File')}>
                                                <ImageIcon className="h-4 w-4 mr-2 text-fuchsia-500" />
                                                <span className="text-xs">Fichier</span>
                                            </Button>
                                            <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('Signature')}>
                                                <PenLine className="h-4 w-4 mr-2 text-cyan-500" />
                                                <span className="text-xs">Signature</span>
                                            </Button>
                                            <Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50" onClick={() => addField('PageBreak')}>
                                                <Layers className="h-4 w-4 mr-2 text-violet-500" />
                                                <span className="text-xs">Saut de page</span>
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Analytics Tab */}
                    <TabsContent value="analytics" className="mt-4">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">{responses.length} réponse(s) collectée(s)</p>
                                <ExportResponses fields={fields as FormField[]} responses={responses} />
                            </div>
                            <ResponseAnalytics formId={formId} fields={fields as FormField[]} />
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
                                <CardTitle className="text-base">Paramètres du formulaire</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Mode Quiz / Score</p>
                                        <p className="text-xs text-muted-foreground">Attribuez des points aux options de choix et affichez le score total</p>
                                    </div>
                                    <Switch checked={quizMode} onCheckedChange={setQuizMode} />
                                </div>
                                <div className="flex items-center justify-between border-t pt-4">
                                    <div>
                                        <p className="text-sm font-medium">Notification email</p>
                                        <p className="text-xs text-muted-foreground">Me notifier à chaque nouvelle réponse</p>
                                    </div>
                                    <Switch
                                        checked={notifyOnResponse}
                                        onCheckedChange={(v) => {
                                            setNotifyOnResponse(v)
                                            localStorage.setItem(`form:notify:${formId}`, String(v))
                                        }}
                                    />
                                </div>
                                <div className="border-t pt-4">
                                    <p className="text-sm font-medium mb-2">Lien public</p>
                                    <div className="flex gap-2">
                                        <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 truncate">
                                            {typeof window !== 'undefined' ? `${window.location.origin}/f/${formId}` : `/f/${formId}`}
                                        </code>
                                        <Button size="sm" variant="outline" onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/f/${formId}`)
                                            toast.success("Lien copié !")
                                        }}>
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
    )
}
