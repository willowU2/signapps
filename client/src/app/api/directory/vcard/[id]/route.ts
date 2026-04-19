/**
 * `/api/directory/vcard/:id` — SO5 directory.
 *
 * Proxies a person id through `signapps-org` and returns either:
 *   - `text/vcard` (default) with a vCard 4.0 payload matching the
 *     drawer's downloaded .vcf.
 *   - `image/svg+xml` (when `?format=qr`) with a scannable SVG QR that wraps
 *     the same vCard — useful when you want to embed the QR in an email
 *     signature or print a badge.
 *
 * Requests must carry the same `Authorization` header the browser uses to
 * talk to the gateway; we forward it untouched.
 */
import { NextRequest, NextResponse } from "next/server";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { QRCodeSVG } from "qrcode.react";

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

function readTitle(p: BackendPerson): string | undefined {
  const src = p.attributes ?? p.metadata ?? {};
  const t = src.title;
  return typeof t === "string" && t.length > 0 ? t : undefined;
}

function readOrgName(p: BackendPerson): string | undefined {
  const src = p.attributes ?? p.metadata ?? {};
  const o = src.org_name;
  return typeof o === "string" && o.length > 0 ? o : undefined;
}

function buildVcard(p: BackendPerson): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:4.0"];
  const first = p.first_name ?? "";
  const last = p.last_name ?? "";
  lines.push(`FN:${escapeVcard(`${first} ${last}`.trim() || p.id)}`);
  lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`);
  if (p.phone) lines.push(`TEL;TYPE=cell:${escapeVcard(p.phone)}`);
  if (p.email) lines.push(`EMAIL;TYPE=work:${escapeVcard(p.email)}`);
  const org = readOrgName(p);
  if (org) lines.push(`ORG:${escapeVcard(org)}`);
  const title = readTitle(p);
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
  const format = req.nextUrl.searchParams.get("format");

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

  if (format === "qr") {
    const svg = renderToString(
      createElement(QRCodeSVG, {
        value: vcard,
        size: 256,
        level: "M",
        marginSize: 2,
        bgColor: "#ffffff",
        fgColor: "#0f172a",
      }),
    );
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=60",
      },
    });
  }

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
