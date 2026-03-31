"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Cloud, Server, Database, HardDrive, RefreshCw, Settings, AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { usePageTitle } from "@/hooks/use-page-title"

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "azure" | "aws" | "gcp"

interface CloudCredentials {
  azure?: { tenantId: string; clientId: string; clientSecret: string; subscriptionId: string }
  aws?: { accessKeyId: string; secretAccessKey: string; region: string }
  gcp?: { projectId: string; serviceAccountJson: string }
}

interface CloudResource {
  id: string
  name: string
  type: "vm" | "storage" | "db" | "network" | "other"
  status: "running" | "stopped" | "error" | "unknown"
  region: string
  costEstimate?: number
  provider: Provider
}

// ─── Mock resource data (used when credentials not yet configured) ─────────────

const MOCK_RESOURCES: CloudResource[] = [
  { id: "vm-001", name: "prod-web-01", type: "vm",      status: "running", region: "eastus",        costEstimate: 142.50, provider: "azure" },
  { id: "vm-002", name: "prod-db-01",  type: "vm",      status: "running", region: "eastus",        costEstimate: 284.00, provider: "azure" },
  { id: "st-001", name: "prodlogs",    type: "storage", status: "running", region: "eastus",        costEstimate:  18.40, provider: "azure" },
  { id: "db-001", name: "main-pg",     type: "db",      status: "running", region: "us-east-1",     costEstimate: 320.00, provider: "aws"   },
  { id: "vm-003", name: "staging-api", type: "vm",      status: "stopped", region: "us-east-1",     costEstimate:  56.00, provider: "aws"   },
  { id: "st-002", name: "backups-s3",  type: "storage", status: "running", region: "us-east-1",     costEstimate:  12.20, provider: "aws"   },
  { id: "vm-004", name: "gke-node-1",  type: "vm",      status: "running", region: "us-central1",   costEstimate: 210.00, provider: "gcp"   },
  { id: "db-002", name: "analytics-bq",type: "db",      status: "running", region: "us-central1",   costEstimate:  88.50, provider: "gcp"   },
]

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = "signapps_cloud_creds"

