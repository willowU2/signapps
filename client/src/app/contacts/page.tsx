"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Plus, Search, Pencil, Trash2, Star, StarOff, UsersRound, Download, ArrowUpDown, Upload, GitMerge, Gift, Settings2, MapPin, Clock, Building2, History, Tag, X, FileDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { getClient, ServiceName } from "@/lib/api/factory"
import { contactsApi } from "@/lib/api/contacts"
import { EntityLinks } from "@/components/crosslinks/EntityLinks"
import { ContactGroups, type Group } from "@/components/contacts/contact-groups"
import { MergeContacts, type MergeableContact } from "@/components/contacts/merge-contacts"
import { BirthdayReminders } from "@/components/contacts/birthday-reminders"
import { CustomFieldsAdmin, CustomFieldForm, DEFAULT_FIELDS, type CustomFieldDef, type CustomFieldValue } from "@/components/contacts/custom-fields"
import { ContactMap } from "@/components/contacts/contact-map"
import { ContactHistory, type ContactActivity } from "@/components/contacts/contact-history"
import { CompanyRelations } from "@/components/contacts/company-relations"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  tags: string[]
  favorite: boolean
  group?: string
  birthday?: string
  city?: string
  country?: string
  companyId?: string
  customFields?: { fieldId: string; value: string }[]
}

type ActiveTab = "all" | "favorites" | "groups" | "merge" | "birthdays" | "map" | "history" | "company" | "fields"

// ─── Seed (shown only when API is unavailable) ───────────────────────────────

