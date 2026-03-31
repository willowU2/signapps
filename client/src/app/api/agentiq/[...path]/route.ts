import { NextRequest, NextResponse } from 'next/server';

const AGENTIQ_URL = process.env.AGENTIQ_URL || 'http://localhost:3333';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = `${AGENTIQ_URL}/api/${path.join('/')}${req.nextUrl.search}`;
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'AgentIQ unreachable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = `${AGENTIQ_URL}/api/${path.join('/')}`;
  const body = await req.json();
  try {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'AgentIQ unreachable' }, { status: 503 });
  }
}
