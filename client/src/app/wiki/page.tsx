"use client";

import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Search,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import { AiKnowledgeChat } from "@/components/knowledge/ai-knowledge-chat";

// ── Types ────────────────────────────────────────────────────────────────────

interface WikiPage {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  tags: string[];
  updatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const INITIAL_PAGES: WikiPage[] = [
  {
    id: "home",
    title: "Accueil",
    content:
      "# Wiki interne\n\nBienvenue dans le wiki de votre organisation. Utilisez la barre latérale pour naviguer entre les pages.",
    parentId: null,
    tags: ["home"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "onboarding",
    title: "Onboarding",
    content:
      "# Onboarding\n\nGuide d'intégration pour les nouveaux collaborateurs.",
    parentId: null,
    tags: ["rh"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tech-stack",
    title: "Stack technique",
    content:
      "# Stack technique\n\n- **Backend**: Rust / Axum / Tokio\n- **Frontend**: Next.js 16\n- **BDD**: PostgreSQL\n- **Auth**: JWT",
    parentId: "onboarding",
    tags: ["tech"],
    updatedAt: new Date().toISOString(),
  },
];

// ── Page tree component ──────────────────────────────────────────────────────

function PageTreeItem({
  page,
  pages,
  level,
  selectedId,
  onSelect,
  onDelete,
}: {
  page: WikiPage;
  pages: WikiPage[];
  level: number;
  selectedId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = pages.filter((p) => p.parentId === page.id);
  const isSelected = selectedId === page.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer group text-sm
          ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onClick={() => onSelect(page.id)}
      >
        <button
          className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {children.length > 0 ? (
            expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <span className="h-3 w-3" />
          )}
        </button>
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate flex-1">{page.title}</span>
        {!isSelected && (
          <button
            className="opacity-0 group-hover:opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(page.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      {expanded &&
        children.map((child) => (
          <PageTreeItem
            key={child.id}
            page={child}
            pages={pages}
            level={level + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WikiPage() {
  usePageTitle("Wiki");
  const [pages, setPages] = useState<WikiPage[]>(INITIAL_PAGES);
  const [selectedId, setSelectedId] = useState("home");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selected = pages.find((p) => p.id === selectedId) ?? pages[0];
  const rootPages = pages.filter((p) => p.parentId === null);

  const filteredPages = searchQuery
    ? pages.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.content.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null;

  const startEdit = useCallback(() => {
    if (!selected) return;
    setDraft(selected.content);
    setDraftTitle(selected.title);
    setEditing(true);
  }, [selected]);

  const saveEdit = useCallback(() => {
    if (!selected) return;
    setPages((prev) =>
      prev.map((p) =>
        p.id === selected.id
          ? {
              ...p,
              title: draftTitle.trim() || p.title,
              content: draft,
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
    setEditing(false);
    toast.success("Page sauvegardée");
  }, [selected, draft, draftTitle]);

  const addPage = useCallback(() => {
    const newPage: WikiPage = {
      id: generateId(),
      title: "Nouvelle page",
      content: "# Nouvelle page\n\nContenu à rédiger.",
      parentId: selected?.id ?? null,
      tags: [],
      updatedAt: new Date().toISOString(),
    };
    setPages((prev) => [...prev, newPage]);
    setSelectedId(newPage.id);
    setDraft(newPage.content);
    setDraftTitle(newPage.title);
    setEditing(true);
    toast.success("Page créée");
  }, [selected]);

  const deletePage = useCallback(
    (id: string) => {
      if (id === "home") {
        toast.error("La page d'accueil ne peut pas être supprimée");
        return;
      }
      setPages((prev) => prev.filter((p) => p.id !== id && p.parentId !== id));
      if (selectedId === id) setSelectedId("home");
      toast.success("Page supprimée");
    },
    [selectedId],
  );

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-0 border rounded-lg overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r flex flex-col bg-muted/20">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Wiki</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher…"
                className="pl-7 h-7 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredPages ? (
              filteredPages.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">
                  Aucun résultat
                </p>
              ) : (
                filteredPages.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer text-sm
                        ${selectedId === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    onClick={() => {
                      setSelectedId(p.id);
                      setSearchQuery("");
                      setEditing(false);
                    }}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.title}</span>
                  </div>
                ))
              )
            ) : (
              rootPages.map((page) => (
                <PageTreeItem
                  key={page.id}
                  page={page}
                  pages={pages}
                  level={0}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setEditing(false);
                  }}
                  onDelete={deletePage}
                />
              ))
            )}
          </div>

          <div className="p-2 border-t">
            <Button
              size="sm"
              variant="outline"
              onClick={addPage}
              className="w-full gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle page
            </Button>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Tabs defaultValue="page" className="flex flex-col flex-1">
            <div className="flex items-center justify-between px-4 pt-3 pb-0 border-b">
              <TabsList className="h-8 gap-1">
                <TabsTrigger value="page" className="text-xs gap-1 h-7">
                  <FileText className="h-3.5 w-3.5" />
                  Page
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs gap-1 h-7">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Assistant IA
                </TabsTrigger>
              </TabsList>
              {!editing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={startEdit}
                  className="gap-1.5 text-xs h-7"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Modifier
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(false)}
                    className="gap-1 text-xs h-7"
                  >
                    <X className="h-3 w-3" />
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveEdit}
                    className="gap-1 text-xs h-7"
                  >
                    <Save className="h-3 w-3" />
                    Sauvegarder
                  </Button>
                </div>
              )}
            </div>

            <TabsContent
              value="page"
              className="flex-1 overflow-y-auto p-4 mt-0"
            >
              {editing ? (
                <div className="space-y-3 h-full flex flex-col">
                  <Input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0"
                    placeholder="Titre de la page"
                  />
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="flex-1 resize-none font-mono text-sm min-h-[400px]"
                    placeholder="Contenu en Markdown…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Markdown supporté
                  </p>
                </div>
              ) : selected ? (
                <div className="max-w-3xl">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h1 className="text-2xl font-bold mb-1">
                        {selected.title}
                      </h1>
                      <p className="text-xs text-muted-foreground">
                        Mis à jour le{" "}
                        {new Date(selected.updatedAt).toLocaleDateString(
                          "fr-FR",
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {selected.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {selected.content.split("\n").map((line, i) => {
                      if (line.startsWith("# "))
                        return (
                          <h1 key={i} className="text-xl font-bold mt-4 mb-2">
                            {line.slice(2)}
                          </h1>
                        );
                      if (line.startsWith("## "))
                        return (
                          <h2
                            key={i}
                            className="text-lg font-semibold mt-3 mb-1"
                          >
                            {line.slice(3)}
                          </h2>
                        );
                      if (line.startsWith("### "))
                        return (
                          <h3
                            key={i}
                            className="text-base font-semibold mt-2 mb-1"
                          >
                            {line.slice(4)}
                          </h3>
                        );
                      if (line.startsWith("- "))
                        return (
                          <li key={i} className="ml-4 text-sm">
                            {line.slice(2)}
                          </li>
                        );
                      if (line.trim() === "") return <br key={i} />;
                      return (
                        <p key={i} className="text-sm">
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="ai" className="flex-1 mt-0 p-0">
              <AiKnowledgeChat />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
