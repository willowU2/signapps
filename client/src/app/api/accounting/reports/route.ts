// Accounting: Next.js proxy → identity /api/v1/accounting/reports

import { NextRequest, NextResponse } from "next/server";

const IDENTITY = process.env.IDENTITY_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = req.headers.get("authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  const url = new URL(req.url);
  const search = url.searchParams.toString();
  const upstream = `${IDENTITY}/api/v1/accounting/reports${search ? `?${search}` : ""}`;

  const res = await fetch(upstream, { method: "GET", headers });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