const SEED_CONTACTS: Contact[] = [
  { id: "1", name: "Alice Martin", email: "alice@example.com", phone: "+33 6 11 22 33 44", company: "Acme Corp", tags: ["client"], favorite: true, group: "Clients", birthday: "03-15", city: "Paris", country: "France" },
  { id: "2", name: "Bob Dupont",   email: "bob@example.com",   phone: "+33 6 55 66 77 88", company: "Beta Ltd",  tags: ["partner"], favorite: false, group: "Partenaires", birthday: "07-22", city: "Lyon", country: "France" },
  { id: "3", name: "Carol Blanc",  email: "carol@example.com",                             company: "Gamma SAS", tags: ["prospect"], favorite: false, group: "Prospects", city: "Marseille", country: "France" },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<ActiveTab>("all")
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Contact>>({ tags: [], favorite: false })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [contactGroups, setContactGroups] = useState<Group[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>(DEFAULT_FIELDS)
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValue[]>([])
  const [activities, setActivities] = useState<ContactActivity[]>([])
  const [selectedContactForHistory, setSelectedContactForHistory] = useState<string | null>(null)
  const [vcfImportFile, setVcfImportFile] = useState<File | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkTagInput, setBulkTagInput] = useState("")
  const [showBulkTag, setShowBulkTag] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const { data: contacts = SEED_CONTACTS, isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: async () => {
      const client = getClient(ServiceName.CONTACTS)
      const res = await client.get<Contact[]>("/contacts")
      return res.data ?? SEED_CONTACTS
    },
  })

  const loadContacts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] })
  }, [queryClient])

  // ── Filtered views ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => contacts.filter(c => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company?.toLowerCase().includes(q) ?? false) ||
      c.tags.some(t => t.toLowerCase().includes(q))

    if (activeTab === "favorites") return matchesSearch && c.favorite
    if (activeTab === "groups")    return matchesSearch && !!c.group
    return matchesSearch
  }), [contacts, search, activeTab])

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = (a as any)[sortField] ?? ''
      const bVal = (b as any)[sortField] ?? ''
      const cmp = String(aVal).localeCompare(String(bVal), 'fr', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortField, sortDir])

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const groups = useMemo(
    () => [...new Set(contacts.map(c => c.group).filter(Boolean))] as string[],
    [contacts]
  )

  // ── CRUD helpers ────────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email) return

    const payload: Contact = {
      id: editingId ?? String(Date.now()),
      name: form.name,
      email: form.email,
      phone: form.phone,
      company: form.company,
      tags: form.tags ?? [],
      favorite: form.favorite ?? false,
      group: form.group,
    }

    try {
      const client = getClient(ServiceName.CONTACTS)
      if (editingId) {
        await client.put(`/contacts/${editingId}`, payload)
      } else {
        await client.post("/contacts", payload)
      }
      loadContacts()
    } catch {
      // Optimistic local update when API is unavailable
      queryClient.setQueryData<Contact[]>(['contacts'], (prev = SEED_CONTACTS) =>
        editingId
          ? prev.map(c => c.id === editingId ? payload : c)
          : [...prev, payload]
      )
    }

    resetForm()
  }

  const handleEdit = (c: Contact) => {
    setEditingId(c.id)
    setForm({ ...c })
    setIsCreating(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget
    setDeleteTarget(null)
    try {
      const client = getClient(ServiceName.CONTACTS)
      await client.delete(`/contacts/${id}`)
      loadContacts()
    } catch {
      queryClient.setQueryData<Contact[]>(['contacts'], (prev = []) => prev.filter(c => c.id !== id))
    }
  }

  const toggleFavorite = async (c: Contact) => {
    const updated = { ...c, favorite: !c.favorite }
    try {
      const client = getClient(ServiceName.CONTACTS)
      await client.put(`/contacts/${c.id}`, updated)
      loadContacts()
    } catch {
      queryClient.setQueryData<Contact[]>(['contacts'], (prev = []) => prev.map(x => x.id === c.id ? updated : x))
    }
  }

  const resetForm = () => {
    setForm({ tags: [], favorite: false })
    setEditingId(null)
    setIsCreating(false)
  }

  const handleTagsChange = (value: string) => {
    setForm(f => ({ ...f, tags: value.split(",").map(t => t.trim()).filter(Boolean) }))
  }

  const handleExportVcf = async () => {
    try {
      const res = await contactsApi.exportVcf()
      const blob = new Blob([res.data as BlobPart], { type: 'text/vcard' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'contacts.vcf')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Contacts exportés en vCard.')
    } catch {
      toast.error('Erreur lors de l\'export vCard.')
    }
  }

  const handleImportVcf = async (file: File) => {
    try {
      await contactsApi.importVcf(file)
      loadContacts()
      toast.success('Contacts importés depuis le fichier VCF.')
    } catch {
      toast.error('Erreur lors de l\'import vCard.')
    }
  }

  const handleMerge = (keepId: string, removeId: string, merged: MergeableContact) => {
    queryClient.setQueryData<Contact[]>(['contacts'], (prev = []) =>
      prev.filter(c => c.id !== removeId).map(c => c.id === keepId ? { ...c, ...merged } : c)
    )
  }

  const handleContactGroupsChange = (newGroups: Group[]) => setContactGroups(newGroups)

  const handleCompanyUpdate = (contactId: string, companyId: string | undefined) => {
    queryClient.setQueryData<Contact[]>(['contacts'], (prev = []) =>
      prev.map(c => c.id === contactId ? { ...c, companyId } : c)
    )
  }

  // ── Bulk operations ──────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedFiltered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedFiltered.map(c => c.id)))
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    setBulkDeleteOpen(false)
    try {
      const client = getClient(ServiceName.CONTACTS)
      await Promise.all(ids.map(id => client.delete(`/contacts/${id}`)))
      loadContacts()
    } catch {
      queryClient.setQueryData<Contact[]>(['contacts'], (prev = []) =>
        prev.filter(c => !selectedIds.has(c.id))
      )
    }
    setSelectedIds(new Set())
    toast.success(`${ids.length} contact(s) supprime(s).`)
  }

  const handleBulkExportCsv = () => {
    const selected = contacts.filter(c => selectedIds.has(c.id))
    const header = "Nom,Email,Telephone,Entreprise,Tags"
    const rows = selected.map(c =>
      [c.name, c.email, c.phone ?? "", c.company ?? "", c.tags.join("; ")]
        .map(v => `"${v.replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "contacts-export.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success(`${selected.length} contact(s) exporte(s) en CSV.`)
  }

  const handleBulkAddTag = () => {
    if (!bulkTagInput.trim()) return
    const tag = bulkTagInput.trim()
    queryClient.setQueryData<Contact[]>(['contacts'], (prev = []) =>
      prev.map(c =>
        selectedIds.has(c.id) && !c.tags.includes(tag)
          ? { ...c, tags: [...c.tags, tag] }
          : c
      )
    )
    toast.success(`Tag "${tag}" ajoute a ${selectedIds.size} contact(s).`)
    setBulkTagInput("")
    setShowBulkTag(false)
    setSelectedIds(new Set())
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Contacts
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">Gérez vos contacts, favoris et groupes.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleExportVcf}>
              <Download className="h-4 w-4 mr-2" />
              Export VCF
            </Button>
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Import VCF
                </span>
              </Button>
              <input type="file" accept=".vcf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportVcf(f); }} />
            </label>
            <Button onClick={() => { resetForm(); setIsCreating(v => !v) }} className="shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-2" />
              {isCreating && !editingId ? "Annuler" : "Nouveau Contact"}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Total", value: contacts.length, icon: <Users className="h-4 w-4" />, gradient: "from-blue-500 to-indigo-500" },
            { label: "Favoris", value: contacts.filter(c => c.favorite).length, icon: <Star className="h-4 w-4" />, gradient: "from-amber-500 to-orange-500" },
            { label: "Groupes", value: groups.length, icon: <UsersRound className="h-4 w-4" />, gradient: "from-emerald-500 to-teal-500" },
          ].map(s => (
            <Card key={s.label} className="border-border/50 bg-card overflow-hidden relative group">
              <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${s.gradient} transform translate-y-1 group-hover:translate-y-0 transition-transform`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                <span className="text-muted-foreground">{s.icon}</span>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create / Edit form */}
        {isCreating && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>{editingId ? "Modifier le contact" : "Nouveau contact"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="c-name">Nom *</Label>
                  <Input id="c-name" required placeholder="Alice Martin" value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-email">Email *</Label>
                  <Input id="c-email" type="email" required placeholder="alice@example.com" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-phone">Téléphone</Label>
                  <Input id="c-phone" placeholder="+33 6 ..." value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-company">Entreprise</Label>
                  <Input id="c-company" placeholder="Acme Corp" value={form.company ?? ""} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-group">Groupe</Label>
                  <Input id="c-group" placeholder="Clients" value={form.group ?? ""} onChange={e => setForm(f => ({ ...f, group: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-tags">Tags (virgule)</Label>
                  <Input id="c-tags" placeholder="client, vip" value={(form.tags ?? []).join(", ")} onChange={e => handleTagsChange(e.target.value)} />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>
                  <Button type="submit">{editingId ? "Enregistrer" : "Créer"}</Button>
                </div>
              </form>
              {editingId && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <EntityLinks entityType="contact" entityId={editingId} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs + Search + Table */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as ActiveTab)}>
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex w-auto">
                <TabsTrigger value="all" className="text-xs sm:text-sm">Tous ({contacts.length})</TabsTrigger>
                <TabsTrigger value="favorites" className="text-xs sm:text-sm">Favoris</TabsTrigger>
                <TabsTrigger value="groups" className="text-xs sm:text-sm">Groupes</TabsTrigger>
                <TabsTrigger value="merge" className="text-xs sm:text-sm"><GitMerge className="h-3 w-3 mr-1" />Fusion</TabsTrigger>
                <TabsTrigger value="birthdays" className="text-xs sm:text-sm"><Gift className="h-3 w-3 mr-1" />Anniversaires</TabsTrigger>
                <TabsTrigger value="map" className="text-xs sm:text-sm"><MapPin className="h-3 w-3 mr-1" />Carte</TabsTrigger>
                <TabsTrigger value="history" className="text-xs sm:text-sm"><History className="h-3 w-3 mr-1" />Historique</TabsTrigger>
                <TabsTrigger value="company" className="text-xs sm:text-sm"><Building2 className="h-3 w-3 mr-1" />Entreprises</TabsTrigger>
                <TabsTrigger value="fields" className="text-xs sm:text-sm"><Settings2 className="h-3 w-3 mr-1" />Champs</TabsTrigger>
              </TabsList>
            </div>
            {(activeTab === "all" || activeTab === "favorites") && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Bulk action toolbar */}
          {selectedIds.size > 0 && (activeTab === "all" || activeTab === "favorites") && (
            <div className="flex items-center gap-2 flex-wrap rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
              <span className="text-sm font-medium">
                {selectedIds.size} selectionne{selectedIds.size > 1 ? "s" : ""}
              </span>
              <div className="flex-1" />
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleBulkExportCsv}>
                <FileDown className="h-3.5 w-3.5" />
                Exporter CSV
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowBulkTag(!showBulkTag)}>
                <Tag className="h-3.5 w-3.5" />
                Ajouter un tag
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </Button>
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3.5 w-3.5" />
              </Button>
              {showBulkTag && (
                <div className="flex items-center gap-2 w-full pt-2 border-t border-border/50 mt-1">
                  <Input
                    className="h-8 max-w-[200px]"
                    placeholder="Nom du tag..."
                    value={bulkTagInput}
                    onChange={e => setBulkTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleBulkAddTag() }}
                  />
                  <Button size="sm" onClick={handleBulkAddTag} disabled={!bulkTagInput.trim()}>
                    Ajouter
                  </Button>
                </div>
              )}
            </div>
          )}

          {(["all", "favorites"] as ActiveTab[]).map(tab => (
            <TabsContent key={tab} value={tab}>
              <Card className="border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={sortedFiltered.length > 0 && selectedIds.size === sortedFiltered.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Tout selectionner"
                        />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                        <span className="flex items-center gap-1">Nom {sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('email')}>
                        <span className="flex items-center gap-1">Email {sortField === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}</span>
                      </TableHead>
                      <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('phone')}>
                        <span className="flex items-center gap-1">Téléphone {sortField === 'phone' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}</span>
                      </TableHead>
                      <TableHead className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('company')}>
                        <span className="flex items-center gap-1">Entreprise {sortField === 'company' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}</span>
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">Tags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFiltered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Users className="h-10 w-10 text-muted-foreground/30" />
                            <div>
                              <p className="font-medium text-muted-foreground">
                                {search ? 'Aucun contact trouvé' : tab === 'favorites' ? 'Aucun favori' : 'Ajoutez votre premier contact'}
                              </p>
                              <p className="mt-0.5 text-sm text-muted-foreground/60">
                                {search ? 'Essayez un autre terme de recherche' : 'Cliquez sur "Nouveau Contact" pour commencer'}
                              </p>
                            </div>
                            {!search && tab === 'all' && (
                              <Button size="sm" onClick={() => { resetForm(); setIsCreating(true); }}>
                                <Plus className="mr-2 h-4 w-4" /> Nouveau contact
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {sortedFiltered.map(c => (
                      <TableRow key={c.id} className={selectedIds.has(c.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(c.id)}
                            onCheckedChange={() => toggleSelect(c.id)}
                            aria-label={`Selectionner ${c.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{c.phone ?? "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{c.company ?? "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {c.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" title="Favori" onClick={() => toggleFavorite(c)}>
                              {c.favorite ? <Star className="h-4 w-4 text-amber-500" /> : <StarOff className="h-4 w-4" />}
                            </Button>
                            <Button size="icon" variant="ghost" title="Modifier" onClick={() => handleEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Supprimer" onClick={() => setDeleteTarget(c.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          ))}

          <TabsContent value="groups">
            <div className="space-y-6">
              {/* Legacy group view */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map(group => {
                  const members = filtered.filter(c => c.group === group)
                  return (
                    <Card key={group} className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <UsersRound className="h-4 w-4 text-primary" />
                          {group}
                          <Badge variant="outline" className="ml-auto">{members.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        {members.map(c => (
                          <div key={c.id} className="flex items-center justify-between text-sm">
                            <span>{c.name}</span>
                            <span className="text-muted-foreground truncate max-w-[140px]">{c.email}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              {/* New contact groups component */}
              <ContactGroups
                contacts={contacts.map(c => ({ id: c.id, name: c.name, email: c.email }))}
                groups={contactGroups}
                onGroupsChange={handleContactGroupsChange}
              />
            </div>
          </TabsContent>

          <TabsContent value="merge">
            <Card className="border-border/50">
              <CardHeader><CardTitle className="flex items-center gap-2"><GitMerge className="h-4 w-4" /> Fusionner les doublons</CardTitle></CardHeader>
              <CardContent>
                <MergeContacts contacts={contacts} onMerge={handleMerge} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="birthdays">
            <Card className="border-border/50">
              <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-4 w-4" /> Anniversaires</CardTitle></CardHeader>
              <CardContent>
                <BirthdayReminders contacts={contacts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map">
            <Card className="border-border/50">
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Vue géographique</CardTitle></CardHeader>
              <CardContent>
                <ContactMap contacts={contacts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Historique des activités</CardTitle>
                  <select
                    value={selectedContactForHistory ?? ""}
                    onChange={e => setSelectedContactForHistory(e.target.value || null)}
                    className="h-8 rounded-md border text-sm px-2 bg-background"
                  >
                    <option value="">Sélectionner un contact...</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {selectedContactForHistory ? (
                  <ContactHistory
                    contactId={selectedContactForHistory}
                    contactName={contacts.find(c => c.id === selectedContactForHistory)?.name ?? ""}
                    activities={activities}
                    onAdd={a => setActivities(p => [a, ...p])}
                    onDelete={id => setActivities(p => p.filter(a => a.id !== id))}
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8 text-sm">Sélectionnez un contact pour voir son historique.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card className="border-border/50">
              <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Relations entreprises</CardTitle></CardHeader>
              <CardContent>
                <CompanyRelations
                  contacts={contacts.map(c => ({ id: c.id, name: c.name, email: c.email, company: c.company, companyId: c.companyId }))}
                  onContactUpdate={handleCompanyUpdate}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fields">
            <Card className="border-border/50">
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Champs personnalisés</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <CustomFieldsAdmin fields={customFields} onChange={setCustomFields} />
                {customFields.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Aperçu — Saisie sur un contact</p>
                    <CustomFieldForm fields={customFields} values={customFieldValues} onChange={setCustomFieldValues} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le contact sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedIds.size} contact(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les {selectedIds.size} contacts sélectionnés seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Supprimer tout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
