// CO4: Consent purposes stub

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    purposes: ["analytics", "marketing", "preferences", "necessary"],
  });
}