function loadCreds(): CloudCredentials {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveCreds(creds: CloudCredentials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
}

// ─── Fetch helpers (structured for future real API calls) ─────────────────────

async function fetchAzureResources(creds: CloudCredentials["azure"]): Promise<CloudResource[]> {
  if (!creds?.tenantId || !creds?.clientId || !creds?.clientSecret || !creds?.subscriptionId) {
    return MOCK_RESOURCES.filter(r => r.provider === "azure")
  }
  // Real call structure:
  // const tokenResp = await fetch(`https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`, { ... })
  // const { access_token } = await tokenResp.json()
  // const resp = await fetch(`https://management.azure.com/subscriptions/${creds.subscriptionId}/resources?api-version=2021-04-01`, { headers: { Authorization: `Bearer ${access_token}` } })
  return MOCK_RESOURCES.filter(r => r.provider === "azure")
}

async function fetchAwsResources(creds: CloudCredentials["aws"]): Promise<CloudResource[]> {
  if (!creds?.accessKeyId || !creds?.secretAccessKey) {
    return MOCK_RESOURCES.filter(r => r.provider === "aws")
  }
  // Real call structure uses AWS SDK or signed requests to EC2/RDS/S3 APIs
  return MOCK_RESOURCES.filter(r => r.provider === "aws")
}

async function fetchGcpResources(creds: CloudCredentials["gcp"]): Promise<CloudResource[]> {
  if (!creds?.projectId || !creds?.serviceAccountJson) {
    return MOCK_RESOURCES.filter(r => r.provider === "gcp")
  }
  // Real call: https://compute.googleapis.com/compute/v1/projects/${creds.projectId}/aggregated/instances
  return MOCK_RESOURCES.filter(r => r.provider === "gcp")
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CloudResource["status"] }) {
  const map: Record<CloudResource["status"], { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    running: { label: "Running", icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
    stopped: { label: "Stopped", icon: <XCircle className="h-3 w-3" />,    variant: "secondary" },
    error:   { label: "Error",   icon: <AlertCircle className="h-3 w-3" />, variant: "destructive" },
    unknown: { label: "Unknown", icon: <AlertCircle className="h-3 w-3" />, variant: "outline" },
  }
  const { label, icon, variant } = map[status]
  return (
    <Badge variant={variant} className="gap-1">
      {icon}{label}
    </Badge>
  )
}

function ResourceTypeIcon({ type }: { type: CloudResource["type"] }) {
  const icons: Record<CloudResource["type"], React.ReactNode> = {
    vm:      <Server   className="h-4 w-4 text-blue-500" />,
    storage: <HardDrive className="h-4 w-4 text-orange-500" />,
    db:      <Database className="h-4 w-4 text-purple-500" />,
    network: <Cloud    className="h-4 w-4 text-cyan-500" />,
    other:   <Settings className="h-4 w-4 text-muted-foreground" />,
  }
  return <>{icons[type]}</>
}

function ResourceTable({ resources, loading }: { resources: CloudResource[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading resources…</p>
  if (resources.length === 0) return (
    <p className="text-sm text-muted-foreground py-6 text-center">No resources found. Configure credentials above or check your permissions.</p>
  )
  const total = resources.reduce((acc, r) => acc + (r.costEstimate ?? 0), 0)
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Region</TableHead>
            <TableHead className="text-right">Est. monthly cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map(r => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5 capitalize">
                  <ResourceTypeIcon type={r.type} />
                  {r.type}
                </span>
              </TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.region}</TableCell>
              <TableCell className="text-right text-sm">
                {r.costEstimate != null ? `$${r.costEstimate.toFixed(2)}` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end px-4 py-2 border-t text-sm font-semibold">
        Total: ${total.toFixed(2)} / mo
      </div>
    </>
  )
}

// ─── Azure Credentials Panel ──────────────────────────────────────────────────

function AzureCredPanel({ creds, onSave }: { creds: CloudCredentials["azure"]; onSave: (c: CloudCredentials["azure"]) => void }) {
  const [form, setForm] = useState(creds ?? { tenantId: "", clientId: "", clientSecret: "", subscriptionId: "" })
  const configured = !!(creds?.tenantId && creds?.clientId)
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Azure Credentials
          {configured && <Badge variant="default" className="ml-auto text-xs">Configured</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Tenant ID</Label><Input className="mt-1" value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
          <div><Label className="text-xs">Subscription ID</Label><Input className="mt-1" value={form.subscriptionId} onChange={e => setForm(f => ({ ...f, subscriptionId: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
          <div><Label className="text-xs">Client ID</Label><Input className="mt-1" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} placeholder="App (client) ID" /></div>
          <div><Label className="text-xs">Client Secret</Label><Input className="mt-1" type="password" value={form.clientSecret} onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))} placeholder="Secret value" /></div>
        </div>
        <Button size="sm" className="mt-3" onClick={() => onSave(form)}>Save credentials</Button>
      </CardContent>
    </Card>
  )
}

// ─── AWS Credentials Panel ────────────────────────────────────────────────────

function AwsCredPanel({ creds, onSave }: { creds: CloudCredentials["aws"]; onSave: (c: CloudCredentials["aws"]) => void }) {
  const [form, setForm] = useState(creds ?? { accessKeyId: "", secretAccessKey: "", region: "us-east-1" })
  const configured = !!(creds?.accessKeyId)
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="h-4 w-4" />
          AWS Credentials
          {configured && <Badge variant="default" className="ml-auto text-xs">Configured</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Access Key ID</Label><Input className="mt-1" value={form.accessKeyId} onChange={e => setForm(f => ({ ...f, accessKeyId: e.target.value }))} placeholder="AKIA…" /></div>
          <div><Label className="text-xs">Secret Access Key</Label><Input className="mt-1" type="password" value={form.secretAccessKey} onChange={e => setForm(f => ({ ...f, secretAccessKey: e.target.value }))} placeholder="Secret…" /></div>
          <div><Label className="text-xs">Default Region</Label><Input className="mt-1" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="us-east-1" /></div>
        </div>
        <Button size="sm" className="mt-3" onClick={() => onSave(form)}>Save credentials</Button>
      </CardContent>
    </Card>
  )
}

// ─── GCP Credentials Panel ────────────────────────────────────────────────────

function GcpCredPanel({ creds, onSave }: { creds: CloudCredentials["gcp"]; onSave: (c: CloudCredentials["gcp"]) => void }) {
  const [form, setForm] = useState(creds ?? { projectId: "", serviceAccountJson: "" })
  const configured = !!(creds?.projectId)
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="h-4 w-4" />
          GCP Credentials
          {configured && <Badge variant="default" className="ml-auto text-xs">Configured</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div><Label className="text-xs">Project ID</Label><Input className="mt-1" value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} placeholder="my-project-123" /></div>
          <div><Label className="text-xs">Service Account JSON</Label><textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-24 resize-y" value={form.serviceAccountJson} onChange={e => setForm(f => ({ ...f, serviceAccountJson: e.target.value }))} placeholder='{"type":"service_account","project_id":"…"}' /></div>
        </div>
        <Button size="sm" className="mt-3" onClick={() => onSave(form)}>Save credentials</Button>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CloudMonitoringPage() {
  usePageTitle("Cloud Monitoring")
  const [creds, setCreds] = useState<CloudCredentials>({})
  const [resources, setResources] = useState<{ azure: CloudResource[]; aws: CloudResource[]; gcp: CloudResource[] }>({ azure: [], aws: [], gcp: [] })
  const [loading, setLoading] = useState<Record<Provider, boolean>>({ azure: false, aws: false, gcp: false })

  useEffect(() => {
    setCreds(loadCreds())
  }, [])

  async function loadResources(provider: Provider) {
    setLoading(l => ({ ...l, [provider]: true }))
    try {
      let res: CloudResource[] = []
      if (provider === "azure") res = await fetchAzureResources(creds.azure)
      if (provider === "aws")   res = await fetchAwsResources(creds.aws)
      if (provider === "gcp")   res = await fetchGcpResources(creds.gcp)
      setResources(r => ({ ...r, [provider]: res }))
    } finally {
      setLoading(l => ({ ...l, [provider]: false }))
    }
  }

  function saveCred(provider: Provider, value: CloudCredentials[Provider]) {
    const updated = { ...creds, [provider]: value }
    setCreds(updated)
    saveCreds(updated)
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            Cloud Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor resources across Azure, AWS and GCP from a single pane</p>
        </div>

        <Tabs defaultValue="azure">
          <TabsList>
            <TabsTrigger value="azure">Azure</TabsTrigger>
            <TabsTrigger value="aws">AWS</TabsTrigger>
            <TabsTrigger value="gcp">GCP</TabsTrigger>
          </TabsList>

          {/* Azure */}
          <TabsContent value="azure" className="space-y-4 mt-4">
            <AzureCredPanel creds={creds.azure} onSave={v => saveCred("azure", v)} />
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Resources</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => loadResources("azure")} disabled={loading.azure}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading.azure ? "animate-spin" : ""}`} />
                    {resources.azure.length === 0 ? "Load resources" : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ResourceTable resources={resources.azure} loading={loading.azure} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* AWS */}
          <TabsContent value="aws" className="space-y-4 mt-4">
            <AwsCredPanel creds={creds.aws} onSave={v => saveCred("aws", v)} />
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Resources</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => loadResources("aws")} disabled={loading.aws}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading.aws ? "animate-spin" : ""}`} />
                    {resources.aws.length === 0 ? "Load resources" : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ResourceTable resources={resources.aws} loading={loading.aws} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* GCP */}
          <TabsContent value="gcp" className="space-y-4 mt-4">
            <GcpCredPanel creds={creds.gcp} onSave={v => saveCred("gcp", v)} />
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Resources</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => loadResources("gcp")} disabled={loading.gcp}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading.gcp ? "animate-spin" : ""}`} />
                    {resources.gcp.length === 0 ? "Load resources" : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ResourceTable resources={resources.gcp} loading={loading.gcp} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
