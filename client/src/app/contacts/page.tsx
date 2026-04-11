"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTableKeyboard } from "@/hooks/use-table-keyboard";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Star,
  StarOff,
  UsersRound,
  Download,
  ArrowUpDown,
  Upload,
  GitMerge,
  Gift,
  Settings2,
  MapPin,
  Clock,
  Building2,
  History,
  Tag,
  X,
  FileDown,
  Mail,
  Printer,
  Phone,
  TrendingUp,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";
import { contactsApi } from "@/lib/api/contacts";
import { ExportButton } from "@/components/ui/export-button";
import { EntityLinks } from "@/components/crosslinks/EntityLinks";
import {
  ContactGroups,
  type Group,
} from "@/components/contacts/contact-groups";
import {
  MergeContacts,
  type MergeableContact,
} from "@/components/contacts/merge-contacts";
import { BirthdayReminders } from "@/components/contacts/birthday-reminders";
import {
  CustomFieldsAdmin,
  CustomFieldForm,
  DEFAULT_FIELDS,
  type CustomFieldDef,
  type CustomFieldValue,
} from "@/components/contacts/custom-fields";
import { ContactMap } from "@/components/contacts/contact-map";
import {
  ContactHistory,
  type ContactActivity,
} from "@/components/contacts/contact-history";
import { CompanyRelations } from "@/components/contacts/company-relations";
import { ContactEmailPanel } from "@/components/contacts/contact-email-panel";
import { Customer360View } from "@/components/interop/Customer360View";
import {
  autoCreateLeadFromContact,
  mergeContactReferences,
} from "@/lib/api/interop";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tags: string[];
  favorite: boolean;
  group?: string;
  birthday?: string;
  city?: string;
  country?: string;
  companyId?: string;
  customFields?: { fieldId: string; value: string }[];
}

type ActiveTab =
  | "all"
  | "favorites"
  | "groups"
  | "merge"
  | "birthdays"
  | "map"
  | "history"
  | "company"
  | "fields"
  | "360";

// ─── Seed (shown only when API is unavailable) ───────────────────────────────

