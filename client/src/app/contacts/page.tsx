"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Plus, Search, Pencil, Trash2, Star, StarOff, UsersRound } from "lucide-react"
import { getClient, ServiceName } from "@/lib/api/factory"

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
}

type ActiveTab = "all" | "favorites" | "groups"

// ─── Seed (shown only when API is unavailable) ───────────────────────────────

const SEED_CONTACTS: Contact[] = [
  { id: "1", name: "Alice Martin", email: "alice@example.com", phone: "+33 6 11 22 33 44", company: "Acme Corp", tags: ["client"], favorite: true, group: "Clients" },
  { id: "2", name: "Bob Dupont",   email: "bob@example.com",   phone: "+33 6 55 66 77 88", company: "Beta Ltd",  tags: ["partner"], favorite: false, group: "Partenaires" },
  { id: "3", name: "Carol Blanc",  email: "carol@example.com",                             company: "Gamma SAS", tags: ["prospect"], favorite: false, group: "Prospects" },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<ActiveTab>("all")
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Contact>>({ tags: [], favorite: false })

  useEffect(() => { loadContacts() }, [])

  const loadContacts = async () => {
    try {
      const client = getClient(ServiceName.CONTACTS)
      const res = await client.get<Contact[]>("/contacts")
      setContacts(res.data ?? [])
    } catch {
      console.debug("Contacts API unavailable, using seed data")
      setContacts(SEED_CONTACTS)
    }
  }

  // ── Filtered views ──────────────────────────────────────────────────────────

  const filtered = contacts.filter(c => {
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
  })

  const groups = [...new Set(contacts.map(c => c.group).filter(Boolean))] as string[]

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
      await loadContacts()
    } catch {
      // Optimistic local update when API is unavailable
      setContacts(prev =>
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

  const handleDelete = async (id: string) => {
    try {
      const client = getClient(ServiceName.CONTACTS)
      await client.delete(`/contacts/${id}`)
      await loadContacts()
    } catch {
      setContacts(prev => prev.filter(c => c.id !== id))
    }
  }

  const toggleFavorite = async (c: Contact) => {
    const updated = { ...c, favorite: !c.favorite }
    try {
      const client = getClient(ServiceName.CONTACTS)
      await client.put(`/contacts/${c.id}`, updated)
      await loadContacts()
    } catch {
      setContacts(prev => prev.map(x => x.id === c.id ? updated : x))
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

  // ── Render ──────────────────────────────────────────────────────────────────

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
          <Button onClick={() => { resetForm(); setIsCreating(v => !v) }} className="shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4 mr-2" />
            {isCreating && !editingId ? "Annuler" : "Nouveau Contact"}
          </Button>
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
            </CardContent>
          </Card>
        )}

        {/* Tabs + Search + Table */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as ActiveTab)}>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">Tous ({contacts.length})</TabsTrigger>
              <TabsTrigger value="favorites">Favoris ({contacts.filter(c => c.favorite).length})</TabsTrigger>
              <TabsTrigger value="groups">Groupes ({groups.length})</TabsTrigger>
            </TabsList>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Rechercher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {(["all", "favorites"] as ActiveTab[]).map(tab => (
            <TabsContent key={tab} value={tab}>
              <Card className="border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                      <TableHead className="hidden lg:table-cell">Entreprise</TableHead>
                      <TableHead className="hidden lg:table-cell">Tags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          Aucun contact trouvé.
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map(c => (
                      <TableRow key={c.id}>
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
                            <Button size="icon" variant="ghost" title="Supprimer" onClick={() => handleDelete(c.id)}>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groups.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-10">Aucun groupe défini.</p>
              )}
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
          </TabsContent>
        </Tabs>

      </div>
    </AppLayout>
  )
}
