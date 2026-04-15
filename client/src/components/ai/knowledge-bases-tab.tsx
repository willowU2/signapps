"use client";

import { SpinnerInfinity } from "spinners-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Database,
  FileText,
  FolderPlus,
  HardDrive,
  MessageSquare,
  MoreVertical,
  Trash2,
  Upload,
} from "lucide-react";
import { KnowledgeBase } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface KnowledgeBasesTabProps {
  knowledgeBases: KnowledgeBase[];
  loadingKnowledgeBases: boolean;
  selectedKnowledgeBases: string[];
  onCreateKnowledgeBase: () => void;
  onSelectForChat: (kbName: string) => void;
  onOpenUpload: () => void;
  onDeleteKnowledgeBase: (kb: KnowledgeBase) => void;
}

export function KnowledgeBasesTab({
  knowledgeBases,
  loadingKnowledgeBases,
  selectedKnowledgeBases,
  onCreateKnowledgeBase,
  onSelectForChat,
  onOpenUpload,
  onDeleteKnowledgeBase,
}: KnowledgeBasesTabProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Knowledge Bases</h2>
          <p className="text-sm text-muted-foreground">
            Gerez vos collections de documents pour le RAG
          </p>
        </div>
        <Button onClick={onCreateKnowledgeBase}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Nouvelle collection
        </Button>
      </div>

      {loadingKnowledgeBases ? (
        <div className="flex items-center justify-center py-12">
          <SpinnerInfinity
            size={24}
            secondaryColor="rgba(128,128,128,0.2)"
            color="currentColor"
            speed={120}
            className="h-8 w-8"
          />
        </div>
      ) : knowledgeBases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Aucune knowledge base</p>
            <p className="text-sm text-muted-foreground mb-4">
              Creez une collection pour commencer a indexer vos documents
            </p>
            <Button onClick={onCreateKnowledgeBase}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Creer une collection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {knowledgeBases.map((kb) => (
            <Card
              key={kb.name}
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/50",
                selectedKnowledgeBases.includes(kb.name) &&
                  "ring-2 ring-primary",
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{kb.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onSelectForChat(kb.name)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Utiliser pour le chat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onOpenUpload}>
                        <Upload className="h-4 w-4 mr-2" />
                        Ajouter des documents
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDeleteKnowledgeBase(kb)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {kb.description && (
                  <p className="text-sm text-muted-foreground">
                    {kb.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{kb.documents_count}</p>
                      <p className="text-xs text-muted-foreground">Documents</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{kb.chunks_count}</p>
                      <p className="text-xs text-muted-foreground">Chunks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {formatBytes(kb.size_bytes)}
                      </p>
                      <p className="text-xs text-muted-foreground">Taille</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