const SEED_CONTACTS: Contact[] = [];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  usePageTitle("Contacts");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Contact>>({
    tags: [],
    favorite: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [contactGroups, setContactGroups] = useState<Group[]>([]);
  const [customFields, setCustomFields] =
    useState<CustomFieldDef[]>(DEFAULT_FIELDS);
  const [customFieldValues, setCustomFieldValues] = useState<
    CustomFieldValue[]
  >([]);
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [selectedContactForHistory, setSelectedContactForHistory] = useState<
    string | null
  >(null);
  const [vcfImportFile, setVcfImportFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [emailPanelContactId, setEmailPanelContactId] = useState<string | null>(
    null,
  );
  const [inlineEdit, setInlineEdit] = useState<{
    contactId: string;
    field: "name" | "email" | "phone";
    value: string;
  } | null>(null);

  // ── Group management dialog state ────────────────────────────────────────────
  const [isGroupsDialogOpen, setIsGroupsDialogOpen] = useState(false);
  const [apiGroups, setApiGroups] = useState<
    { id: string; name: string; color?: string }[]
  >([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#6366f1");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupColor, setEditingGroupColor] = useState("#6366f1");
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<string | null>(
    null,
  );

  // Map backend snake_case (first_name / last_name / organization) → UI Contact shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapBackendContact = (d: any): Contact => ({
    id: d.id,
    name: [d.first_name, d.last_name].filter(Boolean).join(" ") || d.name || "",
    email: d.email ?? "",
    phone: d.phone ?? undefined,
    company: d.organization ?? d.company ?? undefined,
    tags: d.tags ?? [],
    favorite: d.favorite ?? false,
    group: d.group ?? undefined,
    birthday: d.birthday ?? undefined,
    city: d.city ?? undefined,
    country: d.country ?? undefined,
    companyId: d.companyId ?? undefined,
    customFields: d.customFields ?? undefined,
  });

  const {
    data: contacts = SEED_CONTACTS,
    isLoading,
    isError,
    refetch,
  } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const client = getClient(ServiceName.CONTACTS);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await client.get<any[]>("/contacts");
      if (!res.data) return SEED_CONTACTS;
      return res.data.map(mapBackendContact);
    },
    retry: 1,
  });

  const loadContacts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  }, [queryClient]);

  // ── Filtered views ──────────────────────────────────────────────────────────

  const filtered = useMemo(
    () =>
      contacts.filter((c) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company?.toLowerCase().includes(q) ?? false) ||
          c.tags.some((t) => t.toLowerCase().includes(q));

        if (activeTab === "favorites") return matchesSearch && c.favorite;
        if (activeTab === "groups") return matchesSearch && !!c.group;
        return matchesSearch;
      }),
    [contacts, search, activeTab],
  );

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField as keyof Contact] ?? "";
      const bVal = b[sortField as keyof Contact] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal), "fr", {
        numeric: true,
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const groups = useMemo(
    () =>
      [...new Set(contacts.map((c) => c.group).filter(Boolean))] as string[],
    [contacts],
  );

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const {
    focusedRow,
    tableRef: contactsTableRef,
    getRowProps: getContactRowProps,
  } = useTableKeyboard({
    rowCount: sortedFiltered.length,
    onOpen: (index) => {
      const contact = sortedFiltered[index];
      if (contact) handleEdit(contact);
    },
    onDelete: (index) => {
      const contact = sortedFiltered[index];
      if (contact) setDeleteTarget(contact.id);
    },
    onSelect: (index) => {
      const contact = sortedFiltered[index];
      if (contact) toggleSelect(contact.id);
    },
    enabled:
      !isCreating &&
      !deleteTarget &&
      (activeTab === "all" || activeTab === "favorites"),
  });

  // ── CRUD helpers ────────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    // Split "Prénom Nom" → first_name / last_name for backend
    const nameParts = (form.name ?? "").trim().split(/\s+/);
    const first_name = nameParts[0] ?? "";
    const last_name = nameParts.slice(1).join(" ");

    const payload: Contact = {
      id: editingId ?? String(Date.now()),
      name: form.name,
      email: form.email,
      phone: form.phone,
      company: form.company,
      tags: form.tags ?? [],
      favorite: form.favorite ?? false,
      group: form.group,
    };

    // Backend-compatible payload
    const backendPayload = {
      first_name,
      last_name,
      email: form.email,
      phone: form.phone,
      organization: form.company,
      job_title: undefined as string | undefined,
    };

    const isNew = !editingId;

    try {
      const client = getClient(ServiceName.CONTACTS);
      if (editingId) {
        await client.put(`/contacts/${editingId}`, backendPayload);
      } else {
        await client.post("/contacts", backendPayload);
      }
      loadContacts();
    } catch {
      // Optimistic local update when API is unavailable
      queryClient.setQueryData<Contact[]>(
        ["contacts"],
        (prev = SEED_CONTACTS) =>
          editingId
            ? prev.map((c) => (c.id === editingId ? payload : c))
            : [...prev, payload],
      );
    }

    // Feature 15: Contact import → auto-create CRM lead (only for new contacts)
    if (isNew && payload.tags?.includes("prospect")) {
      await autoCreateLeadFromContact({
        id: payload.id,
        name: payload.name,
        email: payload.email,
        company: payload.company,
      });
      toast.info("Lead CRM créé automatiquement pour ce prospect.");
    }

    resetForm();
  };

  const handleEdit = (c: Contact) => {
    setEditingId(c.id);
    setForm({ ...c });
    setIsCreating(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      const client = getClient(ServiceName.CONTACTS);
      await client.delete(`/contacts/${id}`);
      loadContacts();
    } catch {
      queryClient.setQueryData<Contact[]>(["contacts"], (prev = []) =>
        prev.filter((c) => c.id !== id),
      );
    }
  };

  const toggleFavorite = async (c: Contact) => {
    const updated = { ...c, favorite: !c.favorite };
    try {
      const client = getClient(ServiceName.CONTACTS);
      await client.put(`/contacts/${c.id}`, updated);
      loadContacts();
    } catch {
      queryClient.setQueryData<Contact[]>(["contacts"], (prev = []) =>
        prev.map((x) => (x.id === c.id ? updated : x)),
      );
    }
  };

  const resetForm = () => {
    setForm({ tags: [], favorite: false });
    setEditingId(null);
    setIsCreating(false);
  };

  const startInlineEdit = (
    contact: Contact,
    field: "name" | "email" | "phone",
  ) => {
    setInlineEdit({
      contactId: contact.id,
      field,
      value: contact[field] ?? "",
    });
  };

  const saveInlineEdit = async () => {
    if (!inlineEdit) return;
    const { contactId, field, value } = inlineEdit;
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) {
      setInlineEdit(null);
      return;
    }

    // Don't save if unchanged
    if ((contact[field] ?? "") === value) {
      setInlineEdit(null);
      return;
    }

    // Validate: name and email are required
    if (field === "name" && !value.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    if (field === "email" && !value.trim()) {
      toast.error("L'email est obligatoire");
      return;
    }

    const updated = { ...contact, [field]: value.trim() || undefined };
    setInlineEdit(null);

    // Build backend-compatible partial update payload
    let backendPatch: Record<string, string | undefined> = {};
    if (field === "name") {
      const parts = value.trim().split(/\s+/);
      backendPatch = {
        first_name: parts[0] ?? "",
        last_name: parts.slice(1).join(" ") || undefined,
      };
    } else if (field === "email") {
      backendPatch = { email: value.trim() || undefined };
    } else if (field === "phone") {
      backendPatch = { phone: value.trim() || undefined };
    }

    try {
      const client = getClient(ServiceName.CONTACTS);
      await client.put(`/contacts/${contactId}`, backendPatch);
      loadContacts();
    } catch {
      queryClient.setQueryData<Contact[]>(["contacts"], (prev = []) =>
        prev.map((c) => (c.id === contactId ? updated : c)),
      );
    }
    toast.success(
      `${field === "name" ? "Nom" : field === "email" ? "Email" : "Téléphone"} mis à jour`,
    );
  };

  const cancelInlineEdit = () => setInlineEdit(null);

  const handleTagsChange = (value: string) => {
    setForm((f) => ({
      ...f,
      tags: value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    }));
  };

  const handleExportVcf = async () => {
    try {
      const res = await contactsApi.exportVcf();
      const blob = new Blob([res.data as BlobPart], { type: "text/vcard" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "contacts.vcf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Contacts exportés en vCard.");
    } catch {
      toast.error("Erreur lors de l'export vCard.");
    }
  };

  const handleImportVcf = async (file: File) => {
    try {
      await contactsApi.importVcf(file);
      loadContacts();
      toast.success("Contacts importés depuis le fichier VCF.");
    } catch {
      toast.error("Erreur lors de l'import vCard.");
    }
  };

  const handleMerge = async (
    keepId: string,
    removeId: string,
    merged: MergeableContact,
  ) => {
    // Feature 19: Contact merge → update CRM and billing references
    const keepContact = contacts.find((c) => c.id === keepId);
    await mergeContactReferences(
      keepId,
      removeId,
      keepContact?.email ?? merged.email,
    );
    queryClient.setQueryData<Contact[]>(["contacts"], (prev = []) =>
      prev
        .filter((c) => c.id !== removeId)
        .map((c) => (c.id === keepId ? { ...c, ...merged } : c)),
    );
  };

  const handleContactGroupsChange = (newGroups: Group[]) =>
    setContactGroups(newGroups);

  // ── Group management API helpers ─────────────────────────────────────────────

  const loadApiGroups = useCallback(async () => {
    try {
      const client = getClient(ServiceName.CONTACTS);
      const res =
        await client.get<{ id: string; name: string; color?: string }[]>(
          "/contacts/groups",
        );
      setApiGroups(res.data ?? []);
    } catch {
      // ignore — groups remain as-is
    }
  }, []);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const client = getClient(ServiceName.CONTACTS);
      await client.post("/contacts/groups", {
        name: newGroupName.trim(),
        color: newGroupColor,
      });
      setNewGroupName("");
      setNewGroupColor("#6366f1");
      await loadApiGroups();
      toast.success("Groupe créé.");
    } catch {
      toast.error("Impossible de créer le groupe.");
    }
  };

  const handleUpdateGroup = async (id: string) => {
    if (!editingGroupName.trim()) return;
    try {
      const client = getClient(ServiceName.CONTACTS);
      await client.put(`/contacts/groups/${id}`, {
        name: editingGroupName.trim(),
        color: editingGroupColor,
      });
      setEditingGroupId(null);
      await loadApiGroups();
      toast.success("Groupe mis à jour.");
    } catch {
      toast.error("Impossible de modifier le groupe.");
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      const client = getClient(ServiceName.CONTACTS);
      await client.delete(`/contacts/groups/${id}`);
      setGroupDeleteTarget(null);
      await loadApiGroups();
      toast.success("Groupe supprimé.");
    } catch {
      toast.error("Impossible de supprimer le groupe.");
    }
  };

  const handleAssignGroup = async (contactId: string, groupId: string) => {
    try {
      const client = getClient(ServiceName.CONTACTS);
      await client.post(`/contacts/groups/${groupId}/members`, {
        contact_id: contactId,
      });
      toast.success("Contact ajouté au groupe.");
    } catch {
      toast.error("Impossible d'assigner le groupe.");
    }
  };

  const handleRemoveFromGroup = async (contactId: string, groupId: string) => {
    try {
      const client = getClient(ServiceName.CONTACTS);
      await client.delete(`/contacts/groups/${groupId}/members/${contactId}`);
      toast.success("Contact retiré du groupe.");
    } catch {
      toast.error("Impossible de retirer du groupe.");
    }
  };

  const openGroupsDialog = () => {
    loadApiGroups();
    setIsGroupsDialogOpen(true);
  };

  const handleCompanyUpdate = (
    contactId: string,
    companyId: string | undefined,
  ) => {
    queryClient.setQueryData<Contact[]>(["contacts"], (prev = []) =>
      prev.map((c) => (c.id === contactId ? { ...c, companyId } : c)),
    );
  };

  // ── Bulk operations ──────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedFiltered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedFiltered.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setBulkDeleteOpen(false);
    try {
      const client = getClient(ServiceName.CONTACTS);
      await Promise.all(ids.map((id) => client.delete(`/contacts/${id}`)));
      loadContacts();
    } catch {
      queryClient.setQueryData<Contact[]>(["contacts"], (prev = []) =>
        prev.filter((c) => !selectedIds.has(c.id)),
      );
    }
    setSelectedIds(new Set());
    toast.success(`${ids.length} contact(s) supprime(s).`);
  };

  const handleBulkExportCsv = () => {
    const selected = contacts.filter((c) => selectedIds.has(c.id));
    const header = "Nom,Email,Telephone,Entreprise,Tags";
    const rows = selected.map((c) =>
      [c.name, c.email, c.phone ?? "", c.company ?? "", c.tags.join("; ")]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contacts-export.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`${selected.length} contact(s) exporte(s) en CSV.`);
  };

  const handleBulkAddTag = () => {
    if (!bulkTagInput.trim()) return;
    const tag = bulkTagInput.trim();
    queryClient.setQueryData<Contact[]>(["contacts"], (prev = []) =>
      prev.map((c) =>
        selectedIds.has(c.id) && !c.tags.includes(tag)
          ? { ...c, tags: [...c.tags, tag] }
          : c,
      ),
    );
    toast.success(`Tag "${tag}" ajoute a ${selectedIds.size} contact(s).`);
    setBulkTagInput("");
    setShowBulkTag(false);
    setSelectedIds(new Set());
  };

  // ── Print handler ──────────────────────────────────────────────────────────
  const handlePrintContacts = useCallback(() => {
    const header = `<div class="print-header"><h1>SignApps Platform — Contacts</h1><p>${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p></div>`;
    const rows = sortedFiltered
      .map(
        (c) =>
          `<tr><td>${c.name}</td><td>${c.email}</td><td>${c.phone ?? "—"}</td><td>${c.company ?? "—"}</td></tr>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Contacts — SignApps</title>
<style>
@media print { @page { margin: 1.5cm; size: A4 portrait; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
body { font-family: Arial, sans-serif; color: #1f1f1f; background: #fff; margin: 0; padding: 20px; }
.print-header { text-align: center; margin-bottom: 1cm; padding-bottom: 0.5cm; border-bottom: 2px solid #1a73e8; }
.print-header h1 { font-size: 18pt; color: #1a73e8; margin: 0 0 4px; }
.print-header p { font-size: 10pt; color: #666; margin: 0; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; }
th { background: #f5f5f5; font-size: 11px; font-weight: 700; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ddd; }
td { font-size: 11px; padding: 6px 10px; border-bottom: 1px solid #eee; }
tr:nth-child(even) { background: #fafafa; }
.footer { margin-top: 24px; font-size: 9px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 8px; }
</style></head><body>
${header}
<table><thead><tr><th>Nom</th><th>Email</th><th>Telephone</th><th>Entreprise</th></tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Genere le ${new Date().toLocaleDateString("fr-FR")} a ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — SignApps Contacts (${sortedFiltered.length} contacts)</div>
</body></html>`;
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) {
      toast.error("Veuillez autoriser les popups pour imprimer.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  }, [sortedFiltered]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading && contacts.length === 0) {
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
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Offline warning banner */}
        {isError && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <Users className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Service contacts indisponible — affichage des données
              d&apos;exemple.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              onClick={() => refetch()}
            >
              Réessayer
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Contacts
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Gérez vos contacts, favoris et groupes.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ExportButton
              data={sortedFiltered.map((c) => ({
                name: c.name,
                email: c.email,
                phone: c.phone || "",
                company: c.company || "",
                tags: c.tags.join("; "),
                favorite: c.favorite ? "Oui" : "Non",
                group: c.group || "",
              }))}
              filename={`contacts-${new Date().toISOString().slice(0, 10)}`}
              columns={{
                name: "Nom",
                email: "Email",
                phone: "Telephone",
                company: "Entreprise",
                tags: "Tags",
                favorite: "Favori",
                group: "Groupe",
              }}
            />
            <Button
              variant="outline"
              onClick={handlePrintContacts}
              className="no-print"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
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
              <input
                type="file"
                accept=".vcf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportVcf(f);
                }}
              />
            </label>
            {/* MG3: CSV import */}
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer CSV
                </span>
              </Button>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const formData = new FormData();
                  formData.append("file", f);
                  try {
                    const client = getClient(ServiceName.CONTACTS);
                    const res = await client.post<{
                      imported: number;
                      skipped: number;
                      failed: number;
                    }>("/contacts/import/csv", formData);
                    toast.success(
                      `Import CSV: ${res.data.imported} importés, ${res.data.skipped} ignorés, ${res.data.failed} échecs`,
                    );
                    loadContacts();
                  } catch {
                    toast.error("Échec de l'import CSV");
                  }
                }}
              />
            </label>
            <Button variant="outline" onClick={openGroupsDialog}>
              <UsersRound className="h-4 w-4 mr-2" />
              Gérer les groupes
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setIsCreating((v) => !v);
              }}
              className="shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isCreating && !editingId ? "Annuler" : "Nouveau Contact"}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Total",
              value: contacts.length,
              icon: <Users className="h-4 w-4" />,
              gradient: "from-blue-500 to-indigo-500",
            },
            {
              label: "Favoris",
              value: contacts.filter((c) => c.favorite).length,
              icon: <Star className="h-4 w-4" />,
              gradient: "from-amber-500 to-orange-500",
            },
            {
              label: "Groupes",
              value: groups.length,
              icon: <UsersRound className="h-4 w-4" />,
              gradient: "from-emerald-500 to-teal-500",
            },
          ].map((s) => (
            <Card
              key={s.label}
              className="border-border/50 bg-card overflow-hidden relative group"
            >
              <div
                className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${s.gradient} transform translate-y-1 group-hover:translate-y-0 transition-transform`}
              />
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
              <CardTitle>
                {editingId ? "Modifier le contact" : "Nouveau contact"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleSave}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <div className="space-y-1">
                  <Label htmlFor="c-name">
                    Nom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="c-name"
                    required
                    autoFocus
                    placeholder="Alice Martin"
                    value={form.name ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="c-email"
                    type="email"
                    required
                    placeholder="alice@example.com"
                    value={form.email ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-phone">
                    Téléphone{" "}
                    <span className="text-muted-foreground font-normal">
                      (optionnel)
                    </span>
                  </Label>
                  <Input
                    id="c-phone"
                    placeholder="+33 6 ..."
                    value={form.phone ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-company">
                    Entreprise{" "}
                    <span className="text-muted-foreground font-normal">
                      (optionnel)
                    </span>
                  </Label>
                  <Input
                    id="c-company"
                    placeholder="Acme Corp"
                    value={form.company ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, company: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-group">
                    Groupe{" "}
                    <span className="text-muted-foreground font-normal">
                      (optionnel)
                    </span>
                  </Label>
                  <Input
                    id="c-group"
                    placeholder="Clients"
                    value={form.group ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, group: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-tags">
                    Tags{" "}
                    <span className="text-muted-foreground font-normal">
                      (optionnel)
                    </span>
                  </Label>
                  <Input
                    id="c-tags"
                    placeholder="client, vip"
                    value={(form.tags ?? []).join(", ")}
                    onChange={(e) => handleTagsChange(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annuler
                  </Button>
                  <Button type="submit">
                    {editingId ? "Enregistrer" : "Créer"}
                  </Button>
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
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ActiveTab)}
        >
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex w-auto">
                <TabsTrigger value="all" className="text-xs sm:text-sm">
                  Tous ({contacts.length})
                </TabsTrigger>
                <TabsTrigger value="favorites" className="text-xs sm:text-sm">
                  Favoris
                </TabsTrigger>
                <TabsTrigger value="groups" className="text-xs sm:text-sm">
                  Groupes
                </TabsTrigger>
                <TabsTrigger value="merge" className="text-xs sm:text-sm">
                  <GitMerge className="h-3 w-3 mr-1" />
                  Fusion
                </TabsTrigger>
                <TabsTrigger value="birthdays" className="text-xs sm:text-sm">
                  <Gift className="h-3 w-3 mr-1" />
                  Anniversaires
                </TabsTrigger>
                <TabsTrigger value="map" className="text-xs sm:text-sm">
                  <MapPin className="h-3 w-3 mr-1" />
                  Carte
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs sm:text-sm">
                  <History className="h-3 w-3 mr-1" />
                  Historique
                </TabsTrigger>
                <TabsTrigger value="company" className="text-xs sm:text-sm">
                  <Building2 className="h-3 w-3 mr-1" />
                  Entreprises
                </TabsTrigger>
                <TabsTrigger value="fields" className="text-xs sm:text-sm">
                  <Settings2 className="h-3 w-3 mr-1" />
                  Champs
                </TabsTrigger>
                <TabsTrigger value="360" className="text-xs sm:text-sm">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Vue 360°
                </TabsTrigger>
              </TabsList>
            </div>
            {(activeTab === "all" || activeTab === "favorites") && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Bulk action toolbar */}
          {selectedIds.size > 0 &&
            (activeTab === "all" || activeTab === "favorites") && (
              <div className="flex items-center gap-2 flex-wrap rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                <span className="text-sm font-medium">
                  {selectedIds.size} selectionne
                  {selectedIds.size > 1 ? "s" : ""}
                </span>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleBulkExportCsv}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Exporter CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setShowBulkTag(!showBulkTag)}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Ajouter un tag
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                {showBulkTag && (
                  <div className="flex items-center gap-2 w-full pt-2 border-t border-border/50 mt-1">
                    <Input
                      className="h-8 max-w-[200px]"
                      placeholder="Nom du tag..."
                      value={bulkTagInput}
                      onChange={(e) => setBulkTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleBulkAddTag();
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleBulkAddTag}
                      disabled={!bulkTagInput.trim()}
                    >
                      Ajouter
                    </Button>
                  </div>
                )}
              </div>
            )}

          {(["all", "favorites"] as ActiveTab[]).map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card
                className="border-border/50"
                ref={contactsTableRef as React.RefObject<HTMLDivElement | null>}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            sortedFiltered.length > 0 &&
                            selectedIds.size === sortedFiltered.length
                          }
                          onCheckedChange={toggleSelectAll}
                          aria-label="Tout selectionner"
                        />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("name")}
                      >
                        <span className="flex items-center gap-1">
                          Nom{" "}
                          {sortField === "name" ? (
                            sortDir === "asc" ? (
                              "↑"
                            ) : (
                              "↓"
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                          )}
                        </span>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("email")}
                      >
                        <span className="flex items-center gap-1">
                          Email{" "}
                          {sortField === "email" ? (
                            sortDir === "asc" ? (
                              "↑"
                            ) : (
                              "↓"
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                          )}
                        </span>
                      </TableHead>
                      <TableHead
                        className="hidden md:table-cell cursor-pointer select-none"
                        onClick={() => toggleSort("phone")}
                      >
                        <span className="flex items-center gap-1">
                          Téléphone{" "}
                          {sortField === "phone" ? (
                            sortDir === "asc" ? (
                              "↑"
                            ) : (
                              "↓"
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                          )}
                        </span>
                      </TableHead>
                      <TableHead
                        className="hidden lg:table-cell cursor-pointer select-none"
                        onClick={() => toggleSort("company")}
                      >
                        <span className="flex items-center gap-1">
                          Entreprise{" "}
                          {sortField === "company" ? (
                            sortDir === "asc" ? (
                              "↑"
                            ) : (
                              "↓"
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                          )}
                        </span>
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Tags
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFiltered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-4">
                          <EmptyState
                            icon={Users}
                            context={search ? "search" : "empty"}
                            title={
                              search
                                ? "Aucun résultat"
                                : tab === "favorites"
                                  ? "Aucun favori"
                                  : "Aucun contact"
                            }
                            description={
                              search
                                ? `Aucun contact ne correspond à "${search}".`
                                : tab === "favorites"
                                  ? "Marquez des contacts comme favoris pour les retrouver ici."
                                  : "Commencez par ajouter votre premier contact."
                            }
                            actionLabel={
                              !search && tab === "all"
                                ? "Nouveau contact"
                                : undefined
                            }
                            onAction={
                              !search && tab === "all"
                                ? () => {
                                    resetForm();
                                    setIsCreating(true);
                                  }
                                : undefined
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    {sortedFiltered.map((c, rowIndex) => (
                      <React.Fragment key={c.id}>
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <TableRow
                              className={cn(
                                "transition-colors hover:bg-muted/50 cursor-pointer",
                                selectedIds.has(c.id) ? "bg-primary/5" : "",
                                emailPanelContactId === c.id
                                  ? "border-b-0 bg-primary/5"
                                  : "",
                                focusedRow === rowIndex
                                  ? "bg-primary/10 ring-1 ring-primary/30 ring-inset"
                                  : "",
                              )}
                              data-focused={focusedRow === rowIndex}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(c.id)}
                                  onCheckedChange={() => toggleSelect(c.id)}
                                  aria-label={`Selectionner ${c.name}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {inlineEdit?.contactId === c.id &&
                                inlineEdit.field === "name" ? (
                                  <Input
                                    autoFocus
                                    className="h-7 text-sm font-medium"
                                    value={inlineEdit.value}
                                    onChange={(e) =>
                                      setInlineEdit({
                                        ...inlineEdit,
                                        value: e.target.value,
                                      })
                                    }
                                    onBlur={saveInlineEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveInlineEdit();
                                      if (e.key === "Escape")
                                        cancelInlineEdit();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span
                                    className="cursor-text hover:bg-muted/50 px-1 py-0.5 rounded -mx-1 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startInlineEdit(c, "name");
                                    }}
                                    title="Cliquer pour modifier"
                                  >
                                    {c.name}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {inlineEdit?.contactId === c.id &&
                                inlineEdit.field === "email" ? (
                                  <Input
                                    autoFocus
                                    type="email"
                                    className="h-7 text-sm"
                                    value={inlineEdit.value}
                                    onChange={(e) =>
                                      setInlineEdit({
                                        ...inlineEdit,
                                        value: e.target.value,
                                      })
                                    }
                                    onBlur={saveInlineEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveInlineEdit();
                                      if (e.key === "Escape")
                                        cancelInlineEdit();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span
                                    className="cursor-text hover:bg-muted/50 px-1 py-0.5 rounded -mx-1 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startInlineEdit(c, "email");
                                    }}
                                    title="Cliquer pour modifier"
                                  >
                                    {c.email}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground">
                                {inlineEdit?.contactId === c.id &&
                                inlineEdit.field === "phone" ? (
                                  <Input
                                    autoFocus
                                    className="h-7 text-sm"
                                    value={inlineEdit.value}
                                    onChange={(e) =>
                                      setInlineEdit({
                                        ...inlineEdit,
                                        value: e.target.value,
                                      })
                                    }
                                    onBlur={saveInlineEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveInlineEdit();
                                      if (e.key === "Escape")
                                        cancelInlineEdit();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span
                                    className="cursor-text hover:bg-muted/50 px-1 py-0.5 rounded -mx-1 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startInlineEdit(c, "phone");
                                    }}
                                    title="Cliquer pour modifier"
                                  >
                                    {c.phone ?? "\u2014"}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-muted-foreground">
                                {c.company ?? "—"}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <div className="flex gap-1 flex-wrap">
                                  {c.tags.map((t) => (
                                    <Badge key={t} variant="secondary">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  {c.email && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      title="Voir les emails"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEmailPanelContactId(
                                          emailPanelContactId === c.id
                                            ? null
                                            : c.id,
                                        );
                                      }}
                                      className={
                                        emailPanelContactId === c.id
                                          ? "text-primary bg-primary/10"
                                          : ""
                                      }
                                    >
                                      <Mail className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Favori"
                                    onClick={() => toggleFavorite(c)}
                                  >
                                    {c.favorite ? (
                                      <Star className="h-4 w-4 text-amber-500" />
                                    ) : (
                                      <StarOff className="h-4 w-4" />
                                    )}
                                  </Button>
                                  {/* Group assignment dropdown */}
                                  {apiGroups.length > 0 && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          title="Groupes"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <UsersRound className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <DropdownMenuLabel>
                                          Assigner à un groupe
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {apiGroups.map((g) => (
                                          <DropdownMenuItem
                                            key={g.id}
                                            onClick={() =>
                                              handleAssignGroup(c.id, g.id)
                                            }
                                          >
                                            {g.color && (
                                              <span
                                                className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                                                style={{
                                                  backgroundColor: g.color,
                                                }}
                                              />
                                            )}
                                            {g.name}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                                          Retirer d&apos;un groupe
                                        </DropdownMenuLabel>
                                        {apiGroups.map((g) => (
                                          <DropdownMenuItem
                                            key={`rm-${g.id}`}
                                            className="text-destructive focus:text-destructive"
                                            onClick={() =>
                                              handleRemoveFromGroup(c.id, g.id)
                                            }
                                          >
                                            <X className="mr-2 h-3.5 w-3.5" />
                                            {g.name}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Modifier"
                                    onClick={() => handleEdit(c)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Supprimer"
                                    onClick={() => setDeleteTarget(c.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => handleEdit(c)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Modifier
                            </ContextMenuItem>
                            {c.email && (
                              <ContextMenuItem
                                onClick={() => setEmailPanelContactId(c.id)}
                              >
                                <Mail className="h-3.5 w-3.5 mr-2" /> Envoyer un
                                email
                              </ContextMenuItem>
                            )}
                            {c.phone && (
                              <ContextMenuItem
                                onClick={() => window.open(`tel:${c.phone}`)}
                              >
                                <Phone className="h-3.5 w-3.5 mr-2" /> Appeler
                              </ContextMenuItem>
                            )}
                            <ContextMenuItem onClick={() => toggleFavorite(c)}>
                              <Star className="h-3.5 w-3.5 mr-2" />{" "}
                              {c.favorite
                                ? "Retirer des favoris"
                                : "Ajouter aux favoris"}
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(c.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                        {emailPanelContactId === c.id && c.email && (
                          <TableRow className="bg-primary/5 hover:bg-primary/5">
                            <TableCell colSpan={7} className="p-4">
                              <ContactEmailPanel
                                contactEmail={c.email}
                                contactName={c.name}
                                onClose={() => setEmailPanelContactId(null)}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
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
                {groups.map((group) => {
                  const members = filtered.filter((c) => c.group === group);
                  return (
                    <Card key={group} className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <UsersRound className="h-4 w-4 text-primary" />
                          {group}
                          <Badge variant="outline" className="ml-auto">
                            {members.length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        {members.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>{c.name}</span>
                            <span className="text-muted-foreground truncate max-w-[140px]">
                              {c.email}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {/* New contact groups component */}
              <ContactGroups
                contacts={contacts.map((c) => ({
                  id: c.id,
                  name: c.name,
                  email: c.email,
                }))}
                groups={contactGroups}
                onGroupsChange={handleContactGroupsChange}
              />
            </div>
          </TabsContent>

          <TabsContent value="merge">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitMerge className="h-4 w-4" /> Fusionner les doublons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MergeContacts contacts={contacts} onMerge={handleMerge} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="birthdays">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-4 w-4" /> Anniversaires
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BirthdayReminders contacts={contacts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Vue géographique
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ContactMap contacts={contacts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-4 w-4" /> Historique des activités
                  </CardTitle>
                  <select
                    value={selectedContactForHistory ?? ""}
                    onChange={(e) =>
                      setSelectedContactForHistory(e.target.value || null)
                    }
                    className="h-8 rounded-md border text-sm px-2 bg-background"
                  >
                    <option value="">Sélectionner un contact...</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {selectedContactForHistory ? (
                  <ContactHistory
                    contactId={selectedContactForHistory}
                    contactName={
                      contacts.find((c) => c.id === selectedContactForHistory)
                        ?.name ?? ""
                    }
                    activities={activities}
                    onAdd={(a) => setActivities((p) => [a, ...p])}
                    onDelete={(id) =>
                      setActivities((p) => p.filter((a) => a.id !== id))
                    }
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    Sélectionnez un contact pour voir son historique.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Relations entreprises
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CompanyRelations
                  contacts={contacts.map((c) => ({
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    company: c.company,
                    companyId: c.companyId,
                  }))}
                  onContactUpdate={handleCompanyUpdate}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fields">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> Champs personnalisés
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <CustomFieldsAdmin
                  fields={customFields}
                  onChange={setCustomFields}
                />
                {customFields.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">
                      Aperçu — Saisie sur un contact
                    </p>
                    <CustomFieldForm
                      fields={customFields}
                      values={customFieldValues}
                      onChange={setCustomFieldValues}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feature 30: Unified customer 360° view */}
          <TabsContent value="360">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Vue client 360°
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Toutes les informations croisées : deals CRM, factures,
                    emails, agenda, tâches.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {sortedFiltered.slice(0, 20).map((c) => (
                  <Customer360View
                    key={c.id}
                    contact={{
                      id: c.id,
                      name: c.name,
                      email: c.email,
                      phone: c.phone,
                      company: c.company,
                      birthday: c.birthday,
                      tags: c.tags,
                    }}
                  />
                ))}
                {sortedFiltered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucun contact à afficher.
                  </p>
                )}
                {sortedFiltered.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center">
                    {sortedFiltered.length - 20} contacts supplémentaires —
                    affinez la recherche.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le contact sera définitivement
              supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {selectedIds.size} contact(s) ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les {selectedIds.size} contacts
              sélectionnés seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>
              Supprimer tout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group delete confirmation */}
      <AlertDialog
        open={groupDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setGroupDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce groupe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les contacts seront désassignés de ce groupe mais ne seront pas
              supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                groupDeleteTarget && handleDeleteGroup(groupDeleteTarget)
              }
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Groups management dialog */}
      <Dialog open={isGroupsDialogOpen} onOpenChange={setIsGroupsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5" />
              Gérer les groupes
            </DialogTitle>
            <DialogDescription>
              Créez, renommez ou supprimez des groupes de contacts.
            </DialogDescription>
          </DialogHeader>

          {/* Existing groups */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {apiGroups.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun groupe créé.
              </p>
            )}
            {apiGroups.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2"
              >
                {editingGroupId === g.id ? (
                  <>
                    <input
                      type="color"
                      value={editingGroupColor}
                      onChange={(e) => setEditingGroupColor(e.target.value)}
                      className="h-7 w-7 cursor-pointer rounded border-0 p-0"
                    />
                    <Input
                      autoFocus
                      className="h-7 flex-1 text-sm"
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateGroup(g.id);
                        if (e.key === "Escape") setEditingGroupId(null);
                      }}
                    />
                    <Button size="sm" onClick={() => handleUpdateGroup(g.id)}>
                      OK
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingGroupId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    {g.color && (
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: g.color }}
                      />
                    )}
                    <span className="flex-1 text-sm font-medium truncate">
                      {g.name}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingGroupId(g.id);
                        setEditingGroupName(g.name);
                        setEditingGroupColor(g.color ?? "#6366f1");
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setGroupDeleteTarget(g.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Create new group */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Nouveau groupe</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newGroupColor}
                onChange={(e) => setNewGroupColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border-0 p-0 shrink-0"
              />
              <Input
                placeholder="Nom du groupe..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateGroup();
                }}
                className="flex-1"
              />
              <Button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Créer
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsGroupsDialogOpen(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
