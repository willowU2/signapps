'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { driveApi, DriveNode } from '@/lib/api';
import { fetchAndParseDocument } from '@/lib/file-parsers';
import { useEntityStore } from '@/stores/entity-hub-store';
import { FileText, Plus, MoreVertical, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DocsDashboard() {
    const router = useRouter();
    const [docs, setDocs] = useState<DriveNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [previews, setPreviews] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const { selectedWorkspaceId } = useEntityStore();

    useEffect(() => {
        const fetchDocs = async () => {
            setLoading(true);
            try {
                const nodes = await driveApi.listNodes(null);
                const textDocs = nodes.filter(n => 
                    n.node_type === 'document' || 
                    (n.mime_type && n.mime_type.includes('word')) || 
                    n.name.endsWith('.docx')
                );
                textDocs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                setDocs(textDocs);

                // Fetch previews lazily for the first few documents
                textDocs.slice(0, 15).forEach(async (doc) => {
                    try {
                        let parsed: any;
                        const targetKey = `${doc.target_id || doc.id}.html`;
                        try {
                            parsed = await fetchAndParseDocument('drive', targetKey, targetKey);
                        } catch (err) {
                            // Fallback to older format or manually uploaded files
                            parsed = await fetchAndParseDocument('drive', doc.name, doc.name);
                        }
                        
                        if (parsed && (parsed.text || parsed.html)) {
                            // Nettoyer les balises HTML rudimentaires pour la preview
                            const rawText = (parsed.text || parsed.html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                            if (rawText) {
                                setPreviews(prev => ({ ...prev, [doc.id]: rawText.substring(0, 300) }));
                            }
                        }
                    } catch (e) {
                        // Silently ignore if no document content found on server yet
                    }
                });

            } catch (error) {
                console.error("Failed to fetch documents", error);
                toast.error("Erreur lors du chargement des documents");
            } finally {
                setLoading(false);
            }
        };

        fetchDocs();
    }, [selectedWorkspaceId]);

    const handleCreateNew = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newDocName.trim()) return;

        setIsCreating(true);
        try {
            const newNode = await driveApi.createNode({
                name: newDocName.trim(),
                node_type: 'document',
                parent_id: null,
                target_id: crypto.randomUUID(),
            });
            const targetId = newNode.target_id || newNode.id;
            setIsCreateOpen(false);
            router.push(`/docs/editor?id=${targetId}&name=${encodeURIComponent(newNode.name)}`);
        } catch (error: any) {
            console.error("Failed to create document", error);
            toast.error(error.response?.data?.message || "Erreur serveur lors de la création du document");
            setIsCreating(false);
        }
    };

    const filteredDocs = docs.filter(d => !searchQuery.trim() || d.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleOpenDoc = (node: DriveNode) => {
        const targetId = node.target_id || node.id;
        router.push(`/docs/editor?id=${targetId}&name=${encodeURIComponent(node.name)}`);
    };

    const openCreateModal = () => {
        setNewDocName('');
        setIsCreateOpen(true);
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 h-full bg-background/50 backdrop-blur-sm">
                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-primary mb-4" />
                <p className="text-muted-foreground animate-pulse">Chargement de vos documents...</p>
            </div>
        );
    }

    const templates = [
        { id: 'blank', title: 'Document vierge', isAdd: true },
        { id: 'cv1', title: 'Mon CV', desc: 'Serif' },
        { id: 'cv2', title: 'CV', desc: 'Corail' },
        { id: 'letter', title: 'Lettre', desc: 'Vert menthe' },
        { id: 'proposal', title: 'Proposition de projet', desc: 'Tropiques' },
        { id: 'brochure', title: 'Brochure', desc: 'Géométrique' },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto w-full">
            {/* Template Ribbon Section */}
            <section className="bg-muted/30 py-8 px-6 md:px-12 w-full border-b border-border/40 shrink-0">
                <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-foreground tracking-tight">Créer un document</h2>
                        <span className="text-sm font-medium text-muted-foreground hover:bg-muted/50 px-3 py-1.5 rounded cursor-pointer transition-colors hidden sm:block">
                            Galerie de modèles
                        </span>
                    </div>
                    
                    <div className="flex gap-4 sm:gap-6 overflow-x-auto pt-2 pb-4 snap-x smooth-scroll no-scrollbar -mt-2">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="flex flex-col gap-3 group shrink-0 snap-start">
                                <Card 
                                    onClick={tpl.isAdd ? openCreateModal : () => toast.info('Modèle à venir !')}
                                    className={`h-[185px] w-[140px] rounded border border-border/50 bg-background cursor-pointer flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:border-muted-foreground/30 group-hover:shadow-md group-hover:-translate-y-1 ${tpl.isAdd ? 'shadow-sm' : 'shadow-none'}`}
                                >
                                    {tpl.isAdd ? (
                                        <div className="rounded-full bg-primary/10 p-4 transition-transform group-hover:scale-105 duration-300">
                                            <Plus className="w-10 h-10 text-primary" strokeWidth={2.5} />
                                        </div>
                                    ) : (
                                        <div className="absolute inset-x-0 inset-y-0 p-4 pt-6 flex flex-col gap-2.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <div className="w-[85%] h-[6px] bg-muted-foreground/30 rounded-full" />
                                            <div className="w-[40%] h-[6px] bg-muted-foreground/30 rounded-full" />
                                            <div className="w-full h-[6px] bg-muted-foreground/20 rounded-full mt-2" />
                                            <div className="w-full h-[6px] bg-muted-foreground/20 rounded-full" />
                                            <div className="w-[90%] h-[6px] bg-muted-foreground/20 rounded-full" />
                                            <div className="w-full h-[6px] bg-muted-foreground/20 rounded-full" />
                                            <div className="w-[85%] h-[6px] bg-muted-foreground/20 rounded-full" />
                                            <div className="w-[70%] h-[6px] bg-muted-foreground/20 rounded-full mt-2" />
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

            {/* Recent Documents Section */}
            <section className="flex-1 py-8 px-6 md:px-12 w-full max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8 gap-4">
                    <h2 className="text-lg font-medium text-foreground tracking-tight">Documents récents</h2>
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
                
                {filteredDocs.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl bg-transparent">
                        <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium text-muted-foreground">Aucun document récent</h3>
                     </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
                        {filteredDocs.map((doc) => (
                            <Card 
                                key={doc.id}
                                onClick={() => handleOpenDoc(doc)}
                                className="group cursor-pointer flex flex-col bg-background overflow-hidden border border-border/60 hover:border-muted-foreground/30 hover:shadow-md hover:-translate-y-1 transition-all duration-300 h-[220px]"
                            >
                                {/* Document Preview Area */}
                                <div className="flex-1 bg-muted/20 border-b border-border/50 p-3 pt-6 flex flex-col items-center justify-start overflow-hidden relative">
                                    <div className="w-full max-w-[90%] h-[150%] bg-background border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-sm p-4 flex flex-col gap-2 transform origin-top group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden relative">
                                        {/* Real Text Preview if loaded */}
                                        {previews[doc.id] ? (
                                            <div className="text-[6px] leading-[9px] text-muted-foreground/80 break-words font-serif text-justify" style={{ WebkitLineClamp: 15, WebkitBoxOrient: 'vertical', display: '-webkit-box' }}>
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
                                <div className="p-3 bg-card h-[72px] shrink-0 flex flex-col justify-center">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="bg-blue-500/10 p-1.5 rounded-sm shrink-0">
                                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <span className="text-sm font-medium truncate text-foreground/90 group-hover:text-primary transition-colors">
                                                {doc.name}
                                            </span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                        </Button>
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
                            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isCreating || !newDocName.trim()} className="px-6 relative overflow-hidden group">
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
