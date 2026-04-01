"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Play, AlertTriangle, Clock } from "lucide-react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { toast } from "sonner";

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number;
}

const SAMPLE_QUERIES = [
  "SELECT COUNT(*) as users FROM users",
  "SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 10",
  "SELECT service, COUNT(*) as errors FROM error_logs WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY service",
];

export function DbQueryExplorer() {
  const [query, setQuery] = useState(SAMPLE_QUERIES[0]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const trimmed = query.trim().toUpperCase();
    if (
      !trimmed.startsWith("SELECT") &&
      !trimmed.startsWith("SHOW") &&
      !trimmed.startsWith("EXPLAIN")
    ) {
      toast.error(
        "Only SELECT, SHOW, and EXPLAIN queries are allowed in this explorer",
      );
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const client = getClient(ServiceName.IDENTITY);
      const start = Date.now();
      const res = await client.post<QueryResult>("/admin/db/query", {
        sql: query,
      });
      setResult({ ...res.data, duration: Date.now() - start });
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        err?.response?.data?.error ||
          (e instanceof Error ? e.message : String(e)) ||
          "Query failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-5 w-5 text-primary" />
          Database Query Explorer
          <Badge variant="outline" className="text-xs ml-auto">
            Read-Only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Only SELECT, SHOW, and EXPLAIN queries are permitted. All writes are
            blocked.
          </p>
        </div>

        {/* Sample queries */}
        <div className="flex gap-1.5 flex-wrap">
          {SAMPLE_QUERIES.map((q, i) => (
            <button
              key={i}
              onClick={() => setQuery(q)}
              className="text-xs px-2 py-1 rounded border bg-muted hover:bg-accent transition-colors truncate max-w-[200px]"
            >
              {q.slice(0, 30)}...
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT * FROM users LIMIT 10"
            rows={4}
            className="font-mono text-sm resize-none"
          />
          <Button
            onClick={run}
            disabled={loading || !query.trim()}
            className="gap-1.5"
          >
            <Play className="h-4 w-4" />
            {loading ? "Running..." : "Run Query"}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400 font-mono">
              {error}
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {result.rowCount} row{result.rowCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.duration}ms
              </span>
            </div>
            <ScrollArea className="h-64 border rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted border-b">
                    <tr>
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          className="text-left px-3 py-2 font-medium whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        {result.columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-2 font-mono whitespace-nowrap max-w-[200px] truncate"
                          >
                            {row[col] == null ? (
                              <span className="text-muted-foreground">
                                NULL
                              </span>
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
