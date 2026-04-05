"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Brain,
  Database,
  GitBranch,
  Users,
  Search,
  Upload,
  RefreshCw,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClient, ServiceName } from "@/lib/api/factory";

const aiClient = getClient(ServiceName.AI);

const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  organization: "#10b981",
  concept: "#8b5cf6",
  technology: "#f59e0b",
  event: "#ef4444",
  department: "#06b6d4",
  group: "#ec4899",
  default: "#6b7280",
};

function KnowledgeGraphViewer() {
  const [graphData, setGraphData] = useState<{
    nodes: { id: string; name: string; type: string; x: number; y: number }[];
    edges: { source: string; target: string; type: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const res = await aiClient.get("/ai/lightrag/graph");
      setGraphData(res.data);
    } catch {
      toast.error("Erreur de chargement du graphe");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
        <GitBranch className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">Aucune donnee dans le graphe</p>
        <p className="text-xs mt-1">
          Indexez des documents ou lancez le seed pour alimenter le graphe
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        width="100%"
        height="400"
        viewBox="0 0 600 400"
        className="border rounded-lg bg-muted/20"
      >
        {/* Edges */}
        {graphData.edges.map((edge, i) => {
          const source = graphData.nodes.find((n) => n.id === edge.source);
          const target = graphData.nodes.find((n) => n.id === edge.target);
          if (!source || !target) return null;
          return (
            <line
              key={`edge-${i}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          );
        })}
        {/* Nodes */}
        {graphData.nodes.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={8}
              fill={TYPE_COLORS[node.type] ?? TYPE_COLORS.default}
              fillOpacity={0.8}
              stroke={TYPE_COLORS[node.type] ?? TYPE_COLORS.default}
              strokeWidth={2}
            />
            <text
              x={node.x}
              y={node.y + 18}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              fillOpacity={0.6}
            >
              {node.name.length > 12
                ? node.name.slice(0, 12) + "..."
                : node.name}
            </text>
          </g>
        ))}
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(TYPE_COLORS)
          .filter(([k]) => k !== "default")
          .map(([type, color]) => (
            <div
              key={type}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {type}
            </div>
          ))}
      </div>
    </div>
  );
}

export default function LightRagPage() {
  usePageTitle("LightRAG — Intelligence Artificielle");
  const queryClient = useQueryClient();

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["lightrag-stats"],
    queryFn: async () => {
      const res = await aiClient.get("/ai/lightrag/stats");
      return res.data;
    },
    refetchInterval: 30000,
  });

  // Seed mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await aiClient.post("/ai/lightrag/seed");
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Seed termine: ${data.entities_created} entites, ${data.relations_created} relations`,
      );
      queryClient.invalidateQueries({ queryKey: ["lightrag-stats"] });
    },
    onError: () => toast.error("Erreur lors du seed"),
  });

  // Query
  const [question, setQuestion] = useState("");
  const [queryResult, setQueryResult] = useState<{
    answer: string;
    entities?: { entity_type: string; name: string; score: number }[];
    relations?: { source: string; relation_type: string; target: string }[];
  } | null>(null);
  const [querying, setQuerying] = useState(false);

  const handleQuery = async () => {
    if (!question.trim()) return;
    setQuerying(true);
    try {
      const res = await aiClient.post("/ai/lightrag/query", { question });
      setQueryResult(res.data.result);
      toast.success("Reponse generee");
    } catch {
      toast.error("Erreur lors de la requete");
    } finally {
      setQuerying(false);
    }
  };

  // Index
  const [docText, setDocText] = useState("");
  const [indexing, setIndexing] = useState(false);

  const handleIndex = async () => {
    if (!docText.trim()) return;
    setIndexing(true);
    try {
      const res = await aiClient.post("/ai/lightrag/index", { text: docText });
      const r = res.data.result;
      toast.success(
        `Indexe: ${r.entities_created} entites, ${r.relations_created} relations, ${r.chunks_processed} chunks`,
      );
      setDocText("");
      queryClient.invalidateQueries({ queryKey: ["lightrag-stats"] });
    } catch {
      toast.error("Erreur lors de l'indexation");
    } finally {
      setIndexing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="LightRAG — Graphe de Connaissances"
          description="Recherche augmentee par graphe de connaissances — extraction d'entites, relations, et reponses contextuelles"
          icon={<Brain className="h-5 w-5" />}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Alimenter le graphe
            </Button>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Entites</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.entities ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                personnes, organisations, concepts...
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Relations</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.relations ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                connexions entre entites
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Communautes</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.communities ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                clusters thematiques
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Knowledge Graph Visualization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Visualisation du graphe
            </CardTitle>
            <CardDescription>
              Entites (noeuds) et relations (aretes) du graphe de connaissances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <KnowledgeGraphViewer />
          </CardContent>
        </Card>

        {/* Query Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Interroger le graphe
            </CardTitle>
            <CardDescription>
              Posez une question — le systeme cherche dans les entites (local)
              et les relations (global) puis genere une reponse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Qui travaille dans le departement Engineering ?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                className="flex-1"
              />
              <Button
                onClick={handleQuery}
                disabled={querying || !question.trim()}
              >
                {querying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Rechercher
              </Button>
            </div>

            {queryResult && (
              <div className="space-y-4 mt-4">
                {/* Answer */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm whitespace-pre-wrap">
                    {queryResult.answer}
                  </p>
                </div>

                {/* Context used */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Entities */}
                  {queryResult.entities && queryResult.entities.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Entites utilisees
                      </h4>
                      <div className="space-y-1">
                        {queryResult.entities.map((e, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs"
                          >
                            <Badge variant="secondary" className="text-[10px]">
                              {e.entity_type}
                            </Badge>
                            <span className="font-medium">{e.name}</span>
                            <span className="text-muted-foreground">
                              ({(e.score * 100).toFixed(0)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Relations */}
                  {queryResult.relations &&
                    queryResult.relations.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">
                          Relations utilisees
                        </h4>
                        <div className="space-y-1">
                          {queryResult.relations.map((r, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-medium">{r.source}</span>
                              <span className="text-muted-foreground mx-1">
                                → {r.relation_type} →
                              </span>
                              <span className="font-medium">{r.target}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Index Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Indexer un document
            </CardTitle>
            <CardDescription>
              Collez du texte pour extraire automatiquement les entites et
              relations via LLM
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Collez le contenu du document ici..."
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              rows={6}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {docText.length} caracteres
              </span>
              <Button
                onClick={handleIndex}
                disabled={indexing || !docText.trim()}
              >
                {indexing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Indexer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
