/**
 * PersonDetailDrawer — SO5 directory.
 *
 * Shared between the mobile full-screen drawer and the desktop embedded
 * pane. Surfaces:
 *   - big avatar + name + title + OU;
 *   - 4 tap-to-contact buttons (tel / mail / chat / meet);
 *   - a vCard QR so a colleague can scan the entry;
 *   - a back-link into `/admin/org-structure`.
 *
 * Actions:
 *   - tel / mail use the native handler (`tel:`, `mailto:`)
 *   - chat navigates to `/chat?person_id=…` (resolution handled there)
 *   - meet calls `POST /api/v1/meet/rooms/adhoc` and redirects on success.
 */
"use client";

import { useState } from "react";
import {
  Phone,
  Mail,
  MessageCircle,
  Video,
  Network,
  X,
  Download,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SmartAvatar } from "@/components/common/smart-avatar";
import { useTenantStore } from "@/stores/tenant-store";
import { getClient, ServiceName } from "@/lib/api/factory";
import { VcardQR, buildVcard } from "./vcard-qr";
import type { Person, OrgNode } from "@/types/org";
import {
  avatarTint,
  personInitials,
  personTitle,
  personFullName,
} from "@/app/admin/org-structure/components/avatar-helpers";

export interface PersonDetailDrawerProps {
  person: Person;
  nodes: OrgNode[];
  onClose: () => void;
  /** When true, render without the dedicated mobile close button (desktop embed). */
  embedded?: boolean;
}

export function PersonDetailDrawer({
  person,
  nodes,
  onClose,
  embedded,
}: PersonDetailDrawerProps) {
  const router = useRouter();
  const tenantName = useTenantStore((s) => s.tenant?.name) ?? "SignApps";
  const [meetLoading, setMeetLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const fullName = personFullName(person);
  const title = personTitle(person);
  const initials = personInitials(person);
  const tint = avatarTint(person.id);

  // Best-effort OU lookup — we index by id; if missing just show nothing.
  const primaryNodeId = (() => {
    const raw = person as unknown as {
      attributes?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };
    const src = raw.attributes ?? raw.metadata ?? {};
    const nid = src.primary_node_id ?? src.node_id;
    return typeof nid === "string" ? nid : null;
  })();
  const primaryNode = primaryNodeId
    ? (nodes.find((n) => n.id === primaryNodeId) ?? null)
    : null;

  const handleMeetAdhoc = async () => {
    setMeetLoading(true);
    try {
      const client = getClient(ServiceName.MEET);
      const res = await client.post<{ room_id: string; slug?: string }>(
        "/api/v1/meet/rooms/adhoc",
        {
          invitees: person.email ? [person.email] : [],
          person_ids: [person.id],
          title: `Réunion avec ${fullName}`,
        },
      );
      const slug = res.data?.slug ?? res.data?.room_id;
      if (!slug) throw new Error("room slug missing");
      toast.success("Salle de réunion créée");
      router.push(`/meet/${slug}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Impossible de créer la salle";
      toast.error(`Erreur meet: ${message}`);
    } finally {
      setMeetLoading(false);
    }
  };

  const handleDownloadVcard = () => {
    try {
      const body = buildVcard(person, tenantName);
      const blob = new Blob([body], { type: "text/vcard;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = fullName.replace(/[^\w-]+/g, "_");
      a.href = url;
      a.download = `${safe}.vcf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Impossible de générer la vCard");
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-y-auto"
      data-testid="person-detail"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="relative flex flex-col items-center gap-3 border-b p-6">
        {!embedded ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute left-2 top-2"
          >
            <X className="size-5" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-2 top-2"
          >
            <X className="mr-1 size-4" /> Fermer
          </Button>
        )}
        <SmartAvatar
          photoUrl={person.avatar_url}
          initials={initials}
          tintClass={tint}
          alt={fullName}
          size="xl"
          className="size-24 text-xl"
        />
        <div className="text-center">
          <h2 className="text-lg font-semibold">{fullName}</h2>
          {title ? (
            <p className="text-sm text-muted-foreground">{title}</p>
          ) : null}
          {primaryNode ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {primaryNode.name}
            </p>
          ) : null}
        </div>
      </header>

      {/* ── Big action buttons ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        <ActionButton
          icon={<Phone className="size-5" />}
          label="Appeler"
          href={person.phone ? `tel:${person.phone}` : undefined}
          disabled={!person.phone}
          testId="action-call"
        />
        <ActionButton
          icon={<Mail className="size-5" />}
          label="Email"
          href={person.email ? `mailto:${person.email}` : undefined}
          disabled={!person.email}
          testId="action-mail"
        />
        <ActionButton
          icon={<MessageCircle className="size-5" />}
          label="Chat"
          onClick={() => router.push(`/chat?person_id=${person.id}`)}
          testId="action-chat"
        />
        <ActionButton
          icon={
            meetLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Video className="size-5" />
            )
          }
          label="Meet"
          onClick={handleMeetAdhoc}
          disabled={meetLoading}
          testId="action-meet"
        />
      </div>

      {/* ── Contact info ──────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-4 pb-4 text-sm">
        {person.phone ? (
          <a
            className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 hover:bg-accent"
            href={`tel:${person.phone}`}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" /> Téléphone
            </span>
            <span className="font-mono text-foreground">{person.phone}</span>
          </a>
        ) : null}
        {person.email ? (
          <a
            className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 hover:bg-accent"
            href={`mailto:${person.email}`}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" /> Email
            </span>
            <span className="truncate text-foreground">{person.email}</span>
          </a>
        ) : null}
      </div>

      {/* ── Secondary actions ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        {primaryNodeId ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              router.push(`/admin/org-structure?focus=${primaryNodeId}`)
            }
          >
            <Network className="mr-1 size-4" />
            Voir dans l&apos;organigramme
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowQr((v) => !v)}
          aria-expanded={showQr}
        >
          QR vCard
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadVcard}>
          <Download className="mr-1 size-4" />
          vCard
        </Button>
      </div>

      {showQr ? (
        <div className="flex justify-center border-t p-4">
          <VcardQR person={person} orgName={tenantName} />
        </div>
      ) : null}
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
}

function ActionButton({
  icon,
  label,
  href,
  onClick,
  disabled,
  testId,
}: ActionButtonProps) {
  const className =
    "flex h-16 w-full flex-col items-center justify-center gap-1 rounded-lg border bg-card text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  if (href && !disabled) {
    return (
      <a
        href={href}
        className={className}
        data-testid={testId}
        aria-label={label}
      >
        {icon}
        <span>{label}</span>
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-testid={testId}
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
