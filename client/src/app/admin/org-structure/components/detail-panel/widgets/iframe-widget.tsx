"use client";

/**
 * iframe-widget — embeds an external URL inside a tab.
 *
 * The iframe is sandboxed by default (`allow-same-origin allow-scripts`),
 * limited to the admin-provided URL.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

export interface IframeWidgetProps {
  config: Record<string, unknown>;
}

export function IframeWidget({ config }: IframeWidgetProps) {
  const url = typeof config.url === "string" ? config.url : "";
  const label = typeof config.label === "string" ? config.label : "Embed";
  const height =
    typeof config.height === "number" ? `${config.height}px` : "500px";

  if (!url) {
    return (
      <Card className="m-4">
        <CardHeader>
          <CardTitle className="text-sm">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Aucune URL configurée.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="m-4 overflow-hidden">
      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{label}</CardTitle>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Ouvrir
        </a>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          src={url}
          title={label}
          className="w-full border-0"
          style={{ height }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </CardContent>
    </Card>
  );
}
