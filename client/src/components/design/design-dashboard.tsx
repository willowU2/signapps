"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDesignStore } from "@/stores/design-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Palette,
  Plus,
  Search,
  MoreVertical,
  Copy,
  Trash2,
  Edit,
  LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DESIGN_FORMATS, type DesignFormat, type DesignTemplate } from "./types";
import DesignTemplateGallery, { TEMPLATES } from "./design-template-gallery";

export default function DesignDashboard() {
  const router = useRouter();
  const { designs, loadDesigns, createDesign, deleteDesign, duplicateDesign, renameDesign, loadDesign } = useDesignStore();

  useEffect(() => {
    loadDesigns();
  }, [loadDesigns]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState("");
  const [renameName, setRenameName] = useState("");
  const [newName, setNewName] = useState("Design sans titre");
  const [selectedFormat, setSelectedFormat] = useState<DesignFormat>(DESIGN_FORMATS[0]);

  const filteredDesigns = designs.filter(
    (d) => !searchQuery.trim() || d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateNew = () => {
    const id = createDesign(newName.trim() || "Design sans titre", selectedFormat);
    setIsCreateOpen(false);
    router.push(`/design/editor?id=${id}`);
  };

  const handleOpenDesign = (id: string) => {
    loadDesign(id);
    router.push(`/design/editor?id=${id}`);
  };

  const handleDuplicate = (id: string) => {
    duplicateDesign(id);
  };

  const handleDelete = (id: string) => {
    deleteDesign(id);
  };

  const handleRenameOpen = (id: string, name: string) => {
    setRenameId(id);
    setRenameName(name);
    setIsRenameOpen(true);
  };

  const handleRenameSubmit = () => {
    if (renameName.trim()) {
      renameDesign(renameId, renameName.trim());
    }
    setIsRenameOpen(false);
  };

  const handleUseTemplate = (template: DesignTemplate) => {
    const id = createDesign(template.name, template.format);
    // Load the template objects into the design
    const store = useDesignStore.getState();
    if (store.currentDesign) {
      const designWithTemplate = {
        ...store.currentDesign,
        pages: template.pages.map((p) => ({
          ...p,
          id: crypto.randomUUID(),
          objects: p.objects.map((o) => ({ ...o, id: crypto.randomUUID() })),
        })),
      };
      if (typeof window !== "undefined") {
        localStorage.setItem(`design-${id}`, JSON.stringify(designWithTemplate));
      }
    }
    setIsTemplateOpen(false);
    router.push(`/design/editor?id=${id}`);
  };

  const formatCategories = [...new Set(DESIGN_FORMATS.map((f) => f.category))];

  // Quick templates for the ribbon
  const quickTemplates = [
    { id: "blank", title: "Blank Design", isAdd: true },
    { id: "template", title: "From Template", isTemplate: true },
    ...DESIGN_FORMATS.slice(0, 5).map((f) => ({
      id: f.id,
      title: f.name,
      desc: `${f.width}x${f.height}`,
      format: f,
    })),
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto w-full">
      {/* Template Ribbon */}
      <section className="bg-muted/30 py-8 px-6 md:px-12 w-full border-b border-border/40 shrink-0">
        <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground tracking-tight">Create a design</h2>
            <button
              onClick={() => setIsTemplateOpen(true)}
              className="text-sm font-medium text-muted-foreground hover:bg-muted/50 px-3 py-1.5 rounded cursor-pointer transition-colors hidden sm:flex items-center gap-1.5"
            >
              <LayoutTemplate className="h-4 w-4" />
              Template gallery
            </button>
          </div>

          <div className="flex gap-4 sm:gap-6 overflow-x-auto pt-2 pb-4 snap-x smooth-scroll no-scrollbar -mt-2">
            {quickTemplates.map((tpl: any) => (
              <div key={tpl.id} className="flex flex-col gap-3 group shrink-0 snap-start">
                <Card
                  onClick={() => {
                    if (tpl.isAdd) {
                      setIsCreateOpen(true);
                    } else if (tpl.isTemplate) {
                      setIsTemplateOpen(true);
                    } else if (tpl.format) {
                      setSelectedFormat(tpl.format);
                      setNewName("Design sans titre");
                      setIsCreateOpen(true);
                    }
                  }}
                  className="h-[185px] w-[220px] rounded border border-border/50 bg-background cursor-pointer flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:border-muted-foreground/30 group-hover:shadow-md group-hover:-translate-y-1 shadow-sm"
                >
                  {tpl.isAdd ? (
                    <div className="rounded-full bg-violet-500/10 p-4 transition-transform group-hover:scale-105 duration-300">
                      <Plus className="w-10 h-10 text-violet-600" strokeWidth={2.5} />
                    </div>
                  ) : tpl.isTemplate ? (
                    <div className="rounded-full bg-amber-500/10 p-4 transition-transform group-hover:scale-105 duration-300">
                      <LayoutTemplate className="w-10 h-10 text-amber-600" strokeWidth={1.5} />
                    </div>
                  ) : (
                    <div className="absolute inset-x-0 inset-y-0 p-4 pt-6 flex flex-col gap-2.5 opacity-60 group-hover:opacity-100 transition-opacity justify-center items-center">
                      <div
                        className="bg-violet-500/20 rounded-sm"
                        style={{
                          width: `${Math.min(160, (tpl.format?.width / tpl.format?.height) * 100)}px`,
                          height: `${Math.min(100, (tpl.format?.height / tpl.format?.width) * 100)}px`,
                        }}
                      />
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {tpl.format?.width} x {tpl.format?.height}
                      </div>
                    </div>
                  )}
                </Card>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground tracking-tight">{tpl.title}</span>
                  {tpl.desc && <span className="text-xs text-muted-foreground">{tpl.desc}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Designs */}
      <section className="flex-1 py-8 px-6 md:px-12 w-full max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 gap-4">
          <h2 className="text-lg font-medium text-foreground tracking-tight">Recent designs</h2>
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

        {filteredDesigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl bg-transparent">
            <Palette className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Aucun design</h3>
            <p className="text-sm text-muted-foreground/60 mt-1">Créez votre premier design pour commencer</p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Créer un design
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {filteredDesigns.map((design) => (
              <Card
                key={design.id}
                onClick={() => handleOpenDesign(design.id)}
                className="group cursor-pointer flex flex-col bg-background overflow-hidden border border-border/60 hover:border-muted-foreground/30 hover:shadow-md hover:-translate-y-1 transition-all duration-300 h-[200px]"
              >
                {/* Preview Area */}
                <div className="flex-1 bg-muted/20 border-b border-border/50 p-3 flex flex-col items-center justify-center overflow-hidden relative">
                  <div className="w-full h-full bg-background border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-sm p-4 flex flex-col items-center justify-center gap-2 transform origin-center group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden relative">
                    <div className="w-[60%] h-[40%] bg-violet-500/20 rounded-sm mb-2" />
                    <div className="w-[40%] h-2 bg-violet-500/30 rounded-full" />
                    <div className="absolute bottom-2 right-2 text-[8px] font-mono text-muted-foreground/50">
                      {design.format.width}x{design.format.height}
                    </div>
                  </div>
                </div>
                {/* Footer */}
                <div className="p-3 bg-card h-[72px] shrink-0 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="bg-violet-500/10 p-1.5 rounded-sm shrink-0">
                        <Palette className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <span className="text-sm font-medium truncate text-foreground/90 group-hover:text-violet-600 transition-colors">
                        {design.name}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleRenameOpen(design.id, design.name)} className="gap-2">
                          <Edit className="h-3.5 w-3.5" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(design.id)} className="gap-2">
                          <Copy className="h-3.5 w-3.5" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(design.id)} className="gap-2 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 pl-8">
                    <span className="text-[11px] font-medium text-muted-foreground/70 truncate uppercase tracking-wider">
                      {design.format.name} - {new Date(design.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleCreateNew(); }}>
            <DialogHeader>
              <DialogTitle>Create a design</DialogTitle>
              <DialogDescription>Choose a name and format for your new design.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Design name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Design sans titre"
                  autoFocus
                  className="transition-colors focus-visible:ring-violet-500/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                {formatCategories.map((cat) => (
                  <div key={cat} className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">{cat}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DESIGN_FORMATS.filter((f) => f.category === cat).map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setSelectedFormat(fmt)}
                          className={cn(
                            "flex flex-col items-start rounded-md border p-2 transition-all text-left",
                            selectedFormat.id === fmt.id
                              ? "border-violet-500 bg-violet-500/5"
                              : "border-border hover:border-muted-foreground/30"
                          )}
                        >
                          <span className="text-xs font-medium truncate w-full">{fmt.name}</span>
                          <span className="text-[10px] text-muted-foreground">{fmt.width} x {fmt.height}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="px-6 bg-violet-600 hover:bg-violet-700 text-white">
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Template Gallery Dialog */}
      <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5" />
              Template Gallery
            </DialogTitle>
            <DialogDescription>Start with a pre-designed template</DialogDescription>
          </DialogHeader>
          <DesignTemplateGallery onUseTemplate={handleUseTemplate} />
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(); }}>
            <DialogHeader>
              <DialogTitle>Rename design</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsRenameOpen(false)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
