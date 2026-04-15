// Supply Chain: Next.js proxy → identity /api/v1/supply-chain/inventory

import { NextRequest, NextResponse } from "next/server";

const IDENTITY = process.env.IDENTITY_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = req.headers.get("authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  const res = await fetch(`${IDENTITY}/api/v1/supply-chain/inventory`, {
    method: "GET",
    headers,
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
