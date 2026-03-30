"use client"

// PX3: Multi-step deployment wizard (template generation + image selection)
// PX4: Live deployment progress tracking

import { useState, useEffect, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Download,
  Upload, HardDrive, Cpu, Globe, Package, RefreshCw, Plus, Trash2, Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { pxeApi, PxeProfile } from "@/lib/api/pxe"
import { getClient, ServiceName } from "@/lib/api/factory"
import { usePageTitle } from "@/hooks/use-page-title"

const client = getClient(ServiceName.PXE)

// ─── Types ───────────────────────────────────────────────────────────────────

interface PxeImage {
  id: string
  name: string
  os_type: string
  os_version?: string
  image_type: string
  file_path: string
  file_size?: number
  file_hash?: string
  description?: string
  created_at: string
}

interface PxeDeployment {
  id: string
  asset_mac: string
  profile_id?: string
  status: string
  progress: number
  current_step?: string
  started_at?: string
  completed_at?: string
  error_message?: string
  created_at: string
  updated_at: string
}

interface TemplateUser {
  username: string
  password_hash?: string
  sudo?: boolean
}

type WizardStep = "os" | "network" | "disk" | "users" | "packages" | "review"

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: "os", label: "Système", icon: <Cpu className="h-4 w-4" /> },
  { id: "network", label: "Réseau", icon: <Globe className="h-4 w-4" /> },
  { id: "disk", label: "Disque", icon: <HardDrive className="h-4 w-4" /> },
  { id: "users", label: "Utilisateurs", icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: "packages", label: "Paquets", icon: <Package className="h-4 w-4" /> },
  { id: "review", label: "Révision", icon: <Wand2 className="h-4 w-4" /> },
]

const OS_TYPES = [
  { value: "ubuntu", label: "Ubuntu", format: "Preseed" },
  { value: "debian", label: "Debian", format: "Preseed" },
  { value: "rhel", label: "RHEL / Rocky / Alma", format: "Kickstart" },
  { value: "centos", label: "CentOS", format: "Kickstart" },
  { value: "windows", label: "Windows", format: "Unattend.xml" },
]

const DISK_LAYOUTS = [
  { value: "auto", label: "Automatique (simple)" },
  { value: "lvm", label: "LVM (recommandé)" },
  { value: "custom", label: "Personnalisé" },
]

// ─── Upload Dialog ────────────────────────────────────────────────────────────

