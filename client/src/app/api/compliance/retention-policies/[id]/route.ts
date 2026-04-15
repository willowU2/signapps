// CO3: Next.js proxy for retention policy by id (PATCH/DELETE/run)

import { NextRequest, NextResponse } from "next/server";

const IDENTITY = process.env.IDENTITY_URL ?? "http://localhost:3001";

async function proxy(
  req: NextRequest,
  method: string,
  id: string,
  body?: unknown,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = req.headers.get("authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  const url = new URL(req.url);
  const suffix = url.pathname.endsWith("/run") ? "/run" : "";

  const res = await fetch(
    `${IDENTITY}/api/v1/compliance/retention-policies/${id}${suffix}`,
    {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
  ).catch(() => null);

  if (!res) {
    // Stub response for /run until backend implements it
    return NextResponse.json({ affected: 0 });
  }

  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return proxy(req, "PATCH", id, body);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxy(req, "DELETE", id);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // /run endpoint — stub: returns 0 affected until backend has purge logic
  return NextResponse.json({ affected: 0 });
}
