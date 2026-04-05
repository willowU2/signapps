"use client";

import React, { useState } from "react";
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
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
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
              <Button onClick={handleIndex} disabled={indexing || !docText.trim()}>
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
