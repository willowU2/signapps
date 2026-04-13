"use client";

import { SpinnerInfinity } from "spinners-react";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { driveApi, DriveNode } from "@/lib/api";
import { fetchAndParseDocument } from "@/lib/file-parsers";
import { useEntityStore } from "@/stores/entity-hub-store";
import {
  FileText,
  Plus,
  MoreVertical,
  Search,
  Pencil,
  Trash2,
  User,
  ExternalLink,
  Share2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  BUILTIN_DOC_TEMPLATES,
  getUserTemplates,
  deleteUserTemplate,
  DEPARTMENT_LABELS,
  type DocTemplate,
  type TemplateDepartment,
} from "@/lib/document-templates";
import { AiGenerateDoc } from "@/components/interop/AiGenerateDoc";
import { UnifiedContentLibrary } from "@/components/interop/UnifiedContentLibrary";
import {
  DocumentTags,
  TagFilterBar,
  getDocumentTags,
} from "@/components/docs/document-tags";
import { notify } from "@/lib/notify";

export default function DocsDashboard() {
  const router = useRouter();
  const [docs, setDocs] = useState<DriveNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Rename/Delete state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<DriveNode | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Template state
  const [pendingTemplateContent, setPendingTemplateContent] = useState<
    string | null
  >(null);
  const [userTemplates, setUserTemplates] = useState<DocTemplate[]>([]);
  const [deptFilter, setDeptFilter] = useState<TemplateDepartment | "all">(
    "all",
  );

  // Tag filter state
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const { selectedWorkspaceId } = useEntityStore();

  useEffect(() => {
    setUserTemplates(getUserTemplates().filter((t) => t.type === "document"));
  }, []);

  const fetchDocs = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const nodes = await driveApi.listNodes(null);
      const textDocs = nodes.filter(
        (n) =>
          n.node_type === "document" ||
          (n.mime_type && n.mime_type.includes("word")) ||
          n.name.endsWith(".docx"),
      );
      textDocs.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      setDocs(textDocs);

      // Fetch previews lazily for the first few documents
      textDocs.slice(0, 15).forEach(async (doc) => {
        try {
          let parsed: any;
          const targetKey = `${doc.target_id || doc.id}.html`;
          try {
            parsed = await fetchAndParseDocument("drive", targetKey, targetKey);
          } catch (err) {
            // Fallback to older format or manually uploaded files
            parsed = await fetchAndParseDocument("drive", doc.name, doc.name);
          }

          if (parsed && (parsed.text || parsed.html)) {
            // Nettoyer les balises HTML rudimentaires pour la preview
            const rawText = (parsed.text || parsed.html)
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            if (rawText) {
              setPreviews((prev) => ({
                ...prev,
                [doc.id]: rawText.substring(0, 300),
              }));
            }
          }
        } catch (e) {
          // Silently ignore if no document content found on server yet
        }
      });
    } catch (error) {
      console.error("Failed to fetch documents", error);
      setApiError(
        "Le service de documents est inaccessible. Vérifiez que le serveur est démarré.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [selectedWorkspaceId]);

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    try {
      await driveApi.deleteNode(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      toast.success("Document supprimé");
    } catch (error) {
      console.error("Impossible de supprimer document", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    const target = renameTarget;
    setRenameTarget(null);
    try {
      await driveApi.updateNode(target.id, { name: renameValue.trim() });
      setDocs((prev) =>
        prev.map((d) =>
          d.id === target.id ? { ...d, name: renameValue.trim() } : d,
        ),
      );
      toast.success("Document renommé");
    } catch (error) {
      console.error("Failed to rename document", error);
      toast.error("Erreur lors du renommage");
    }
  };

  const handleCreateNew = async (
    e?: React.FormEvent,
    templateContent?: string,
  ) => {
    if (e) e.preventDefault();
    if (!newDocName.trim()) return;

    setIsCreating(true);
    try {
      const targetId = crypto.randomUUID();
      const newNode = await driveApi.createNode({
        name: newDocName.trim(),
        node_type: "document",
        parent_id: null,
        target_id: targetId,
      });
      const finalTargetId = newNode.target_id || newNode.id;
      // If there's template content, store it in localStorage for the editor to pick up
      const contentToStore = templateContent || pendingTemplateContent;
      if (contentToStore) {
        localStorage.setItem(`doc-template:${finalTargetId}`, contentToStore);
      }
      setIsCreateOpen(false);
      setPendingTemplateContent(null);
      notify({
        title: "Document créé",
        body: newNode.name,
        module: "docs",
        deep_link: `/docs/editor?id=${finalTargetId}`,
      });
      router.push(
        `/docs/editor?id=${finalTargetId}&name=${encodeURIComponent(newNode.name)}`,
      );
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "";
      if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
        toast.error(
          `Un document "${newDocName.trim()}" existe déjà. Choisissez un autre nom.`,
        );
      } else {
        toast.error("Erreur lors de la création du document. Réessayez.");
      }
      setIsCreating(false);
    }
  };

  const handleUseTemplate = (template: DocTemplate) => {
    setNewDocName(template.title);
    setPendingTemplateContent(template.content);
    setIsCreateOpen(true);
  };

  const handleDeleteUserTemplate = (id: string) => {
    deleteUserTemplate(id);
    setUserTemplates(getUserTemplates().filter((t) => t.type === "document"));
    toast.success("Modèle supprimé");
  };

  const filteredDocs = docs.filter((d) => {
    const matchesSearch =
      !searchQuery.trim() ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag =
      !activeTagFilter || getDocumentTags(d.id).includes(activeTagFilter);
    return matchesSearch && matchesTag;
  });

  const handleOpenDoc = (node: DriveNode) => {
    const targetId = node.target_id || node.id;
    router.push(
      `/docs/editor?id=${targetId}&name=${encodeURIComponent(node.name)}`,
    );
  };

  const openCreateModal = () => {
    setNewDocName("");
    setIsCreateOpen(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 h-full bg-background/50 backdrop-blur-sm">
        <SpinnerInfinity
          size={24}
          secondaryColor="rgba(128,128,128,0.2)"
          color="currentColor"
          speed={120}
          className="h-8 w-8  text-primary mb-4"
        />
        <p className="text-muted-foreground animate-pulse">
          Chargement de vos documents...
        </p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 h-full">
        <FileText className="h-12 w-12 text-destructive/40 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Service indisponible
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          {apiError}
        </p>
        <Button onClick={fetchDocs} variant="outline">
          Réessayer
        </Button>
      </div>
    );
  }

  const builtinTemplates =
    deptFilter === "all"
      ? BUILTIN_DOC_TEMPLATES
      : BUILTIN_DOC_TEMPLATES.filter((t) => t.department === deptFilter);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto w-full">
      {/* Template Ribbon Section */}
      <section className="bg-muted/30 py-8 px-6 md:px-12 w-full border-b border-border/40 shrink-0">
        <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground tracking-tight">
              Créer un document
            </h2>
            <div className="flex items-center gap-2">
              <AiGenerateDoc />
              <UnifiedContentLibrary />
            </div>
          </div>

          {/* Department filter */}
          <div className="flex gap-1 flex-wrap -mt-2">
            {(
              ["all", ...Object.keys(DEPARTMENT_LABELS)] as Array<
                "all" | TemplateDepartment
              >
            ).map((dept) => (
              <button
                key={dept}
                onClick={() => setDeptFilter(dept)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  deptFilter === dept
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/50 hover:border-primary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {dept === "all" ? "Tous" : DEPARTMENT_LABELS[dept]}
              </button>
            ))}
          </div>

          <div className="flex gap-4 sm:gap-6 overflow-x-auto pt-2 pb-4 snap-x smooth-scroll no-scrollbar -mt-2">
            {/* Blank document */}
            <div className="flex flex-col gap-3 group shrink-0 snap-start">
              <Card
                onClick={openCreateModal}
                className="h-[185px] w-[140px] rounded border border-border/50 bg-background cursor-pointer flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:border-muted-foreground/30 group-hover:shadow-md group-hover:-translate-y-1 shadow-sm"
              >
                <div className="rounded-full bg-primary/10 p-4 transition-transform group-hover:scale-105 duration-300">
                  <Plus className="w-10 h-10 text-primary" strokeWidth={2.5} />
                </div>
              </Card>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground tracking-tight">
                  Document vierge
                </span>
              </div>
            </div>

            {/* Built-in templates */}
            {builtinTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col gap-3 group shrink-0 snap-start"
              >
                <Card
                  onClick={() => handleUseTemplate(tpl)}
                  className="h-[185px] w-[140px] rounded border border-border/50 bg-background cursor-pointer flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:border-primary/40 group-hover:shadow-md group-hover:-translate-y-1 shadow-none"
                >
                  <div className="absolute inset-x-0 inset-y-0 p-4 pt-6 flex flex-col gap-2.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="w-[85%] h-[6px] bg-primary/30 rounded-full" />
                    <div className="w-[40%] h-[6px] bg-primary/30 rounded-full" />
                    <div className="w-full h-[6px] bg-muted-foreground/20 rounded-full mt-2" />
                    <div className="w-full h-[6px] bg-muted-foreground/20 rounded-full" />
                    <div className="w-[90%] h-[6px] bg-muted-foreground/20 rounded-full" />
                    <div className="w-full h-[6px] bg-muted-foreground/20 rounded-full" />
                    <div className="w-[85%] h-[6px] bg-muted-foreground/20 rounded-full" />
                    <div className="w-[70%] h-[6px] bg-muted-foreground/20 rounded-full mt-2" />
                  </div>
                </Card>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground tracking-tight">
                    {tpl.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tpl.description}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* User templates section */}
          {userTemplates.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                  Mes modèles
                </h3>
              </div>
              <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-2 snap-x smooth-scroll no-scrollbar">
                {userTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex flex-col gap-3 group shrink-0 snap-start"
                  >
                    <Card
                      onClick={() => handleUseTemplate(tpl)}
                      className="h-[140px] w-[140px] rounded border border-dashed border-border/60 bg-background cursor-pointer flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:border-primary/40 group-hover:shadow-md group-hover:-translate-y-1"
                    >
                      <div className="absolute inset-x-0 inset-y-0 p-3 pt-4 flex flex-col gap-2 opacity-50 group-hover:opacity-80 transition-opacity">
                        <div className="w-[70%] h-[5px] bg-violet-400/30 rounded-full" />
                        <div className="w-[50%] h-[5px] bg-violet-400/20 rounded-full" />
                        <div className="w-full h-[5px] bg-muted-foreground/15 rounded-full mt-1" />
                        <div className="w-[90%] h-[5px] bg-muted-foreground/15 rounded-full" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUserTemplate(tpl.id);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-sm bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </Card>
                    <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                      {tpl.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recent Documents Section */}
      <section className="flex-1 py-8 px-6 md:px-12 w-full max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 gap-4">
          <h2 className="text-lg font-medium text-foreground tracking-tight">
            Documents récents
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>

        <div className="mb-6">
          <TagFilterBar
            activeTag={activeTagFilter}
            onFilterChange={setActiveTagFilter}
          />
        </div>

        {filteredDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            context={searchQuery || activeTagFilter ? "search" : "empty"}
            title={
              searchQuery || activeTagFilter
                ? "Aucun résultat"
                : "Aucun document"
            }
            description={
              searchQuery
                ? `Aucun document ne correspond à "${searchQuery}".`
                : "Créez votre premier document pour commencer."
            }
            actionLabel={!searchQuery ? "Nouveau document" : undefined}
            onAction={!searchQuery ? openCreateModal : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {filteredDocs.map((doc) => (
              <ContextMenu key={doc.id}>
                <ContextMenuTrigger asChild>
                  <Card
                    onClick={() => handleOpenDoc(doc)}
                    className="group cursor-pointer flex flex-col bg-background overflow-hidden border border-border/60 hover:border-muted-foreground/30 hover:shadow-md hover:-translate-y-1 transition-all duration-300 h-[220px]"
                  >
                    {/* Document Preview Area */}
                    <div className="flex-1 bg-muted/20 border-b border-border/50 p-3 pt-6 flex flex-col items-center justify-start overflow-hidden relative">
                      <div className="w-full max-w-[90%] h-[150%] bg-background border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-sm p-4 flex flex-col gap-2 transform origin-top group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden relative">
                        {/* Real Text Preview if loaded */}
                        {previews[doc.id] ? (
                          <div
                            className="text-[6px] leading-[9px] text-muted-foreground/80 break-words font-serif text-justify"
                            style={{
                              WebkitLineClamp: 15,
                              WebkitBoxOrient: "vertical",
                              display: "-webkit-box",
                            }}
                          >
                            {previews[doc.id]}
                          </div>
                        ) : (
                          /* Fallback Skeleton */
                          <>
                            <div className="w-[85%] h-[4px] bg-muted-foreground/30 rounded" />
                            <div className="w-[40%] h-[4px] bg-muted-foreground/30 rounded" />
                            <div className="w-full h-[4px] bg-muted-foreground/10 rounded mt-2" />
                            <div className="w-full h-[4px] bg-muted-foreground/10 rounded" />
                            <div className="w-[90%] h-[4px] bg-muted-foreground/10 rounded" />
                            <div className="w-full h-[4px] bg-muted-foreground/10 rounded" />
                            <div className="w-[85%] h-[4px] bg-muted-foreground/10 rounded" />
                          </>
                        )}
                        {/* CSS Fade gradient at the bottom so it naturally fades out like a paper document preview */}
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
                      </div>
                    </div>
                    {/* Footer Info */}
                    <div className="p-3 bg-card shrink-0 flex flex-col justify-center min-h-[72px]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="bg-blue-500/10 p-1.5 rounded-sm shrink-0">
                            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-sm font-medium truncate text-foreground/90 group-hover:text-primary transition-colors">
                            {doc.name}
                          </span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuItem
                              onClick={() => {
                                setRenameValue(doc.name);
                                setRenameTarget(doc);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Renommer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTargetId(doc.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2 pl-8 mb-1">
                        <span className="text-[11px] font-medium text-muted-foreground/70 truncate uppercase tracking-wider">
                          Ouvert le{" "}
                          {new Date(doc.updated_at).toLocaleDateString(
                            "fr-FR",
                            { day: "numeric", month: "short" },
                          )}
                        </span>
                      </div>
                      <div className="pl-8">
                        <DocumentTags
                          documentId={doc.id}
                          compact
                          onFilterByTag={setActiveTagFilter}
                        />
                      </div>
                    </div>
                  </Card>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => handleOpenDoc(doc)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-2" /> Ouvrir
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setRenameValue(doc.name);
                      setRenameTarget(doc);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Renommer
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      const targetId = doc.target_id || doc.id;
                      const url = `${window.location.origin}/docs/editor?id=${targetId}&name=${encodeURIComponent(doc.name)}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Lien copié dans le presse-papiers");
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5 mr-2" /> Copier le lien
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      const targetId = doc.target_id || doc.id;
                      const url = `${window.location.origin}/docs/editor?id=${targetId}&name=${encodeURIComponent(doc.name)}`;
                      const text = `📄 ${doc.name}\n${url}`;
                      navigator.clipboard.writeText(text);
                      toast.success("Prêt pour partage social");
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5 mr-2" /> Partager sur Social
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => setDeleteTargetId(doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}
      </section>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(v) => !v && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le document sera supprimé
              définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(v) => !v && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Renommer le document</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rename-name">Nouveau titre</Label>
                <Input
                  id="rename-name"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRenameTarget(null)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={!renameValue.trim()}>
                Renommer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateNew}>
            <DialogHeader>
              <DialogTitle>Créer un document</DialogTitle>
              <DialogDescription>
                Donnez un nom à votre nouveau document.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Titre du document</Label>
                <Input
                  id="name"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="Document sans titre"
                  autoFocus
                  className="col-span-3 transition-colors focus-visible:ring-primary/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isCreating || !newDocName.trim()}
                className="px-6 relative overflow-hidden group"
              >
                {isCreating ? (
                  <SpinnerInfinity
                    size={24}
                    secondaryColor="rgba(128,128,128,0.2)"
                    color="currentColor"
                    speed={120}
                    className="mr-2 h-4 w-4 "
                  />
                ) : (
                  <div className="absolute inset-0 bg-card/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                )}
                <span className="relative">Créer</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
