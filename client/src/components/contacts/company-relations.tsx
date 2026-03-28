"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Plus, Link, Unlink, ChevronDown, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  size?: string;
}

interface ContactRef {
  id: string;
  name: string;
  title?: string;
  email: string;
  companyId?: string;
}

interface CompanyRelationsProps {
  contacts: ContactRef[];
  onContactUpdate: (id: string, companyId: string | undefined) => void;
}

// ── Sample companies ──────────────────────────────────────────────────────────

const INITIAL_COMPANIES: Company[] = [
  { id: "c1", name: "Acme Corp", industry: "Tech", website: "acme.com", size: "50-200" },
  { id: "c2", name: "Beta Ltd", industry: "Finance", website: "beta.com", size: "10-50" },
  { id: "c3", name: "Gamma SAS", industry: "Marketing", website: "gamma.fr", size: "1-10" },
];

// ── Company Card ──────────────────────────────────────────────────────────────

function CompanyCard({ company, contacts, onLink, onUnlink }: {
  company: Company;
  contacts: ContactRef[];
  onLink: (companyId: string, contactId: string) => void;
  onUnlink: (contactId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");

  const linkedContacts = contacts.filter((c) => c.companyId === company.id);
  const unlinkedContacts = contacts.filter((c) => !c.companyId &&
    (!search || c.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{company.name}</p>
          <p className="text-xs text-muted-foreground">{company.industry} • {company.size} employés</p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          <Users className="size-3 mr-1" /> {linkedContacts.length}
        </Badge>
        {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t p-3 space-y-2 bg-muted/10">
          {/* Linked contacts */}
          {linkedContacts.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm">
              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {c.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{c.name}</p>
                {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
              </div>
              <Button size="icon" variant="ghost" className="size-6 text-muted-foreground hover:text-destructive"
                onClick={() => onUnlink(c.id)} title="Délier">
                <Unlink className="size-3" />
              </Button>
            </div>
          ))}

          {linkedContacts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Aucun contact lié.</p>
          )}

          {/* Link new contact */}
          {linking ? (
            <div className="space-y-2 pt-1 border-t">
              <Input
                placeholder="Chercher contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs"
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {unlinkedContacts.slice(0, 6).map((c) => (
                  <button key={c.id} onClick={() => { onLink(company.id, c.id); setLinking(false); setSearch(""); }}
                    className="w-full flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-muted text-left">
                    <Link className="size-3 text-primary" />
                    {c.name}
                    <span className="text-muted-foreground ml-auto">{c.email}</span>
                  </button>
                ))}
                {unlinkedContacts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Aucun contact disponible.</p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="w-full h-6 text-xs" onClick={() => setLinking(false)}>
                Fermer
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1" onClick={() => setLinking(true)}>
              <Plus className="size-3" /> Lier un contact
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CompanyRelations({ contacts, onContactUpdate }: CompanyRelationsProps) {
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [newCompanyName, setNewCompanyName] = useState("");

  const handleLink = (companyId: string, contactId: string) => {
    onContactUpdate(contactId, companyId);
  };

  const handleUnlink = (contactId: string) => {
    onContactUpdate(contactId, undefined);
  };

  const handleAddCompany = () => {
    if (!newCompanyName.trim()) return;
    setCompanies((p) => [...p, { id: crypto.randomUUID(), name: newCompanyName.trim() }]);
    setNewCompanyName("");
  };

  const unlinked = useMemo(() => contacts.filter((c) => !c.companyId), [contacts]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Entreprises", value: companies.length },
          { label: "Contacts liés", value: contacts.filter((c) => !!c.companyId).length },
          { label: "Sans entreprise", value: unlinked.length },
        ].map((s) => (
          <div key={s.label} className="border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add company */}
      <div className="flex gap-2">
        <Input placeholder="Nouvelle entreprise..." value={newCompanyName}
          onChange={(e) => setNewCompanyName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddCompany(); }}
          className="flex-1 h-8 text-sm"
        />
        <Button size="sm" onClick={handleAddCompany} disabled={!newCompanyName.trim()} className="gap-1">
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>

      {/* Company list */}
      <div className="space-y-2">
        {companies.map((c) => (
          <CompanyCard key={c.id} company={c} contacts={contacts}
            onLink={handleLink} onUnlink={handleUnlink} />
        ))}
      </div>
    </div>
  );
}
