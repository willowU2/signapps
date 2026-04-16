"use client";

import { useState } from "react";
import {
  Search,
  LayoutGrid,
  List,
  Mail,
  Briefcase,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TeamMember } from "@/lib/api/my-team";

// ── Avatar color helper ───────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-red-500",
];

function avatarColor(name: string) {
  const index =
    name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
    AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  on_leave: "En congé",
  remote: "Télétravail",
  inactive: "Inactif",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  on_leave: "outline",
  remote: "secondary",
  inactive: "destructive",
};

// ── Member card (grid mode) ───────────────────────────────────────────────────

function MemberCard({
  member,
  onClick,
}: {
  member: TeamMember;
  onClick: () => void;
}) {
  const fullName = `${member.first_name} ${member.last_name}`;
  const initials =
    `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center gap-3 pt-6 pb-4 text-center">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white",
            avatarColor(fullName),
          )}
        >
          {initials}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold">{fullName}</p>
          <p className="text-xs text-muted-foreground">{member.job_title}</p>
          <p className="text-xs text-muted-foreground">{member.department}</p>
        </div>
        <Badge variant={STATUS_VARIANT[member.status] ?? "secondary"}>
          {STATUS_LABEL[member.status] ?? member.status}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ── Member row (list mode) ────────────────────────────────────────────────────

function MemberRow({
  member,
  onClick,
}: {
  member: TeamMember;
  onClick: () => void;
}) {
  const fullName = `${member.first_name} ${member.last_name}`;
  const initials =
    `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase();

  return (
    <div
      className="flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-muted"
      onClick={onClick}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
          avatarColor(fullName),
        )}
      >
        {initials}
      </div>
      <div className="flex flex-1 flex-col">
        <p className="text-sm font-medium">{fullName}</p>
        <p className="text-xs text-muted-foreground">{member.job_title}</p>
      </div>
      <p className="hidden text-xs text-muted-foreground sm:block">
        {member.department}
      </p>
      <Badge
        variant={STATUS_VARIANT[member.status] ?? "secondary"}
        className="shrink-0"
      >
        {STATUS_LABEL[member.status] ?? member.status}
      </Badge>
    </div>
  );
}

// ── Detail Sheet ──────────────────────────────────────────────────────────────

function MemberSheet({
  member,
  open,
  onClose,
}: {
  member: TeamMember | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!member) return null;

  const fullName = `${member.first_name} ${member.last_name}`;
  const initials =
    `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-96">
        <SheetHeader>
          <SheetTitle>Profil du collaborateur</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-6">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white",
                avatarColor(fullName),
              )}
            >
              {initials}
            </div>
            <div>
              <p className="text-lg font-semibold">{fullName}</p>
              <p className="text-sm text-muted-foreground">
                {member.job_title}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[member.status] ?? "secondary"}>
              {STATUS_LABEL[member.status] ?? member.status}
            </Badge>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Département :</span>
              <span className="font-medium">{member.department}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={`mailto:${member.email}`}
                className="font-medium text-primary hover:underline"
              >
                {member.email}
              </a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Type :</span>
              <span className="font-medium">{member.employment_type}</span>
            </div>
            {member.location && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Lieu :</span>
                <span className="font-medium">{member.location}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Depuis :</span>
              <span className="font-medium">
                {new Date(member.hire_date).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface TeamDirectoryProps {
  members: TeamMember[];
}

export function TeamDirectory({ members }: TeamDirectoryProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      m.job_title.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q)
    );
  });

  const handleSelect = (member: TeamMember) => {
    setSelectedMember(member);
    setSheetOpen(true);
  };

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm font-medium">Aucun collaborateur direct</p>
        <p className="text-xs text-muted-foreground">
          Votre liste de rapports directs est vide.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un collaborateur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <Button
            size="icon"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            className="h-7 w-7"
            onClick={() => setViewMode("grid")}
            title="Vue grille"
            aria-label="Vue grille"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            className="h-7 w-7"
            onClick={() => setViewMode("list")}
            title="Vue liste"
            aria-label="Vue liste"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results count */}
      {search && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} résultat{filtered.length !== 1 ? "s" : ""} pour «{" "}
          {search} »
        </p>
      )}

      {/* Grid or list */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onClick={() => handleSelect(member)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
          {filtered.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              onClick={() => handleSelect(member)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && search && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun résultat pour « {search} »
        </p>
      )}

      {/* Detail sheet */}
      <MemberSheet
        member={selectedMember}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
