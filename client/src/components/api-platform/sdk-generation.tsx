"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Copy, Download, Wand2 } from "lucide-react";
import { toast } from "sonner";

const TS_SDK = `// SignApps TypeScript SDK v1.0.0
// Auto-generated — do not edit manually

const SIGNAPPS_BASE = process.env.SIGNAPPS_URL || 'http://localhost:3001';

export class SignAppsClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(\`\${SIGNAPPS_BASE}/api/v1\${path}\`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${this.token}\`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(\`HTTP \${res.status}: \${await res.text()}\`);
    return res.json();
  }

  // Identity
  identity = {
    me: () => this.request<User>('GET', '/users/me'),
    users: (q?: string) => this.request<User[]>('GET', \`/users\${q ? '?q='+q : ''}\`),
    createUser: (data: CreateUserDto) => this.request<User>('POST', '/users', data),
  };

  // Storage
  storage = {
    list: (path?: string) => this.request<FileEntry[]>('GET', \`/files?path=\${path ?? '/'}\`),
    delete: (id: string) => this.request<void>('DELETE', \`/files/\${id}\`),
    metadata: (id: string) => this.request<FileEntry>('GET', \`/files/\${id}\`),
  };

  // Mail
  mail = {
    messages: (folder = 'INBOX') => this.request<Message[]>('GET', \`/mail/messages?folder=\${folder}\`),
    send: (data: SendMailDto) => this.request<void>('POST', '/mail/send', data),
  };
}

export interface User { id: string; email: string; displayName: string; }
export interface FileEntry { id: string; name: string; size: number; mimeType: string; }
export interface Message { id: string; from: string; subject: string; date: string; }
export interface CreateUserDto { email: string; password: string; displayName: string; }
export interface SendMailDto { to: string[]; subject: string; body: string; }
`;

const PY_SDK = `# SignApps Python SDK v1.0.0
# Auto-generated — do not edit manually

import httpx
from typing import Optional, List, Any, Dict

SIGNAPPS_BASE = "http://localhost:3001"

class SignAppsClient:
    def __init__(self, token: str, base_url: str = SIGNAPPS_BASE):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, **kwargs) -> Any:
        url = f"{self.base_url}/api/v1{path}"
        response = httpx.request(method, url, headers=self.headers, **kwargs)
        response.raise_for_status()
        return response.json()

    # Identity
    def me(self) -> Dict:
        return self._request("GET", "/users/me")

    def list_users(self, q: Optional[str] = None) -> List[Dict]:
        params = {"q": q} if q else {}
        return self._request("GET", "/users", params=params)

    # Storage
    def list_files(self, path: str = "/") -> List[Dict]:
        return self._request("GET", f"/files?path={path}")

    def delete_file(self, file_id: str) -> None:
        self._request("DELETE", f"/files/{file_id}")

    # Mail
    def list_messages(self, folder: str = "INBOX") -> List[Dict]:
        return self._request("GET", f"/mail/messages?folder={folder}")

    def send_mail(self, to: List[str], subject: str, body: str) -> None:
        self._request("POST", "/mail/send", json={"to": to, "subject": subject, "body": body})


# Usage example:
# client = SignAppsClient("your-jwt-token")
# user = client.me()
# files = client.list_files("/documents")
`;

export function SdkGeneration() {
  const [lang, setLang] = useState<"typescript" | "python">("typescript");

  const code = lang === "typescript" ? TS_SDK : PY_SDK;

  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success(
      `${lang === "typescript" ? "TypeScript" : "Python"} SDK copied`,
    );
  };

  const download = () => {
    const filename =
      lang === "typescript" ? "signapps-sdk.ts" : "signapps_sdk.py";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="h-5 w-5 text-primary" />
            SDK Generation
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={download}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs
          value={lang}
          onValueChange={(v) => setLang(v as "typescript" | "python")}
        >
          <TabsList>
            <TabsTrigger value="typescript" className="gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1">
                TS
              </Badge>
              TypeScript
            </TabsTrigger>
            <TabsTrigger value="python" className="gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1">
                PY
              </Badge>
              Python
            </TabsTrigger>
          </TabsList>
          <TabsContent value="typescript">
            <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap border">
              {TS_SDK}
            </pre>
          </TabsContent>
          <TabsContent value="python">
            <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap border">
              {PY_SDK}
            </pre>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wand2 className="h-3.5 w-3.5" />
          SDKs are auto-generated from the OpenAPI schema. Regenerate after API
          changes.
        </div>
      </CardContent>
    </Card>
  );
}
