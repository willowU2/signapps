// CO4: Consent stats stub

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ total: 0, given: 0, withdrawn: 0, expired: 0 });
}
