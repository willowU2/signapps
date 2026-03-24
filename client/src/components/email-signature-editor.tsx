"use client";

import { useState } from "react";

interface SignatureData {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
}

export function EmailSignatureEditor() {
  const [data, setData] = useState<SignatureData>({
    name: "", title: "", company: "SignApps", phone: "", email: "", website: "",
  });

  const update = (key: keyof SignatureData, value: string) => setData(d => ({ ...d, [key]: value }));

  const preview = `
    <table style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
      <tr><td style="padding-bottom:8px;border-bottom:2px solid #3b82f6;">
        <strong style="font-size:15px;">${data.name || "Votre nom"}</strong><br/>
        <span style="color:#666;">${data.title || "Poste"} | ${data.company}</span>
      </td></tr>
      <tr><td style="padding-top:8px;font-size:12px;color:#666;">
        ${data.phone ? data.phone + " | " : ""}${data.email}${data.website ? " | " + data.website : ""}
      </td></tr>
    </table>
  `.trim();

  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(data) as Array<keyof SignatureData>).map(key => (
          <input key={key} type="text" value={data[key]} onChange={e => update(key, e.target.value)}
            placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
            className="px-3 py-2 border rounded text-sm bg-background" />
        ))}
      </div>
      <div className="border rounded p-4 bg-white">
        <div dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
      <button onClick={() => navigator.clipboard.writeText(preview)} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
        Copier HTML
      </button>
    </div>
  );
}
