"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  ShieldCheck, Plus, Trash2, Edit, ChevronRight, ChevronDown,
  AlertTriangle, CheckCircle2, Copy, FileJson, Layers,
} from "lucide-react"
import { toast } from "sonner"
import { getClient, ServiceName } from "@/lib/api/factory"
import { usePageTitle } from "@/hooks/use-page-title"

const client = getClient(ServiceName.IT_ASSETS)

// ─── Types ───────────────────────────────────────────────────────────────────

interface Policy {
  id: string
  name: string
  description?: string
  category: string
  settings: Record<string, unknown>
  parent_id?: string
  priority?: number
  mode?: string
  created_at?: string
  updated_at?: string
}

interface PolicyWithChildren extends Policy {
  children: PolicyWithChildren[]
}

interface ComplianceSummary {
  total_checks: number
  compliant_count: number
  non_compliant_count: number
  compliance_pct: number
  non_compliant_machines: {
    hardware_id: string
    hardware_name: string
    policy_id: string
    policy_name: string
    checked_at: string
  }[]
}

// ─── CIS / ANSSI Templates (GP5) ─────────────────────────────────────────────

const POLICY_TEMPLATES = [
  {
    id: "cis-l1-security",
    label: "CIS Benchmark — Level 1 Security",
    category: "Security",
    settings: {
      password_min_length: 14,
      password_complexity: true,
      lockout_threshold: 5,
      lockout_duration_minutes: 30,
      screen_lock_timeout_minutes: 5,
      disable_usb_storage: true,
      require_mfa: true,
    },
  },
  {
    id: "cis-l1-network",
    label: "CIS Benchmark — Level 1 Network",
    category: "Network",
    settings: {
      firewall_enabled: true,
      disable_ipv6: false,
      block_icmp_redirect: true,
      tcp_syn_cookies: true,
      disable_wifi_when_wired: true,
    },
  },
  {
    id: "anssi-hardening",
    label: "ANSSI — Hardening Guide",
    category: "Security",
    settings: {
      disable_autorun: true,
      disable_unnecessary_services: true,
      audit_logging: true,
      enforce_secure_boot: true,
      disable_remote_assistance: true,
      ntp_servers: ["pool.ntp.org"],
    },
  },
  {
    id: "anssi-desktop",
    label: "ANSSI — Desktop Configuration",
    category: "Desktop",
    settings: {
      wallpaper_managed: true,
      disable_screensaver_bypass: true,
      restrict_control_panel: false,
      disable_cmd_access: false,
      ie_enhanced_security: true,
    },
  },
  {
    id: "standard-apps",
    label: "Standard — Allowed Applications",
    category: "Apps",
    settings: {
      allowed_apps: ["chrome", "firefox", "vscode", "office"],
      blocked_apps: ["torrent", "vpn-personal"],
      app_store_enabled: true,
    },
  },
]

const CATEGORIES = ["Security", "Network", "Desktop", "Apps"]
const MODES = ["enforce", "audit", "disabled"]

const CATEGORY_SETTINGS_SCHEMA: Record<string, { key: string; label: string; type: "boolean" | "number" | "text" | "list" }[]> = {
  Security: [
    { key: "password_min_length", label: "Min password length", type: "number" },
    { key: "password_complexity", label: "Password complexity", type: "boolean" },
    { key: "lockout_threshold", label: "Lockout threshold (attempts)", type: "number" },
    { key: "lockout_duration_minutes", label: "Lockout duration (min)", type: "number" },
    { key: "screen_lock_timeout_minutes", label: "Screen lock timeout (min)", type: "number" },
    { key: "disable_usb_storage", label: "Disable USB storage", type: "boolean" },
    { key: "require_mfa", label: "Require MFA", type: "boolean" },
    { key: "disable_autorun", label: "Disable autorun", type: "boolean" },
    { key: "audit_logging", label: "Audit logging", type: "boolean" },
    { key: "enforce_secure_boot", label: "Enforce Secure Boot", type: "boolean" },
  ],
  Network: [
    { key: "firewall_enabled", label: "Firewall enabled", type: "boolean" },
    { key: "disable_ipv6", label: "Disable IPv6", type: "boolean" },
    { key: "block_icmp_redirect", label: "Block ICMP redirect", type: "boolean" },
    { key: "tcp_syn_cookies", label: "TCP SYN cookies", type: "boolean" },
    { key: "disable_wifi_when_wired", label: "Disable Wi-Fi when wired", type: "boolean" },
    { key: "ntp_servers", label: "NTP servers", type: "list" },
  ],
  Desktop: [
    { key: "wallpaper_managed", label: "Managed wallpaper", type: "boolean" },
    { key: "disable_screensaver_bypass", label: "Disable screensaver bypass", type: "boolean" },
    { key: "restrict_control_panel", label: "Restrict Control Panel", type: "boolean" },
    { key: "disable_cmd_access", label: "Disable CMD access", type: "boolean" },
    { key: "ie_enhanced_security", label: "IE Enhanced Security", type: "boolean" },
  ],
  Apps: [
    { key: "allowed_apps", label: "Allowed apps (comma-sep)", type: "list" },
    { key: "blocked_apps", label: "Blocked apps (comma-sep)", type: "list" },
    { key: "app_store_enabled", label: "App store enabled", type: "boolean" },
  ],
}

