// CO4: Consent export stub

import { NextResponse } from "next/server";

export async function POST() {
  const csv = "id,subject_email,purpose,consent_given,consent_date\n";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="consents.csv"',
    },
  });
}
