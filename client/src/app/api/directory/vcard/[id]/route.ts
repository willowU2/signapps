/**
 * `/api/directory/vcard/:id` — SO5 directory.
 *
 * Proxies a person id through `signapps-org` and returns a `text/vcard`
 * payload matching the drawer's downloaded .vcf. Useful for email-signature
 * "attach my card" flows or for scanning into native contact apps.
 *
 * The `?format=qr` variant is *intentionally* not implemented server-side:
 * Next.js 16 forbids `react-dom/server` imports inside API routes, so the
 * QR is rendered by the `VcardQR` React component (`components/directory/
 * vcard-qr.tsx`) at runtime. For an external QR link, build a data URL with
 * `navigator.clipboard.writeText(vcardPayload)` and feed it to any QR tool.
 *
 * Requests must carry the same `Authorization` header the browser uses to
 * talk to the gateway; we forward it untouched.
 */
import { NextRequest, NextResponse } from "next/server";

const ORG_SVC_URL = process.env.ORG_URL ?? "http://localhost:3026";

interface BackendPerson {
  id: string;
  tenant_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function readString(p: BackendPerson, key: string): string | undefined {
  const src = p.attributes ?? p.metadata ?? {};
  const v = src[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function buildVcard(p: BackendPerson): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:4.0"];
  const first = p.first_name ?? "";
  const last = p.last_name ?? "";
  lines.push(`FN:${escapeVcard(`${first} ${last}`.trim() || p.id)}`);
  lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`);
  if (p.phone) lines.push(`TEL;TYPE=cell:${escapeVcard(p.phone)}`);
  if (p.email) lines.push(`EMAIL;TYPE=work:${escapeVcard(p.email)}`);
  const org = readString(p, "org_name");
  if (org) lines.push(`ORG:${escapeVcard(org)}`);
  const title = readString(p, "title");
  if (title) lines.push(`TITLE:${escapeVcard(title)}`);
  if (p.avatar_url) lines.push(`PHOTO;VALUE=uri:${p.avatar_url}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const authHeader = req.headers.get("authorization");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authHeader) headers["Authorization"] = authHeader;

  const upstream = await fetch(`${ORG_SVC_URL}/org/persons/${id}`, {
    method: "GET",
    headers,
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { error: "upstream unreachable" },
      { status: 502 },
    );
  }
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `upstream returned ${upstream.status}` },
      { status: upstream.status },
    );
  }

  const person = (await upstream.json()) as BackendPerson;
  const vcard = buildVcard(person);

  const safe = `${person.first_name ?? ""}_${person.last_name ?? ""}`.replace(
    /[^\w-]+/g,
    "_",
  );
  return new NextResponse(vcard, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe || person.id}.vcf"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
