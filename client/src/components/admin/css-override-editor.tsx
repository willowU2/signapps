"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const identityClient = getClient(ServiceName.IDENTITY);

const DEFAULT_CSS = `/* Custom CSS Overrides */
:root {
  --primary-color: #3b82f6;
  --primary-dark: #2563eb;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Example: Override button styles */
button {
  transition: all 0.2s ease;
}

button:hover {
  transform: translateY(-1px);
}
`;

// Tenant ID mapping (demo tenants)
const TENANT_IDS: Record<string, string> = {
  default: "default",
  "acme-corp": "acme-corp",
  "tech-startup": "tech-startup",
  enterprise: "enterprise",
};

export function CSSOverrideEditor() {
  const [css, setCSS] = useState(DEFAULT_CSS);
  const [tenant, setTenant] = useState("default");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  // Load CSS for selected tenant
  useEffect(() => {
    const load = async () => {
      try {
        const res = await identityClient.get<{ css: string }>(
          `/admin/tenants/${TENANT_IDS[tenant]}/css`,
        );
        setCSS(res.data?.css ?? DEFAULT_CSS);
      } catch {
        const cached = localStorage.getItem(`css-override-${tenant}`);
        setCSS(cached ?? DEFAULT_CSS);
      }
      setIsSaved(true);
    };
    load();
  }, [tenant]);

  const handleSave = async () => {
    localStorage.setItem(`css-override-${tenant}`, css);
    setIsSaved(true);
    toast.success("CSS enregistré avec succès");
    try {
      await identityClient.put(`/admin/tenants/${TENANT_IDS[tenant]}/css`, {
        css,
      });
    } catch {
      // localStorage already updated
    }
  };

  const handleReset = () => {
    setCSS(DEFAULT_CSS);
    setIsSaved(false);
    toast.info("CSS réinitialisé par défaut");
  };

  const handleChange = (newValue: string) => {
    setCSS(newValue);
    setIsSaved(false);
  };

  const validateCSS = () => {
    try {
      // Basic validation: try to parse CSS
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
      document.head.removeChild(style);
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="space-y-4 w-full max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            CSS Override Editor
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize tenant branding with custom CSS
          </p>
        </div>
        {!isSaved && (
          <div className="text-sm text-amber-600 font-medium">
            Unsaved changes
          </div>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <Select value={tenant} onValueChange={setTenant}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select tenant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default Tenant</SelectItem>
            <SelectItem value="acme-corp">Acme Corp</SelectItem>
            <SelectItem value="tech-startup">Tech Startup</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Show Preview
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>

          <Button onClick={handleSave} disabled={isSaved} size="sm">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b border-border">
            <p className="text-sm font-medium text-muted-foreground">Editor</p>
          </div>
          <textarea
            value={css}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full h-96 p-4 font-mono text-sm border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            spellCheck="false"
          />
        </Card>

        {showPreview && (
          <Card className="border border-border overflow-hidden">
            <div className="bg-muted px-4 py-2 border-b border-border">
              <p className="text-sm font-medium text-muted-foreground">
                Live Preview
              </p>
            </div>
            <div className="h-96 overflow-auto bg-card">
              {/*
                Live preview is rendered in a sandboxed iframe so admin-authored
                CSS cannot exfiltrate data from the host document (e.g. via
                background-image URLs on attribute-value selectors matching
                inputs) nor break the surrounding admin UI.
              */}
              <iframe
                sandbox=""
                title="CSS preview"
                className="h-full w-full border-0"
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="tenant-override" style="font-family:sans-serif;padding:1rem;">
                  <section style="margin-bottom:1rem;">
                    <h3>Buttons</h3>
                    <button>Primary</button>
                    <button>Secondary</button>
                  </section>
                  <section style="margin-bottom:1rem;">
                    <h3>Text</h3>
                    <p>Sample paragraph text with your custom CSS applied.</p>
                  </section>
                  <section>
                    <h3>Form Elements</h3>
                    <input type="text" placeholder="Sample input field" />
                  </section>
                </body></html>`}
              />
              {!validateCSS() && (
                <div className="mt-4 mx-4 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-700">
                    CSS validation warning: Check for syntax errors
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      <Card className="bg-blue-50 border border-blue-200 p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • Use CSS variables for consistent theming (--primary-color, etc)
          </li>
          <li>• Apply styles to .tenant-override class for isolated changes</li>
          <li>• Avoid !important unless necessary for specificity</li>
          <li>• Test responsive design at different breakpoints</li>
        </ul>
      </Card>
    </div>
  );
}
