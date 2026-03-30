// CO1/CO2: Next.js proxy → identity service /api/v1/compliance/dsar/:id

import { NextRequest, NextResponse } from 'next/server';

const IDENTITY = process.env.IDENTITY_URL ?? 'http://localhost:3001';

async function proxy(req: NextRequest, method: string, id: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = req.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  const res = await fetch(`${IDENTITY}/api/v1/compliance/dsar/${id}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return proxy(req, 'PATCH', id, body);
}

// DSAR export stub — returns empty blob for now
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  if (url.pathname.endsWith('/export')) {
    return new NextResponse('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/zip' },
    });
  }
  return proxy(req, 'GET', id);
}
