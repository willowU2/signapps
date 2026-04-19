/**
 * Compact person card — directory list row (SO5).
 *
 * Mobile: h-20 with avatar + 2 lines of text + chevron.
 * Desktop (md+): slightly taller (h-24) with extra breathing room on the
 * right so hover states look clean inside the card grid.
 *
 * The card is a pure button — the caller owns the click handler which
 * usually opens the detail drawer / panel.
 */
"use client";

import { memo } from "react";
import { ChevronRight } from "lucide-react";
import { SmartAvatar } from "@/components/common/smart-avatar";
import { cn } from "@/lib/utils";
import type { Person } from "@/types/org";
import {
  avatarTint,
  personInitials,
  personTitle,
  personFullName,
} from "@/app/admin/org-structure/components/avatar-helpers";

export interface PersonCardProps {
  person: Person;
  selected?: boolean;
  onClick?: () => void;
}

function PersonCardImpl({
  person,
  selected = false,
  onClick,
}: PersonCardProps) {
  const fullName = personFullName(person);
  const title = personTitle(person);
  const initials = personInitials(person);
  const tint = avatarTint(person.id);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border bg-card px-3 py-3 text-left transition-colors",
        "hover:bg-accent/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        "h-20 md:h-24",
        selected && "border-primary bg-accent/60",
      )}
      aria-pressed={selected}
      aria-label={`Voir la fiche de ${fullName}`}
      data-testid="person-card"
    >
      <SmartAvatar
        photoUrl={person.avatar_url}
        initials={initials}
        tintClass={tint}
        alt={fullName}
        size="xl"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">
          {fullName}
        </span>
        {title ? (
          <span className="truncate text-xs text-muted-foreground">
            {title}
          </span>
        ) : null}
        {person.email ? (
          <span className="truncate text-[11px] text-muted-foreground/80">
            {person.email}
          </span>
        ) : null}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export const PersonCard = memo(PersonCardImpl);
