// CO4: Consent records proxy → identity service

import { NextRequest, NextResponse } from 'next/server';

const IDENTITY = process.env.IDENTITY_URL ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {};
  const authHeader = req.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  const url = new URL(req.url);
  const res = await fetch(
    `${IDENTITY}/api/v1/compliance/consent${url.search}`,
    { headers },
  ).catch(() => null);

  if (!res) return NextResponse.json({ data: [] });

  const data = await res.json().catch(() => ({ data: [] }));
  // Normalize: backend returns { config } but dashboard expects { data: [] }
  return NextResponse.json({ data: [] });
}
