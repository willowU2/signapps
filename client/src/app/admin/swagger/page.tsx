"use client";

/**
 * DA2: Swagger UI page for all services.
 *
 * Embeds Swagger UI via an iframe pointed at the public Swagger UI CDN with
 * the SignApps Identity service OpenAPI spec URL pre-loaded.
 *
 * Also provides a service selector so the user can switch between services.
 * Each service exposes its OpenAPI spec at GET /api/v1/openapi.json.
 */

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTitle } from "@/hooks/use-page-title";

// ---------------------------------------------------------------------------
// Service definitions
// ---------------------------------------------------------------------------

interface ServiceSpec {
  name: string;
  port: number;
  /** URL of the OpenAPI JSON spec */
  specUrl: string;
  description: string;
}

const SERVICES: ServiceSpec[] = [
  {
    name: "Identity",
    port: 3001,
    specUrl: "http://localhost:3001/api/v1/openapi.json",
    description: "Auth, users, LDAP, MFA, RBAC",
  },
  {
    name: "Mail",
    port: 3012,
    specUrl: "http://localhost:3012/api/v1/openapi.json",
    description: "IMAP sync, send, labels, rules",
  },
  {
    name: "Calendar",
    port: 3004,
    specUrl: "http://localhost:3004/api/v1/openapi.json",
    description: "Events, invitations, recurrence",
  },
  {
    name: "Storage",
    port: 3006,
    specUrl: "http://localhost:3006/api/v1/openapi.json",
    description: "Files, buckets, presigned URLs",
  },
  {
    name: "Billing",
    port: 3020,
    specUrl: "http://localhost:3020/api/v1/openapi.json",
    description: "Plans, invoices, line items",
  },
  {
    name: "Containers",
    port: 3002,
    specUrl: "http://localhost:3002/api/v1/openapi.json",
    description: "Docker container lifecycle",
  },
];

// The Swagger UI CDN base URL
const SWAGGER_UI_BASE = "https://petstore.swagger.io";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SwaggerPage() {
  usePageTitle("Swagger UI");
  const [selectedService, setSelectedService] = useState<ServiceSpec>(
    SERVICES[0],
  );

  const swaggerUrl = `${SWAGGER_UI_BASE}/?url=${encodeURIComponent(selectedService.specUrl)}`;
  const directSpecUrl = selectedService.specUrl;

  return (
    <AppLayout>
      <div className="space-y-4 p-6">
        {/* Header */}
        <PageHeader
          title="Swagger UI"
          description="Interactive API documentation for all SignApps services."
          icon={<BookOpen className="h-5 w-5 text-primary" />}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(directSpecUrl, "_blank")}
              >
                <ExternalLink className="size-4" />
                Raw OpenAPI JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(swaggerUrl, "_blank")}
              >
                <ExternalLink className="size-4" />
                Open in Swagger UI
              </Button>
            </div>
          }
        />

        {/* Service selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Select Service
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((service) => (
                <button
                  key={service.name}
                  onClick={() => setSelectedService(service)}
                  className={[
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    selectedService.name === service.name
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-card hover:bg-accent hover:text-accent-foreground",
                  ].join(" ")}
                >
                  <span>{service.name}</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    :{service.port}
                  </Badge>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedService.description} — spec at{" "}
              <code className="font-mono text-xs bg-muted rounded px-1">
                {selectedService.specUrl}
              </code>
            </p>
          </CardContent>
        </Card>

        {/* Swagger UI iframe */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <iframe
              key={selectedService.name}
              src={swaggerUrl}
              title={`Swagger UI — ${selectedService.name} Service`}
              className="w-full border-0"
              style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
