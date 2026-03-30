// CO1: DPIA report generation — saves DPIA to backend and returns a stub PDF blob

import { NextRequest, NextResponse } from 'next/server';

const IDENTITY = process.env.IDENTITY_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = req.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  // Save DPIA record to backend
  await fetch(`${IDENTITY}/api/v1/compliance/dpia`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }).catch(() => null);

  // Return minimal PDF-like stub (real PDF generation requires a separate service)
  const stub = Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj\n` +
    `3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>endobj\n` +
    `xref\n0 4\ntrailer<</Size 4 /Root 1 0 R>>\nstartxref\n0\n%%EOF`,
    'utf-8',
  );

  return new NextResponse(stub, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="DPIA_report.pdf"`,
    },
  });
}
