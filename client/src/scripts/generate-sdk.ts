/**
 * DX2: TypeScript SDK auto-generation from OpenAPI specs
 *
 * This script reads OpenAPI specs from each SignApps microservice,
 * then generates strongly-typed TypeScript functions for each endpoint.
 *
 * Output directory: client/src/lib/api/generated/
 *
 * Usage (from project root):
 *   npx ts-node client/src/scripts/generate-sdk.ts
 *   # or during dev
 *   npx tsx client/src/scripts/generate-sdk.ts
 *
 * Prerequisites:
 *   - All services must be running (or at least reachable on their ports)
 *   - Each service exposes its OpenAPI spec at GET /api/v1/openapi.json (or /docs/openapi.json)
 *
 * This is a documentation/reference script — not imported by the runtime app.
 */

import fs from "fs";
import path from "path";

// ── Service registry ──────────────────────────────────────────────────────────

interface ServiceConfig {
  name: string;
  port: number;
  /** Path where the OpenAPI JSON spec is served */
  specPath: string;
}

const SERVICES: ServiceConfig[] = [
  { name: "identity", port: 3001, specPath: "/api/v1/openapi.json" },
  { name: "containers", port: 3002, specPath: "/api/v1/openapi.json" },
  { name: "proxy", port: 3003, specPath: "/api/v1/openapi.json" },
  { name: "storage", port: 3004, specPath: "/api/v1/openapi.json" },
  { name: "ai", port: 3005, specPath: "/api/v1/openapi.json" },
  { name: "scheduler", port: 3007, specPath: "/api/v1/openapi.json" },
  { name: "metrics", port: 3008, specPath: "/api/v1/openapi.json" },
  { name: "notifications", port: 3009, specPath: "/api/v1/openapi.json" },
  { name: "mail", port: 3012, specPath: "/api/v1/openapi.json" },
  { name: "calendar", port: 3011, specPath: "/api/v1/openapi.json" },
  { name: "contacts", port: 3021, specPath: "/api/v1/openapi.json" },
  { name: "crm", port: 3020, specPath: "/api/v1/openapi.json" },
  { name: "drive", port: 3014, specPath: "/api/v1/openapi.json" },
  { name: "docs", port: 3015, specPath: "/api/v1/openapi.json" },
  { name: "meet", port: 3017, specPath: "/api/v1/openapi.json" },
  { name: "office", port: 3018, specPath: "/api/v1/openapi.json" },
  { name: "billing", port: 3019, specPath: "/api/v1/openapi.json" },
  { name: "hr", port: 3024, specPath: "/api/v1/openapi.json" },
  { name: "forms", port: 3025, specPath: "/api/v1/openapi.json" },
  { name: "chat", port: 3026, specPath: "/api/v1/openapi.json" },
];

// ── OpenAPI types (minimal subset we use) ────────────────────────────────────

interface OpenAPISpec {
  info?: { title?: string; version?: string };
  paths?: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
  };
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    content?: {
      "application/json"?: { schema?: OpenAPISchema };
    };
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: {
        "application/json"?: { schema?: OpenAPISchema };
      };
    }
  >;
}

interface OpenAPIParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  schema?: OpenAPISchema;
}

interface OpenAPISchema {
  type?: string;
  $ref?: string;
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
}

// ── Type mapping ──────────────────────────────────────────────────────────────

function schemaToTs(schema: OpenAPISchema | undefined, indent = 0): string {
  if (!schema) return "unknown";
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop() ?? "unknown";
    return name;
  }
  switch (schema.type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `${schemaToTs(schema.items, indent)}[]`;
    case "object": {
      if (!schema.properties) return "Record<string, unknown>";
      const pad = "  ".repeat(indent + 1);
      const fields = Object.entries(schema.properties)
        .map(([k, v]) => {
          const optional = !(schema.required ?? []).includes(k);
          return `${pad}${k}${optional ? "?" : ""}: ${schemaToTs(v, indent + 1)};`;
        })
        .join("\n");
      return `{\n${fields}\n${"  ".repeat(indent)}}`;
    }
    default:
      return "unknown";
  }
}

// ── Code generation ───────────────────────────────────────────────────────────

function generateFunctionName(method: string, urlPath: string): string {
  const parts = urlPath
    .replace(/\{[^}]+\}/g, "ById")
    .split("/")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return `${method.toLowerCase()}${parts.join("")}`;
}

