"use client"

import { useEffect, useState, FormEvent } from "react"
import { useParams } from "next/navigation"
import { formsApi } from "@/lib/api/forms"
import type { Form, FormField, FormAnswer } from "@/lib/api/forms"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CheckCircle2, ChevronRight, FileText } from "lucide-react"

export default function PublicFormPage() {
    const params = useParams()
    const formId = params.id as string

    const [form, setForm] = useState<Form | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [answers, setAnswers] = useState<Record<string, any>>({})
    const [respondentEmail, setRespondentEmail] = useState("")

    useEffect(() => {
        const loadForm = async () => {
            try {
                const res = await formsApi.get(formId)
                if (!res.data.is_published) {
                    setError("Ce formulaire n'est pas encore ouvert aux réponses.")
                    setLoading(false)
                    return
                }
                setForm(res.data)
                
                // Init fields
                const init: Record<string, any> = {}
                res.data.fields?.forEach((f: FormField) => {
                    if (f.field_type === 'MultipleChoice') init[f.id] = []
                    else init[f.id] = ""
                })
                setAnswers(init)

            } catch (err: any) {
                console.error("Failed to load form:", err)
                if (err?.response?.status === 403 || err?.response?.status === 404) {
                     setError("Formulaire introuvable ou indisponible.")
                     return
                }
                setError("Impossible de charger le formulaire.")
            } finally {
                setLoading(false)
            }
        }
        if (formId) loadForm()
    }, [formId])

    const handleFieldChange = (fieldId: string, value: any) => {
        setAnswers(prev => ({ ...prev, [fieldId]: value }))
    }

    const handleCheckboxToggle = (fieldId: string, option: string, checked: boolean) => {
        setAnswers(prev => {
            const current = (prev[fieldId] || []) as string[]
            if (checked && !current.includes(option)) {
                return { ...prev, [fieldId]: [...current, option] }
            } else if (!checked) {
                return { ...prev, [fieldId]: current.filter(o => o !== option) }
            }
            return prev
        })
    }

    const validateForm = (): boolean => {
        if (!form || !form.fields) return false
        for (const field of form.fields) {
            if (field.required) {
                const val = answers[field.id]
                if (field.field_type === 'MultipleChoice') {
                    if (!val || val.length === 0) return false
                } else {
                    if (!val || val.toString().trim() === "") return false
                }
            }
        }
        return true
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!validateForm()) {
            setError("Veuillez remplir tous les champs obligatoires.")
            return
        }

        setSubmitting(true)

        try {
            // Reformater pour le payload Rust Vec<FormAnswer>
            const formattedAnswers: FormAnswer[] = Object.keys(answers).map(field_id => ({
                field_id,
                value: answers[field_id]
            }))

            await formsApi.respond(formId, {
                respondent: respondentEmail || undefined,
                answers: formattedAnswers
            })

            setSubmitted(true)
        } catch (err) {
            console.error("Submission failed:", err)
            setError("Une erreur s'est produite lors de l'envoi. Veuillez réessayer.")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20">
            <div className="text-muted-foreground animate-pulse">Chargement du formulaire...</div>
        </div>
    )

    if (error && !form) return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
            <Card className="max-w-md w-full shadow-lg border-destructive/20">
                <CardContent className="pt-6 flex flex-col items-center text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
                    <h2 className="text-xl font-semibold mb-2">Accès restreint</h2>
                    <p className="text-muted-foreground mb-6">{error}</p>
                </CardContent>
            </Card>
        </div>
    )

    if (submitted) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50 dark:from-indigo-950/20 dark:via-background dark:to-blue-950/20 p-4">
            <Card className="max-w-md w-full shadow-xl border-t-4 border-t-emerald-500 overflow-hidden">
                <div className="h-1.5 w-full bg-emerald-500" />
                <CardContent className="pt-10 pb-8 flex flex-col items-center text-center">
                    <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Merci !</h2>
                    <p className="text-muted-foreground">Votre réponse au formulaire "{form?.title}" a bien été enregistrée.</p>
                </CardContent>
            </Card>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 py-12">
            <div className="max-w-2xl mx-auto space-y-6">
                
                <Card className="border-t-4 border-t-primary shadow-md">
                    <CardHeader className="pb-6">
                        <CardTitle className="text-2xl sm:text-3xl font-bold">{form?.title}</CardTitle>
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

                    {form?.fields?.map((field) => (
                        <Card key={field.id} className="shadow-sm border-border/60 hover:border-border transition-colors group">
                            <CardContent className="pt-6">
                                <Label className="text-base font-medium mb-3 flex items-start gap-1">
                                    {field.label}
                                    {field.required && <span className="text-destructive font-bold ml-1">*</span>}
                                </Label>
                                
                                {field.field_type === 'Text' || field.field_type === 'Email' || field.field_type === 'Number' || field.field_type === 'Date' ? (
                                    <Input 
                                        type={field.field_type.toLowerCase()} 
                                        placeholder={field.placeholder || "Votre réponse"} 
                                        required={field.required}
                                        value={answers[field.id] || ""}
                                        onChange={e => handleFieldChange(field.id, e.target.value)}
                                        className="mt-2 bg-background transition-all focus-visible:ring-primary/30"
                                    />
                                ) : field.field_type === 'TextArea' ? (
                                    <Textarea 
                                        placeholder={field.placeholder || "Votre réponse détaillée"} 
                                        required={field.required}
                                        value={answers[field.id] || ""}
                                        onChange={e => handleFieldChange(field.id, e.target.value)}
                                        className="mt-2 min-h-32 bg-background transition-all focus-visible:ring-primary/30"
                                    />
                                ) : field.field_type === 'SingleChoice' ? (
                                    <RadioGroup 
                                        className={
                                            field.options && field.options.length <= 3 
                                                ? "grid gap-3 mt-3" 
                                                : field.options && field.options.length <= 6 
                                                    ? "grid sm:grid-cols-2 gap-3 mt-3" 
                                                    : "flex flex-col gap-2 mt-3"
                                        } 
                                        value={answers[field.id] || ""}
                                        onValueChange={val => handleFieldChange(field.id, val)}
                                        required={field.required}
                                    >
                                        {field.options?.map((opt, i) => {
                                            const optionCount = field.options?.length || 0;
                                            const activeLayout = field.layout || (optionCount <= 3 ? 'advanced-2' : optionCount <= 6 ? 'layout-3' : 'standard-2');
                                            
                                            if (activeLayout === 'advanced-2') {
                                                // Style radio-group-advanced-2 (Big Cards)
                                                return (
                                                    <div 
                                                        key={i} 
                                                        className={`relative flex items-center space-x-3 rounded-xl border p-5 shadow-sm transition-colors hover:bg-accent/50 ${answers[field.id] === opt ? "border-primary bg-primary/5" : "bg-background"}`}
                                                    >
                                                        <RadioGroupItem id={`${field.id}-${i}`} value={opt} className="h-5 w-5 mt-0.5" />
                                                        <Label htmlFor={`${field.id}-${i}`} className="cursor-pointer font-semibold text-lg flex-1">
                                                            {opt}
                                                        </Label>
                                                    </div>
                                                )
                                            } else if (activeLayout === 'layout-3') {
                                                // Style radio-group-layout-3 (Grid)
                                                return (
                                                    <div 
                                                        key={i} 
                                                        className={`relative flex items-start space-x-3 rounded-lg border p-3 shadow-sm transition-colors hover:bg-accent/50 ${answers[field.id] === opt ? "border-primary bg-primary/5" : "bg-background"}`}
                                                    >
                                                        <RadioGroupItem className="mt-0.5" id={`${field.id}-${i}`} value={opt} />
                                                        <div className="grid flex-1 gap-1 leading-none">
                                                            <Label htmlFor={`${field.id}-${i}`} className="cursor-pointer font-medium">
                                                                {opt}
                                                            </Label>
                                                        </div>
                                                    </div>
                                                )
                                            } else {
                                                // Style radio-group-standard-2 (Vertical list minimal)
                                                return (
                                                    <div key={i} className="flex items-center space-x-2 py-2">
                                                        <RadioGroupItem id={`${field.id}-${i}`} value={opt} />
                                                        <Label htmlFor={`${field.id}-${i}`} className="cursor-pointer font-normal text-base">{opt}</Label>
                                                    </div>
                                                )
                                            }
                                        })}

                                    </RadioGroup>
                                ) : field.field_type === 'MultipleChoice' ? (
                                    <div className="space-y-3 mt-3">
                                        {field.options?.map((opt, i) => {
                                            const isChecked = (answers[field.id] || []).includes(opt)
                                            return (
                                                <div key={i} className="flex items-center space-x-3 cursor-pointer">
                                                    <input 
                                                        type="checkbox"
                                                        id={`cb-${field.id}-${i}`}
                                                        className="h-4 w-4 bg-background border-primary rounded text-primary focus:ring-primary"
                                                        checked={isChecked}
                                                        onChange={(e) => handleCheckboxToggle(field.id, opt, e.target.checked)}
                                                    />
                                                    <Label htmlFor={`cb-${field.id}-${i}`} className="font-normal cursor-pointer flex-1 py-1">
                                                        {opt}
                                                    </Label>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground italic bg-muted/40 p-4 rounded-md mt-2">Ce type de champ n'est pas supporté pour le moment.</div>
                                )}
                            </CardContent>
                        </Card>
                    ))}

                    <Card className="shadow-sm border-border/60">
                        <CardContent className="pt-6">
                            <Label className="text-sm font-medium mb-1 block">Votre adresse email (optionnel)</Label>
                            <p className="text-xs text-muted-foreground mb-3">Si vous souhaitez recevoir une copie ou être recontacté.</p>
                            <Input 
                                type="email" 
                                placeholder="nom@exemple.com" 
                                value={respondentEmail}
                                onChange={e => setRespondentEmail(e.target.value)}
                                className="bg-background"
                            />
                        </CardContent>
                    </Card>

                    <div className="pt-4 flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">Protégé par SignApps Security</p>
                        <Button type="submit" size="lg" disabled={submitting} className="min-w-32 shadow-lg hover:shadow-xl transition-all">
                            {submitting ? "Envoi..." : (
                                <>Envoyer <ChevronRight className="h-4 w-4 ml-1" /></>
                            )}
                        </Button>
                    </div>
                </form>

            </div>
        </div>
    )
}
