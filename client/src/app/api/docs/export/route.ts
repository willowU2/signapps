import { NextResponse } from "next/server";
// @ts-expect-error html-to-docx has no published TypeScript types
import htmlToDocx from "html-to-docx";

export async function POST(req: Request) {
  try {
    const { html } = await req.json();
    if (!html) {
      return NextResponse.json(
        { error: "HTML content missing" },
        { status: 400 },
      );
    }

    const fileBuffer = await htmlToDocx(html, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    // We must return the raw buffer with correct headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    console.error("Error generating DOCX:", error);
    return NextResponse.json(
      { error: "Impossible de générer le document" },
      { status: 500 },
    );
  }
}