function generateClient(service: ServiceConfig, spec: OpenAPISpec): string {
  const lines: string[] = [];
  const title = spec.info?.title ?? service.name;
  const version = spec.info?.version ?? "?";

  lines.push(`// AUTO-GENERATED — DO NOT EDIT MANUALLY`);
  lines.push(`// Source: ${service.name} service (port ${service.port})`);
  lines.push(`// Spec version: ${version} — ${title}`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`import { getClient, ServiceName } from '../factory';`);
  lines.push(``);
  lines.push(
    `const client = () => getClient(ServiceName.${service.name.toUpperCase().replace(/-/g, "_")});`,
  );
  lines.push(``);

  // Generate schema interfaces from components
  if (spec.components?.schemas) {
    lines.push(
      `// ── Generated types ───────────────────────────────────────────────────────────`,
    );
    lines.push(``);
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      lines.push(`export interface ${name} ${schemaToTs(schema)}`);
      lines.push(``);
    }
  }

  lines.push(
    `// ── API functions ─────────────────────────────────────────────────────────────`,
  );
  lines.push(``);
  lines.push(`export const ${service.name.replace(/-/g, "_")}GeneratedApi = {`);

  const paths = spec.paths ?? {};
  for (const [urlPath, methods] of Object.entries(paths)) {
    for (const [httpMethod, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(httpMethod))
        continue;

      const funcName =
        operation.operationId ?? generateFunctionName(httpMethod, urlPath);
      const summary = operation.summary ?? operation.description ?? "";

      // Path params
      const pathParams = (operation.parameters ?? [])
        .filter((p) => p.in === "path")
        .map((p) => `${p.name}: ${schemaToTs(p.schema)}`);

      // Query params
      const queryParams = (operation.parameters ?? [])
        .filter((p) => p.in === "query")
        .map(
          (p) => `${p.name}${p.required ? "" : "?"}: ${schemaToTs(p.schema)}`,
        );

      // Body
      const bodySchema =
        operation.requestBody?.content?.["application/json"]?.schema;
      const bodyParam = bodySchema ? [`body: ${schemaToTs(bodySchema)}`] : [];

      // Response type
      const okResponse =
        operation.responses?.["200"] ?? operation.responses?.["201"];
      const responseSchema = okResponse?.content?.["application/json"]?.schema;
      const returnType = responseSchema
        ? schemaToTs(responseSchema)
        : "unknown";

      // Build function signature
      const allParams = [...pathParams, ...bodyParam];
      if (queryParams.length > 0) {
        allParams.push(`params?: { ${queryParams.join("; ")} }`);
      }

      // Build URL with path interpolation
      const urlWithParams = urlPath.replace(
        /\{([^}]+)\}/g,
        (_, name) => `\${${name}}`,
      );

      lines.push(`  /** ${summary} */`);

      if (httpMethod === "get") {
        const hasQueryParams = queryParams.length > 0;
        lines.push(
          `  ${funcName}: (${allParams.join(", ")}) =>` +
            ` client().get<${returnType}>(\`${urlWithParams}\`${hasQueryParams ? ", { params }" : ""}),`,
        );
      } else if (httpMethod === "delete") {
        lines.push(
          `  ${funcName}: (${allParams.join(", ")}) => client().delete(\`${urlWithParams}\`),`,
        );
      } else {
        lines.push(
          `  ${funcName}: (${allParams.join(", ")}) =>` +
            ` client().${httpMethod}<${returnType}>(\`${urlWithParams}\`${bodyParam.length > 0 ? ", body" : ""}),`,
        );
      }
    }
  }

  lines.push(`};`);
  lines.push(``);

  return lines.join("\n");
}

// ── Fetch spec ────────────────────────────────────────────────────────────────

async function fetchSpec(service: ServiceConfig): Promise<OpenAPISpec | null> {
  const url = `http://localhost:${service.port}${service.specPath}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.warn(`  [${service.name}] HTTP ${res.status} — skipping`);
      return null;
    }
    return (await res.json()) as OpenAPISpec;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [${service.name}] Unreachable (${msg}) — skipping`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const outDir = path.resolve(__dirname, "../lib/api/generated");
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Generating SDK into ${outDir}\n`);

  let generated = 0;
  let skipped = 0;

  for (const service of SERVICES) {
    process.stdout.write(`Fetching ${service.name} (port ${service.port})… `);
    const spec = await fetchSpec(service);

    if (!spec) {
      skipped++;
      continue;
    }

    const code = generateClient(service, spec);
    const outFile = path.join(outDir, `${service.name}.generated.ts`);
    fs.writeFileSync(outFile, code, "utf8");
    console.log(`OK → ${path.basename(outFile)}`);
    generated++;
  }

  // Write index barrel
  const barrel =
    SERVICES.map((s) => `export * from './${s.name}.generated';`).join("\n") +
    "\n";
  fs.writeFileSync(path.join(outDir, "index.ts"), barrel, "utf8");

  console.log(
    `\nDone. ${generated} services generated, ${skipped} skipped (unreachable).`,
  );
  console.log(`Index barrel written to generated/index.ts`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
