// Supply Chain: Next.js proxy → identity /api/v1/supply-chain/purchase-orders

import { NextRequest, NextResponse } from "next/server";

const IDENTITY = process.env.IDENTITY_URL ?? "http://localhost:3001";

async function proxy(
  req: NextRequest,
  method: string,
  path = "",
  body?: unknown,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = req.headers.get("authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  const url = new URL(req.url);
  const search = url.searchParams.toString();
  const upstream = `${IDENTITY}/api/v1/supply-chain/purchase-orders${path}${search ? `?${search}` : ""}`;

  const res = await fetch(upstream, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req: NextRequest) {
  return proxy(req, "GET");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxy(req, "POST", "", body);
}
