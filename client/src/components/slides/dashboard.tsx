'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { driveApi, DriveNode } from '@/lib/api';
import { useEntityStore } from '@/stores/entity-hub-store';
import { Presentation, Plus, MoreVertical, Search, Pencil, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BUILTIN_SLIDE_TEMPLATES, getUserTemplates, deleteUserTemplate, type DocTemplate } from '@/lib/document-templates';
import { DocumentTags, TagFilterBar, getDocumentTags } from '@/components/docs/document-tags';

export default function SlidesDashboard() {
    const router = useRouter();
    const [docs, setDocs] = useState<DriveNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

    // Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Rename/Delete state
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [renameTarget, setRenameTarget] = useState<DriveNode | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Template state
    const [pendingTemplateContent, setPendingTemplateContent] = useState<string | null>(null);
    const [userTemplates, setUserTemplates] = useState<DocTemplate[]>([]);

    const { selectedWorkspaceId } = useEntityStore();

    useEffect(() => {
        setUserTemplates(getUserTemplates().filter(t => t.type === 'presentation'));
    }, []);

    useEffect(() => {
        const fetchDocs = async () => {
            setLoading(true);
            try {
                const nodes = await driveApi.listNodes(null);
                const presentationDocs = nodes.filter(n => 
                    n.node_type === 'presentation' || 
                    (n.mime_type && n.mime_type.includes('powerpoint')) || 
                    (n.mime_type && n.mime_type.includes('presentation')) || 
                    n.name.endsWith('.pptx') ||
                    n.name.endsWith('.signslides')
                );
                presentationDocs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                setDocs(presentationDocs);

            } catch (error) {
                console.error("Failed to fetch presentations", error);
                toast.error("Erreur lors du chargement des présentations");
            } finally {
                setLoading(false);
            }
        };

        fetchDocs();
    }, [selectedWorkspaceId]);

    const handleDelete = async () => {
        if (!deleteTargetId) return;
        const id = deleteTargetId;
        setDeleteTargetId(null);
        try {
            await driveApi.deleteNode(id);
            setDocs(prev => prev.filter(d => d.id !== id));
            toast.success('Présentation supprimée');
        } catch (error) {
            console.error('Impossible de supprimer presentation', error);
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleRename = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!renameTarget || !renameValue.trim()) return;
        const target = renameTarget;
        setRenameTarget(null);
        try {
            await driveApi.updateNode(target.id, { name: renameValue.trim() });
            setDocs(prev => prev.map(d => d.id === target.id ? { ...d, name: renameValue.trim() } : d));
            toast.success('Présentation renommée');
        } catch (error) {
            console.error('Failed to rename presentation', error);
            toast.error('Erreur lors du renommage');
        }
    };

    const handleCreateNew = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newDocName.trim()) return;

        setIsCreating(true);
        try {
            const targetId = crypto.randomUUID();
            const newNode = await driveApi.createNode({
                name: newDocName.trim(),
                node_type: 'presentation',
                parent_id: null,
                target_id: targetId,
            });
            const finalTargetId = newNode.target_id || newNode.id;
            const contentToStore = pendingTemplateContent;
            if (contentToStore) {
                localStorage.setItem(`slide-template:${finalTargetId}`, contentToStore);
            }
            setIsCreateOpen(false);
            setPendingTemplateContent(null);
            router.push(`/slides/editor?id=${finalTargetId}&name=${encodeURIComponent(newNode.name)}`);
        } catch (error: any) {
            console.error("Impossible de créer presentation", error);
            toast.error(error.response?.data?.message || "Erreur serveur lors de la cr\u00e9ation");
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
        setUserTemplates(getUserTemplates().filter(t => t.type === 'presentation'));
        toast.success('Mod\u00e8le supprim\u00e9');
    };

    const filteredDocs = docs.filter(d => {
        const matchesSearch = !searchQuery.trim() || d.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = !activeTagFilter || getDocumentTags(d.id).includes(activeTagFilter);
        return matchesSearch && matchesTag;
    });

    const handleOpenDoc = (node: DriveNode) => {
        const targetId = node.target_id || node.id;
        router.push(`/slides/editor?id=${targetId}&name=${encodeURIComponent(node.name)}`);
    };

    const openCreateModal = () => {
        setNewDocName('');
        setIsCreateOpen(true);
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 h-full bg-background/50 backdrop-blur-sm">
                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-yellow-600 mb-4" />
                <p className="text-muted-foreground animate-pulse">Chargement de vos présentations...</p>
            </div>
        );
    }

    const builtinTemplates = BUILTIN_SLIDE_TEMPLATES;

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto w-full">
            {/* Template Ribbon Section */}
            <section className="bg-muted/30 py-8 px-6 md:px-12 w-full border-b border-border/40 shrink-0">
                <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-foreground tracking-tight">Cr\u00e9er une pr\u00e9sentation</h2>
                    </div>

                    <div className="flex gap-4 sm:gap-6 overflow-x-auto pt-2 pb-4 snap-x smooth-scroll no-scrollbar -mt-2">
                        {/* Blank presentation */}
                        <div className="flex flex-col gap-3 group shrink-0 snap-start">
                            <Card
                                onClick={openCreateModal}
                                className="h-[185px] w-[220px] rounded border border-border/50 bg-background cursor-pointer flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:border-muted-foreground/30 group-hover:shadow-md group-hover:-translate-y-1 shadow-sm"
                            >
                                <div className="rounded-full bg-yellow-500/10 p-4 transition-transform group-hover:scale-105 duration-300">
                                    <Plus className="w-10 h-10 text-yellow-600" strokeWidth={2.5} />
                                </div>
                            </Card>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-foreground tracking-tight">Pr\u00e9sentation vierge</span>
                            </div>
                        </div>

                        {/* Built-in templates */}
                        {builtinTemplates.map(tpl => (
                            <div key={tpl.id} className="flex flex-col gap-3 group shrink-0 snap-start">
                                <Card
                                    onClick={() => handleUseTemplate(tpl)}
                                    className="h-[185px] w-[220px] rounded border border-border/50 bg-background cursor-pointer flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:border-yellow-500/40 group-hover:shadow-md group-hover:-translate-y-1 shadow-none"
                                >
                                    <div className="absolute inset-x-0 inset-y-0 p-4 pt-6 flex flex-col gap-2.5 opacity-60 group-hover:opacity-100 transition-opacity justify-center items-center">
                                        <div className="w-[80%] h-[40%] bg-yellow-500/20 rounded-sm mb-2" />
                                        <div className="w-[60%] h-[6px] bg-yellow-500/30 rounded-full" />
                                        <div className="w-[40%] h-[6px] bg-yellow-500/20 rounded-full" />
                                    </div>
                                </Card>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-foreground tracking-tight">{tpl.title}</span>
                                    <span className="text-xs text-muted-foreground">{tpl.description}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* User templates */}
                    {userTemplates.length > 0 && (
                        <div className="mt-2">
                            <div className="flex items-center gap-2 mb-3">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-medium text-muted-foreground">Mes mod\u00e8les</h3>
                            </div>
                            <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-2 snap-x smooth-scroll no-scrollbar">
                                {userTemplates.map(tpl => (
                                    <div key={tpl.id} className="flex flex-col gap-3 group shrink-0 snap-start">
                                        <Card
                                            onClick={() => handleUseTemplate(tpl)}
                                            className="h-[120px] w-[180px] rounded border border-dashed border-border/60 bg-background cursor-pointer flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:border-yellow-500/40 group-hover:shadow-md group-hover:-translate-y-1"
                                        >
                                            <div className="absolute inset-x-0 inset-y-0 p-3 pt-4 flex flex-col gap-2 items-center justify-center opacity-50 group-hover:opacity-80 transition-opacity">
                                                <div className="w-[60%] h-[30%] bg-yellow-400/20 rounded-sm" />
                                                <div className="w-[40%] h-[5px] bg-yellow-400/30 rounded-full" />
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteUserTemplate(tpl.id); }}
                                                className="absolute top-1 right-1 p-1 rounded-sm bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                                            >
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                            </button>
                                        </Card>
                                        <span className="text-xs font-medium text-foreground truncate max-w-[180px]">{tpl.title}</span>
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
                    <h2 className="text-lg font-medium text-foreground tracking-tight">Présentations récentes</h2>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                    </div>
                </div>

                <div className="mb-6">
                    <TagFilterBar activeTag={activeTagFilter} onFilterChange={setActiveTagFilter} />
                </div>

                {filteredDocs.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl bg-transparent">
                        <Presentation className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium text-muted-foreground">
                          {searchQuery || activeTagFilter ? 'Aucune présentation trouvée' : 'Créez votre première présentation'}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground/70">
                          {searchQuery || activeTagFilter ? 'Essayez un autre terme de recherche' : 'Cliquez sur "Présentation vierge" ci-dessus pour commencer'}
                        </p>
                        {!searchQuery && !activeTagFilter && (
                          <Button className="mt-4" onClick={openCreateModal}>
                            <Plus className="mr-2 h-4 w-4" /> Nouvelle présentation
                          </Button>
                        )}
                     </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
                        {filteredDocs.map((doc) => (
                            <Card
                                key={doc.id}
                                onClick={() => handleOpenDoc(doc)}
                                className="group cursor-pointer flex flex-col bg-background overflow-hidden border border-border/60 hover:border-muted-foreground/30 hover:shadow-md hover:-translate-y-1 transition-all duration-300 h-[200px]"
                            >
                                {/* Document Preview Area */}
                                <div className="flex-1 bg-muted/20 border-b border-border/50 p-3 flex flex-col items-center justify-center overflow-hidden relative">
                                    <div className="w-full h-full bg-background border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-sm p-4 flex flex-col items-center justify-center gap-2 transform origin-center group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden relative">
                                        <div className="w-[60%] h-[40%] bg-yellow-500/20 rounded-sm mb-2" />
                                        <div className="w-[40%] h-2 bg-yellow-500/30 rounded-full" />
                                    </div>
                                </div>
                                {/* Footer Info */}
                                <div className="p-3 bg-card h-[72px] shrink-0 flex flex-col justify-center">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="bg-yellow-500/10 p-1.5 rounded-sm shrink-0">
                                                <Presentation className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                            </div>
                                            <span className="text-sm font-medium truncate text-foreground/90 group-hover:text-yellow-600 transition-colors">
                                                {doc.name}
                                            </span>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenuItem onClick={() => { setRenameValue(doc.name); setRenameTarget(doc); }}>
                                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Renommer
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTargetId(doc.id)}>
                                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex items-center gap-2 pl-8">
                                        <span className="text-[11px] font-medium text-muted-foreground/70 truncate uppercase tracking-wider">
                                            Ouvert le {new Date(doc.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTargetId} onOpenChange={(v) => !v && setDeleteTargetId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette présentation ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. La présentation sera supprimée définitivement.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rename Dialog */}
            <Dialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleRename}>
                        <DialogHeader>
                            <DialogTitle>Renommer la présentation</DialogTitle>
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
                            <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>Annuler</Button>
                            <Button type="submit" disabled={!renameValue.trim()} className="bg-yellow-600 hover:bg-yellow-700 text-white">Renommer</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleCreateNew}>
                        <DialogHeader>
                            <DialogTitle>Créer une présentation</DialogTitle>
                            <DialogDescription>
                                Donnez un nom à votre nouvelle présentation.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Titre de la présentation</Label>
                                <Input
                                    id="name"
                                    value={newDocName}
                                    onChange={(e) => setNewDocName(e.target.value)}
                                    placeholder="Présentation sans titre"
                                    autoFocus
                                    className="col-span-3 transition-colors focus-visible:ring-yellow-500/50"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isCreating || !newDocName.trim()} className="px-6 relative overflow-hidden group bg-yellow-600 hover:bg-yellow-700 text-white">
                                {isCreating ? (
                                    <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />
                                ) : (
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
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
