"use client";

import { useState } from "react";
import {
  HelpCircle,
  X,
  ExternalLink,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  href?: string;
}

interface ContextualHelpProps {
  articles: HelpArticle[];
  context?: string;
}

export function ContextualHelp({ articles, context }: ContextualHelpProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<HelpArticle | null>(null);

  if (articles.length === 0) return null;

  if (selected) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-3 border-b flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setSelected(null)}
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </Button>
            <p className="font-medium text-sm flex-1">{selected.title}</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setOpen(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <ScrollArea className="max-h-64 p-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {selected.content}
            </p>
            {selected.href && (
              <a
                href={selected.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> En savoir plus
              </a>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <p className="font-medium text-sm">
              Aide{context ? ` — ${context}` : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setOpen(false)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="p-2">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => setSelected(article)}
              className="w-full flex items-start gap-2 p-2 rounded-md text-left hover:bg-muted transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{article.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {article.content}
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Resource Center - full searchable help */
const GLOBAL_ARTICLES: HelpArticle[] = [
  {
    id: "1",
    title: "Premiers pas",
    content:
      "Découvrez comment configurer votre espace de travail SignApps en quelques minutes.",
    tags: ["démarrage"],
  },
  {
    id: "2",
    title: "Gérer les utilisateurs",
    content:
      "Ajoutez des membres, créez des groupes et gérez les permissions via la section Admin.",
    tags: ["admin"],
  },
  {
    id: "3",
    title: "Créer un document",
    content:
      'Accédez à Docs et cliquez sur "Nouveau". Vous pouvez collaborer en temps réel.',
    tags: ["docs"],
  },
  {
    id: "4",
    title: "Configurer la messagerie",
    content:
      "Allez dans Paramètres > Mail pour configurer votre serveur SMTP/IMAP.",
    tags: ["mail"],
  },
  {
    id: "5",
    title: "Partager des fichiers",
    content:
      "Dans Drive, cliquez droit sur un fichier pour le partager avec des membres ou des groupes.",
    tags: ["drive"],
  },
  {
    id: "6",
    title: "Raccourcis clavier",
    content:
      "Ctrl+K pour la recherche globale, Ctrl+/ pour les raccourcis, Ctrl+N pour nouveau.",
    tags: ["clavier"],
  },
];

export function ResourceCenter() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<HelpArticle | null>(null);

  const filtered = search
    ? GLOBAL_ARTICLES.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.content.toLowerCase().includes(search.toLowerCase()),
      )
    : GLOBAL_ARTICLES;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-muted-foreground"
      >
        <BookOpen className="w-4 h-4" />
        Aide
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-80">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Centre de ressources
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans l'aide..."
              className="w-full h-8 px-3 text-sm bg-muted rounded-md outline-none border border-transparent focus:border-primary"
            />
            {selected ? (
              <div className="space-y-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                  className="h-7 text-xs"
                >
                  ← Retour
                </Button>
                <h3 className="font-medium">{selected.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selected.content}
                </p>
                {selected.tags && (
                  <div className="flex gap-1 flex-wrap">
                    {selected.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-1 pr-2">
                  {filtered.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="w-full flex items-start gap-2 p-2.5 rounded-lg text-left hover:bg-muted transition-colors"
                    >
                      <HelpCircle className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {a.content}
                        </p>
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Aucun résultat
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