// ─── Tree Node Component ──────────────────────────────────────────────────────

function PolicyTreeNode({
  node,
  level = 0,
  onEdit,
  onDelete,
}: {
  node: PolicyWithChildren
  level?: number
  onEdit: (p: Policy) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 hover:bg-muted/40 rounded-md group"
        style={{ paddingLeft: `${12 + level * 20}px` }}
      >
        <button
          className="w-4 h-4 flex items-center justify-center shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <span className="w-3" />
          )}
        </button>
        <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium">{node.name}</span>
        <Badge variant="outline" className="text-xs">{node.category}</Badge>
        <Badge
          variant={node.mode === "enforce" ? "default" : node.mode === "audit" ? "secondary" : "destructive"}
          className="text-xs"
        >
          {node.mode ?? "enforce"}
        </Badge>
        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(node)}>
            <Edit className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(node.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <PolicyTreeNode key={child.id} node={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Settings Editor (GP3) ────────────────────────────────────────────────────

function SettingsEditor({
  category,
  settings,
  onChange,
}: {
  category: string
  settings: Record<string, unknown>
  onChange: (s: Record<string, unknown>) => void
}) {
  const schema = CATEGORY_SETTINGS_SCHEMA[category] ?? []

  const handleChange = (key: string, value: unknown) => {
    onChange({ ...settings, [key]: value })
  }

  if (schema.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Raw JSON settings</Label>
        <Textarea
          rows={6}
          value={JSON.stringify(settings, null, 2)}
          onChange={e => {
            try { onChange(JSON.parse(e.target.value)) } catch { /* ignore */ }
          }}
          className="font-mono text-xs"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {schema.map(field => (
        <div key={field.key} className="flex items-center justify-between gap-4">
          <Label className="text-sm min-w-0 flex-1">{field.label}</Label>
          {field.type === "boolean" ? (
            <input
              type="checkbox"
              checked={Boolean(settings[field.key])}
              onChange={e => handleChange(field.key, e.target.checked)}
              className="h-4 w-4"
            />
          ) : field.type === "number" ? (
            <Input
              type="number"
              className="w-24"
              value={String(settings[field.key] ?? "")}
              onChange={e => handleChange(field.key, Number(e.target.value))}
            />
          ) : field.type === "list" ? (
            <Input
              className="w-48 text-xs"
              value={Array.isArray(settings[field.key]) ? (settings[field.key] as string[]).join(", ") : String(settings[field.key] ?? "")}
              onChange={e => handleChange(field.key, e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            />
          ) : (
            <Input
              className="w-48"
              value={String(settings[field.key] ?? "")}
              onChange={e => handleChange(field.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  usePageTitle("Politiques GPO")
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("tree")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Security",
    mode: "enforce",
    priority: 0,
    parent_id: "",
    settings: {} as Record<string, unknown>,
  })

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: treeData, isLoading: treeLoading } = useQuery({
    queryKey: ["policies-tree"],
    queryFn: () => client.get<PolicyWithChildren[]>("/it-assets/policies/tree").then(r => r.data),
  })

  const { data: flatData } = useQuery({
    queryKey: ["policies"],
    queryFn: () => client.get<Policy[]>("/it-assets/policies").then(r => r.data),
  })

  const { data: compliance, isLoading: complianceLoading } = useQuery({
    queryKey: ["policies-compliance"],
    queryFn: () => client.get<ComplianceSummary>("/it-assets/policies/compliance").then(r => r.data),
  })

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => client.post("/it-assets/policies", data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] })
      queryClient.invalidateQueries({ queryKey: ["policies-tree"] })
      setDialogOpen(false)
      toast.success("Politique créée")
    },
    onError: () => toast.error("Erreur lors de la création"),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof form> }) =>
      client.put(`/it-assets/policies/${id}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] })
      queryClient.invalidateQueries({ queryKey: ["policies-tree"] })
      setDialogOpen(false)
      toast.success("Politique mise à jour")
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.delete(`/it-assets/policies/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] })
      queryClient.invalidateQueries({ queryKey: ["policies-tree"] })
      toast.success("Politique supprimée")
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  })

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingPolicy(null)
    setForm({ name: "", description: "", category: "Security", mode: "enforce", priority: 0, parent_id: "", settings: {} })
    setDialogOpen(true)
  }

  const openEdit = (policy: Policy) => {
    setEditingPolicy(policy)
    setForm({
      name: policy.name,
      description: policy.description ?? "",
      category: policy.category,
      mode: policy.mode ?? "enforce",
      priority: policy.priority ?? 0,
      parent_id: policy.parent_id ?? "",
      settings: policy.settings ?? {},
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { parent_id, ...rest } = form
    const payload = {
      ...rest,
      ...(parent_id ? { parent_id } : {}),
    }
    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, data: payload })
    } else {
      createMutation.mutate(form)
    }
  }

  const applyTemplate = (templateId: string) => {
    const tpl = POLICY_TEMPLATES.find(t => t.id === templateId)
    if (!tpl) return
    setForm(f => ({
      ...f,
      name: tpl.label,
      category: tpl.category,
      settings: tpl.settings,
    }))
    setTemplateDialogOpen(false)
    setDialogOpen(true)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const policies = flatData ?? []
  const tree = treeData ?? []
  const comp = compliance

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              Politiques GPO
            </h1>
            <p className="text-muted-foreground text-sm">Gestion des policies de configuration et conformité</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
              <Copy className="h-4 w-4 mr-2" />
              Templates
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle politique
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tree">
              <Layers className="h-4 w-4 mr-1" />
              Arborescence (GP1)
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Conformité (GP4)
            </TabsTrigger>
          </TabsList>

          {/* GP1: Policy tree */}
          <TabsContent value="tree">
            <Card>
              <CardHeader>
                <CardTitle>Arborescence des politiques</CardTitle>
                <CardDescription>Héritage parent → enfants. Les enfants héritent et surchargent les settings parents.</CardDescription>
              </CardHeader>
              <CardContent>
                {treeLoading ? (
                  <div className="text-muted-foreground text-sm">Chargement...</div>
                ) : tree.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Aucune politique. Créez votre première politique ou appliquez un template.</p>
                  </div>
                ) : (
                  <div className="border rounded-md p-2">
                    {tree.map(node => (
                      <PolicyTreeNode
                        key={node.id}
                        node={node}
                        onEdit={openEdit}
                        onDelete={id => deleteMutation.mutate(id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GP4: Compliance dashboard */}
          <TabsContent value="compliance">
            <div className="space-y-4">
              {complianceLoading ? (
                <div className="text-muted-foreground text-sm">Chargement...</div>
              ) : comp ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Conformité globale</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600">{comp.compliance_pct.toFixed(1)}%</div>
                        <Progress value={comp.compliance_pct} className="mt-2" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Conformes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-500 flex items-center gap-2">
                          <CheckCircle2 className="h-6 w-6" />
                          {comp.compliant_count}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Non conformes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-red-500 flex items-center gap-2">
                          <AlertTriangle className="h-6 w-6" />
                          {comp.non_compliant_count}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Machines non conformes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {comp.non_compliant_machines.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
                          <p>Toutes les machines sont conformes</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Machine</TableHead>
                              <TableHead>Politique</TableHead>
                              <TableHead>Dernier contrôle</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comp.non_compliant_machines.map(m => (
                              <TableRow key={`${m.hardware_id}-${m.policy_id}`}>
                                <TableCell className="font-medium">{m.hardware_name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{m.policy_name}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  {new Date(m.checked_at).toLocaleString("fr-FR")}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-muted-foreground text-sm">Aucune donnée de conformité disponible.</div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* GP3: Policy Editor Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPolicy ? "Modifier la politique" : "Nouvelle politique"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select value={form.mode} onValueChange={v => setForm(f => ({ ...f, mode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODES.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v, settings: {} }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priorité</Label>
                  <Input
                    type="number"
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Politique parente (optionnel)</Label>
                <Select value={form.parent_id || "none"} onValueChange={v => setForm(f => ({ ...f, parent_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune (politique racine)</SelectItem>
                    {policies
                      .filter(p => p.id !== editingPolicy?.id)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              {/* GP3: Settings editor with category tabs */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileJson className="h-4 w-4" />
                  Paramètres — {form.category}
                </Label>
                <div className="border rounded-md p-4 bg-muted/20">
                  <SettingsEditor
                    category={form.category}
                    settings={form.settings}
                    onChange={s => setForm(f => ({ ...f, settings: s }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}>
                {editingPolicy ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* GP5: Template picker */}
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Templates CIS Benchmark & ANSSI</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-4">
              {POLICY_TEMPLATES.map(tpl => (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/40 cursor-pointer"
                  onClick={() => applyTemplate(tpl.id)}
                >
                  <div>
                    <div className="font-medium text-sm">{tpl.label}</div>
                    <div className="text-xs text-muted-foreground">{Object.keys(tpl.settings).length} paramètres</div>
                  </div>
                  <Badge variant="outline">{tpl.category}</Badge>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