function ImageUploader({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [osType, setOsType] = useState("linux")
  const [imageType, setImageType] = useState("kernel")
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("name", name || file.name)
      form.append("os_type", osType)
      form.append("image_type", imageType)
      const res = await fetch(`${process.env.NEXT_PUBLIC_PXE_URL ?? "http://localhost:3016"}/api/v1/pxe/images`, {
        method: "POST",
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Image téléversée avec succès")
      onUploaded()
    } catch (e) {
      toast.error("Erreur upload: " + String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3 p-4 border rounded-md bg-muted/20">
      <div className="font-medium text-sm">Téléverser une image</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Fichier</Label>
          <Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nom</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder={file?.name ?? "kernel"} className="text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">OS type</Label>
          <Select value={osType} onValueChange={setOsType}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["linux", "windows", "esxi", "other"].map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type d&apos;image</Label>
          <Select value={imageType} onValueChange={setImageType}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["kernel", "initrd", "iso", "squashfs", "other"].map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" onClick={handleUpload} disabled={!file || uploading}>
        <Upload className="h-3 w-3 mr-2" />
        {uploading ? "Téléversement..." : "Téléverser"}
      </Button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PxeWizardPage() {
  usePageTitle("Wizard PXE")
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("wizard")
  const [currentStep, setCurrentStep] = useState<WizardStep>("os")
  const [showUploader, setShowUploader] = useState(false)
  const [generatedTemplate, setGeneratedTemplate] = useState<string>("")
  const [generatedFormat, setGeneratedFormat] = useState<string>("")
  const [generating, setGenerating] = useState(false)

  // Wizard form state
  const [wizardForm, setWizardForm] = useState({
    os_type: "ubuntu",
    hostname: "",
    domain: "localdomain",
    timezone: "Europe/Paris",
    locale: "fr_FR.UTF-8",
    disk_layout: "lvm",
    packages: [] as string[],
    packagesInput: "",
    users: [] as TemplateUser[],
    newUser: { username: "", password_hash: "", sudo: true } as TemplateUser,
  })

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: images, isLoading: imagesLoading } = useQuery({
    queryKey: ["pxe-images"],
    queryFn: () => client.get<PxeImage[]>("/pxe/images").then(r => r.data),
  })

  const { data: deployments, isLoading: deploymentsLoading } = useQuery({
    queryKey: ["pxe-deployments"],
    queryFn: () => client.get<PxeDeployment[]>("/pxe/deployments").then(r => r.data),
    refetchInterval: 5000, // poll every 5s for live progress
  })

  // ─── Image deletion ─────────────────────────────────────────────────────────

  const deleteImageMutation = useMutation({
    mutationFn: (id: string) => client.delete(`/pxe/images/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pxe-images"] })
      toast.success("Image supprimée")
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  })

  // ─── Template generation ───────────────────────────────────────────────────

  const handleGenerateTemplate = async () => {
    if (!wizardForm.hostname) {
      toast.error("Veuillez saisir un hostname")
      return
    }
    setGenerating(true)
    try {
      const payload = {
        os_type: wizardForm.os_type,
        hostname: wizardForm.hostname,
        domain: wizardForm.domain || undefined,
        disk_layout: wizardForm.disk_layout,
        timezone: wizardForm.timezone,
        locale: wizardForm.locale,
        packages: wizardForm.packages.length > 0 ? wizardForm.packages : undefined,
        users: wizardForm.users.length > 0 ? wizardForm.users : undefined,
      }
      const result = await client.post<{ os_type: string; format: string; content: string }>(
        "/pxe/templates/generate",
        payload
      ).then(r => r.data)
      setGeneratedTemplate(result.content)
      setGeneratedFormat(result.format)
      setCurrentStep("review")
    } catch (e) {
      toast.error("Erreur génération: " + String(e))
    } finally {
      setGenerating(false)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([generatedTemplate], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = generatedFormat === "unattend.xml" ? "autounattend.xml" :
      generatedFormat === "kickstart" ? "ks.cfg" : "preseed.cfg"
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Step navigation ───────────────────────────────────────────────────────

  const stepIndex = STEPS.findIndex(s => s.id === currentStep)
  const canGoNext = stepIndex < STEPS.length - 1
  const canGoBack = stepIndex > 0

  const nextStep = () => {
    if (canGoNext) setCurrentStep(STEPS[stepIndex + 1].id)
  }
  const prevStep = () => {
    if (canGoBack) setCurrentStep(STEPS[stepIndex - 1].id)
  }

  const selectedOsInfo = OS_TYPES.find(o => o.value === wizardForm.os_type)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wand2 className="h-6 w-6" />
              Wizard PXE
            </h1>
            <p className="text-muted-foreground text-sm">Déploiement guidé, gestion des images et suivi en temps réel</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="wizard">Wizard (PX3)</TabsTrigger>
            <TabsTrigger value="images">Images (PX2)</TabsTrigger>
            <TabsTrigger value="deployments">Déploiements (PX4)</TabsTrigger>
          </TabsList>

          {/* PX3: Wizard */}
          <TabsContent value="wizard">
            <div className="grid grid-cols-12 gap-4">
              {/* Step sidebar */}
              <div className="col-span-3">
                <Card>
                  <CardContent className="pt-4 space-y-1">
                    {STEPS.map((step, i) => {
                      const isActive = step.id === currentStep
                      const isDone = i < stepIndex
                      return (
                        <button
                          key={step.id}
                          className={`w-full flex items-center gap-3 p-2 rounded-md text-sm text-left transition-colors ${
                            isActive ? "bg-primary text-primary-foreground" :
                            isDone ? "text-muted-foreground hover:bg-muted/40" :
                            "text-muted-foreground/50"
                          }`}
                          onClick={() => isDone || isActive ? setCurrentStep(step.id) : undefined}
                        >
                          <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                            isDone ? "bg-green-500 border-green-500 text-white" :
                            isActive ? "border-primary-foreground text-primary-foreground" :
                            "border-muted-foreground/30"
                          }`}>
                            {isDone ? "✓" : i + 1}
                          </span>
                          {step.label}
                        </button>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Step content */}
              <div className="col-span-9">
                <Card>
                  <CardHeader>
                    <CardTitle>{STEPS[stepIndex]?.label}</CardTitle>
                    {selectedOsInfo && currentStep !== "os" && (
                      <CardDescription>Système: {selectedOsInfo.label} — Format: {selectedOsInfo.format}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {currentStep === "os" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Système d&apos;exploitation</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {OS_TYPES.map(os => (
                              <div
                                key={os.value}
                                className={`p-3 border rounded-md cursor-pointer transition-colors ${
                                  wizardForm.os_type === os.value
                                    ? "border-primary bg-primary/5"
                                    : "hover:bg-muted/40"
                                }`}
                                onClick={() => setWizardForm(f => ({ ...f, os_type: os.value }))}
                              >
                                <div className="font-medium text-sm">{os.label}</div>
                                <div className="text-xs text-muted-foreground">{os.format}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Timezone</Label>
                            <Input
                              value={wizardForm.timezone}
                              onChange={e => setWizardForm(f => ({ ...f, timezone: e.target.value }))}
                              placeholder="Europe/Paris"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Locale</Label>
                            <Input
                              value={wizardForm.locale}
                              onChange={e => setWizardForm(f => ({ ...f, locale: e.target.value }))}
                              placeholder="fr_FR.UTF-8"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStep === "network" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Hostname</Label>
                            <Input
                              value={wizardForm.hostname}
                              onChange={e => setWizardForm(f => ({ ...f, hostname: e.target.value }))}
                              placeholder="ws-001"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Domaine</Label>
                            <Input
                              value={wizardForm.domain}
                              onChange={e => setWizardForm(f => ({ ...f, domain: e.target.value }))}
                              placeholder="corp.local"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStep === "disk" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Schéma de partitionnement</Label>
                          <div className="grid grid-cols-1 gap-2">
                            {DISK_LAYOUTS.map(dl => (
                              <div
                                key={dl.value}
                                className={`p-3 border rounded-md cursor-pointer transition-colors ${
                                  wizardForm.disk_layout === dl.value
                                    ? "border-primary bg-primary/5"
                                    : "hover:bg-muted/40"
                                }`}
                                onClick={() => setWizardForm(f => ({ ...f, disk_layout: dl.value }))}
                              >
                                <div className="font-medium text-sm">{dl.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStep === "users" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Utilisateurs à créer</Label>
                          {wizardForm.users.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-2">Aucun utilisateur défini (utilisera les valeurs par défaut)</div>
                          ) : (
                            <div className="space-y-2">
                              {wizardForm.users.map((u, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 border rounded-md">
                                  <span className="font-medium text-sm flex-1">{u.username}</span>
                                  {u.sudo && <Badge variant="secondary" className="text-xs">sudo</Badge>}
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                                    onClick={() => setWizardForm(f => ({ ...f, users: f.users.filter((_, j) => j !== i) }))}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            <Input
                              placeholder="username"
                              value={wizardForm.newUser.username}
                              onChange={e => setWizardForm(f => ({ ...f, newUser: { ...f.newUser, username: e.target.value } }))}
                            />
                            <Input
                              placeholder="mot de passe"
                              type="password"
                              value={wizardForm.newUser.password_hash ?? ""}
                              onChange={e => setWizardForm(f => ({ ...f, newUser: { ...f.newUser, password_hash: e.target.value } }))}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={wizardForm.newUser.sudo ?? false}
                                onChange={e => setWizardForm(f => ({ ...f, newUser: { ...f.newUser, sudo: e.target.checked } }))}
                              />
                              <Label className="text-sm">sudo</Label>
                              <Button size="sm" onClick={() => {
                                if (!wizardForm.newUser.username) return
                                setWizardForm(f => ({
                                  ...f,
                                  users: [...f.users, f.newUser],
                                  newUser: { username: "", password_hash: "", sudo: true },
                                }))
                              }}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStep === "packages" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Paquets supplémentaires</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="curl, wget, htop..."
                              value={wizardForm.packagesInput}
                              onChange={e => setWizardForm(f => ({ ...f, packagesInput: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === "Enter" || e.key === ",") {
                                  e.preventDefault()
                                  const pkgs = wizardForm.packagesInput.split(",").map(s => s.trim()).filter(Boolean)
                                  setWizardForm(f => ({ ...f, packages: [...new Set([...f.packages, ...pkgs])], packagesInput: "" }))
                                }
                              }}
                            />
                            <Button size="sm" onClick={() => {
                              const pkgs = wizardForm.packagesInput.split(",").map(s => s.trim()).filter(Boolean)
                              setWizardForm(f => ({ ...f, packages: [...new Set([...f.packages, ...pkgs])], packagesInput: "" }))
                            }}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {wizardForm.packages.map(pkg => (
                              <Badge key={pkg} variant="secondary" className="cursor-pointer text-xs"
                                onClick={() => setWizardForm(f => ({ ...f, packages: f.packages.filter(p => p !== pkg) }))}>
                                {pkg} ×
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStep === "review" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-muted-foreground">OS:</span> {selectedOsInfo?.label}</div>
                          <div><span className="text-muted-foreground">Format:</span> {selectedOsInfo?.format}</div>
                          <div><span className="text-muted-foreground">Hostname:</span> {wizardForm.hostname || "(non défini)"}</div>
                          <div><span className="text-muted-foreground">Domaine:</span> {wizardForm.domain}</div>
                          <div><span className="text-muted-foreground">Disque:</span> {wizardForm.disk_layout}</div>
                          <div><span className="text-muted-foreground">Utilisateurs:</span> {wizardForm.users.length}</div>
                          <div><span className="text-muted-foreground">Paquets:</span> {wizardForm.packages.length}</div>
                        </div>
                        {generatedTemplate ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" />
                                Template généré — {generatedFormat}
                              </Label>
                              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                                <Download className="h-3 w-3 mr-1" />
                                Télécharger
                              </Button>
                            </div>
                            <Textarea
                              value={generatedTemplate}
                              readOnly
                              rows={14}
                              className="font-mono text-xs"
                            />
                          </div>
                        ) : (
                          <Button onClick={handleGenerateTemplate} disabled={generating} className="w-full">
                            <Wand2 className="h-4 w-4 mr-2" />
                            {generating ? "Génération en cours..." : "Générer le template"}
                          </Button>
                        )}
                        {generatedTemplate && (
                          <Button variant="outline" onClick={handleGenerateTemplate} disabled={generating} className="w-full">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Régénérer
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                  <div className="flex justify-between px-6 pb-6">
                    <Button variant="outline" onClick={prevStep} disabled={!canGoBack}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Précédent
                    </Button>
                    {currentStep !== "review" ? (
                      <Button onClick={nextStep} disabled={!canGoNext}>
                        Suivant
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* PX2: Image management */}
          <TabsContent value="images">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Images PXE</CardTitle>
                  <CardDescription>Kernels, initrd, ISO stockés dans data/pxe/tftpboot/images/</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowUploader(!showUploader)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Téléverser
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {showUploader && (
                  <ImageUploader
                    onUploaded={() => {
                      queryClient.invalidateQueries({ queryKey: ["pxe-images"] })
                      setShowUploader(false)
                    }}
                  />
                )}
                {imagesLoading ? (
                  <div className="text-muted-foreground text-sm">Chargement...</div>
                ) : !images || images.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Aucune image. Téléversez votre premier fichier (kernel, initrd, ISO).</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {images.map(img => (
                      <div key={img.id} className="flex items-center gap-3 p-3 border rounded-md">
                        <HardDrive className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{img.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {img.os_type} {img.os_version && `· ${img.os_version}`} ·{" "}
                            {img.file_size ? `${(img.file_size / 1024 / 1024).toFixed(1)} MB` : "taille inconnue"}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{img.image_type}</Badge>
                        <div className="text-xs text-muted-foreground">
                          {new Date(img.created_at).toLocaleDateString("fr-FR")}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteImageMutation.mutate(img.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PX4: Deployment progress */}
          <TabsContent value="deployments">
            <Card>
              <CardHeader>
                <CardTitle>Déploiements en cours</CardTitle>
                <CardDescription>Actualisation automatique toutes les 5 secondes via polling</CardDescription>
              </CardHeader>
              <CardContent>
                {deploymentsLoading ? (
                  <div className="text-muted-foreground text-sm">Chargement...</div>
                ) : !deployments || deployments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun déploiement en cours ou historique vide.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deployments.map(dep => (
                      <div key={dep.id} className="p-4 border rounded-md space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="font-mono text-sm font-medium">{dep.asset_mac}</div>
                          <Badge
                            variant={
                              dep.status === "completed" ? "default" :
                              dep.status === "failed" ? "destructive" :
                              dep.status === "deploying" ? "secondary" : "outline"
                            }
                          >
                            {dep.status}
                          </Badge>
                          {dep.current_step && (
                            <span className="text-xs text-muted-foreground">{dep.current_step}</span>
                          )}
                          {dep.error_message && (
                            <div className="flex items-center gap-1 text-destructive text-xs">
                              <AlertCircle className="h-3 w-3" />
                              {dep.error_message}
                            </div>
                          )}
                          <div className="ml-auto text-xs text-muted-foreground">
                            {dep.progress}%
                          </div>
                        </div>
                        <Progress
                          value={dep.progress}
                          className={dep.status === "failed" ? "bg-destructive/20" : ""}
                        />
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {dep.started_at && <span>Démarré: {new Date(dep.started_at).toLocaleString("fr-FR")}</span>}
                          {dep.completed_at && <span>Terminé: {new Date(dep.completed_at).toLocaleString("fr-FR")}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
