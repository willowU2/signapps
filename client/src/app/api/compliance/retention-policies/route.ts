// CO1/CO3: Next.js proxy → identity service /api/v1/compliance/retention-policies

import { NextRequest, NextResponse } from 'next/server';

const IDENTITY = process.env.IDENTITY_URL ?? 'http://localhost:3001';

async function proxy(req: NextRequest, method: string, path = '', body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = req.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  const res = await fetch(`${IDENTITY}/api/v1/compliance/retention-policies${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxy(req, 'PUT', '', body);
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxy(req, 'PUT', '', body);
}
