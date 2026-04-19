"use client";

/**
 * link-list-widget — render a list of custom links admin-configured.
 *
 * `config.items` is an array of `{ label, url, description? }`.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface LinkItem {
  label: string;
  url: string;
  description?: string;
}

function parseItems(raw: unknown): LinkItem[] {
  if (!Array.isArray(raw)) return [];
  const out: LinkItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label : null;
    const url = typeof obj.url === "string" ? obj.url : null;
    if (!label || !url) continue;
    out.push({
      label,
      url,
      description:
        typeof obj.description === "string" ? obj.description : undefined,
    });
  }
  return out;
}

export interface LinkListWidgetProps {
  config: Record<string, unknown>;
}

export function LinkListWidget({ config }: LinkListWidgetProps) {
  const title = typeof config.title === "string" ? config.title : "Liens";
  const items = parseItems(config.items);

  return (
    <Card className="m-4">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun lien configuré.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item, idx) => (
              <li key={`${item.url}-${idx}`}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>{item.label}</span>
                </a>
                {item.description && (
                  <p className="text-xs text-muted-foreground pl-5">
                    {item.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
