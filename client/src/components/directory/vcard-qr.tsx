/**
 * VcardQR — SO5 directory.
 *
 * Renders a vCard 4.0 payload as an inline SVG QR code so someone across a
 * desk can scan the directory entry with their phone and import the contact
 * straight into their native address book.
 *
 * The vCard payload is built entirely client-side from the Person object —
 * no backend round-trip required.
 */
"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Person } from "@/types/org";
import {
  personFullName,
  personTitle,
} from "@/app/admin/org-structure/components/avatar-helpers";

export interface VcardQRProps {
  person: Person;
  /** Optional tenant name placed in the ORG field. */
  orgName?: string;
  /** Pixel size of the rendered QR. */
  size?: number;
}

/**
 * Serialize a Person to a vCard 4.0 string.
 *
 * Exported (not only the component) so the Next.js API route handler can
 * reuse the exact same serialization for its `text/vcard` response.
 */
export function buildVcard(person: Person, orgName?: string): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:4.0"];
  lines.push(`FN:${escapeVcardValue(personFullName(person))}`);
  lines.push(
    `N:${escapeVcardValue(person.last_name ?? "")};${escapeVcardValue(
      person.first_name ?? "",
    )};;;`,
  );
  if (person.phone) {
    lines.push(`TEL;TYPE=cell:${escapeVcardValue(person.phone)}`);
  }
  if (person.email) {
    lines.push(`EMAIL;TYPE=work:${escapeVcardValue(person.email)}`);
  }
  if (orgName) {
    lines.push(`ORG:${escapeVcardValue(orgName)}`);
  }
  const title = personTitle(person);
  if (title) {
    lines.push(`TITLE:${escapeVcardValue(title)}`);
  }
  if (person.avatar_url) {
    lines.push(`PHOTO;VALUE=uri:${person.avatar_url}`);
  }
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/**
 * Escape characters required by vCard 4.0 (`,`, `;`, `\`, `\n`).
 */
function escapeVcardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function VcardQR({ person, orgName, size = 180 }: VcardQRProps) {
  const payload = useMemo(() => buildVcard(person, orgName), [person, orgName]);
  return (
    <div
      className="inline-flex flex-col items-center gap-2 rounded-lg border bg-white p-3 text-xs text-neutral-700"
      data-testid="vcard-qr"
    >
      <QRCodeSVG
        value={payload}
        size={size}
        level="M"
        marginSize={2}
        bgColor="#ffffff"
        fgColor="#0f172a"
        aria-label={`QR code vCard pour ${person.first_name} ${person.last_name}`}
      />
      <span className="font-medium">Scanner pour importer</span>
    </div>
  );
}
