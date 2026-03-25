'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTableSkeleton, CardGridSkeleton } from '@/components/ui/skeleton-loader';
import { DriveSidebar } from '@/components/storage/drive-sidebar';
import { driveApi, DriveNode } from '@/lib/api';
import { storageApi } from '@/lib/api/storage';
import { Folder, FileText, UploadCloud, ChevronRight, Home, Users, Search, MoreVertical, Plus, List as ListIcon, LayoutGrid, Download, Trash, FileSpreadsheet, Presentation } from "lucide-react";
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShareDialog } from '@/components/drive/ShareDialog';
import { RenameSheet } from '@/components/storage/rename-sheet';
import { EntityContextMenu } from '@/components/context-menu';

export default function GlobalDrivePage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<DriveNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<DriveNode | null>(null);
  const [path, setPath] = useState<DriveNode[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [shareNode, setShareNode] = useState<DriveNode | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const [renameNode, setRenameNode] = useState<DriveNode | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  const filteredNodes = searchQuery.trim()
    ? nodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : nodes;

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await driveApi.listNodes(currentFolder?.id || null);
      setNodes(data);
    } catch (e) {
      console.debug(e);
      toast.error('Erreur lors du chargement du Drive');
    } finally {
      setLoading(false);
    }
  }, [currentFolder]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const navigateToFolder = (node: DriveNode) => {
    setCurrentFolder(node);
    setPath([...path, node]);
  };

  const handleDownload = async (node: DriveNode, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const data = await storageApi.download('drive', node.name);
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', node.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Téléchargement de "${node.name}" initié.`);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Erreur lors du téléchargement du fichier.');
    }
  };

  const handleNavigate = (node: DriveNode) => {
    if (node.node_type === 'folder') {
      navigateToFolder(node);
    } else if (
      node.node_type === 'document' || 
      node.mime_type?.includes('word') || 
      node.mime_type?.includes('document') ||
      node.name.endsWith('.docx')
    ) {
      const targetId = node.target_id || node.id;
      router.push(`/docs/editor?id=${targetId}&name=${encodeURIComponent(node.name)}`);
    } else if (
      node.node_type === 'spreadsheet' || 
      node.mime_type?.includes('spreadsheet') || 
      node.mime_type?.includes('excel') ||
      node.name.endsWith('.xlsx') ||
      node.name.endsWith('.csv')
    ) {
      const targetId = node.target_id || node.id;
      router.push(`/sheets?id=${targetId}&name=${encodeURIComponent(node.name)}`);
    } else {
      toast.info('Aperçu non encore implémenté pour ce fichier');
    }
  };

  const handleNodeDoubleClick = (node: DriveNode) => {
    if (node.node_type === 'folder') {
      navigateToFolder(node);
      return;
    }

    if (node.node_type === 'file' || node.node_type === 'document') {
      const name = node.name.toLowerCase();
      // Route to correct editor based on extension
      if (name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.md')) {
        router.push(`/docs/editor?id=${node.target_id}`);
      } else if (name.endsWith('.xlsx') || name.endsWith('.csv')) {
        router.push(`/sheets?id=${node.target_id}`);
      } else if (name.endsWith('.pptx') || name.endsWith('.json')) { // Handling internal json slides fallback
        router.push(`/slides?id=${node.target_id}`);
      } else {
        // Fallback: download the file
        handleDownload(node);
      }
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentFolder(null);
      setPath([]);
    } else {
      const newPath = path.slice(0, index + 1);
      setCurrentFolder(newPath[newPath.length - 1]);
      setPath(newPath);
    }
  };

  const handleCreateFolder = async () => {
    const name = window.prompt('Nom du nouveau dossier :');
    if (!name?.trim()) return;

    try {
      await driveApi.createNode({
        parent_id: currentFolder?.id || null,
        name,
        node_type: 'folder',
        target_id: null
      });
      toast.success('Dossier créé avec succès');
      fetchNodes();
    } catch {
      toast.error('Erreur lors de la création du dossier');
    }
  };

  const handleCreateDocument = async () => {
    const name = window.prompt('Nom du nouveau document :') || 'Document sans titre';
    try {
      const newNode = await driveApi.createNode({
        parent_id: currentFolder?.id || null,
        name,
        node_type: 'document',
        target_id: null // Le backend ou l'éditeur initialisera le vrai documentId plus tard
      });
      toast.success('Document créé ! Redirection...');
      // Le backend aura inséré un target_id ou repris l'id du node
      const targetId = newNode.target_id || newNode.id;
      router.push(`/docs/editor?id=${targetId}`);
    } catch {
      toast.error('Erreur lors de la création du document');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet élément ?')) return;
    try {
      await driveApi.deleteNode(id);
      toast.success('Élément envoyé à la corbeille');
      fetchNodes();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameNode) return;
    try {
      // Use driveApi to update node name
      await driveApi.updateNode(renameNode.id, { name: newName });
      toast.success(`Renommé en "${newName}"`);
      fetchNodes();
    } catch {
      toast.error('Erreur lors du renommage');
      throw new Error('Rename failed');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Prevent flickering when hovering over children
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    handleFileUploads(files);
  };

  const handleFileUploads = async (files: File[]) => {
    setUploading(true);
    let successCount = 0;
    
    // Toaster loading placeholder
    const toastId = toast.loading(`Import de ${files.length} fichier(s)...`);

    for (const file of files) {
      try {
        // 1. Upload to storage
        const uploadRes = await storageApi.uploadFile('drive', file);
        if (uploadRes.data && uploadRes.data.length > 0) {
          const target = uploadRes.data[0];
          
          // 2. Insert into Drive VFS
          await driveApi.createNode({
            parent_id: currentFolder?.id || null,
            name: target.key,
            node_type: 'file',
            target_id: target.id, // Use the generated UUID returned by storage
            size: target.size,
            mime_type: target.content_type
          });
          
          successCount++;
        }
      } catch (err) {
        console.error('Erreur upload:', err);
        toast.error(`Erreur pour ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} fichier(s) importé(s)`, { id: toastId });
      fetchNodes();
    } else {
      toast.dismiss(toastId);
    }
    
    setUploading(false);
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] -m-4 overflow-hidden bg-background dark:bg-[#1a1a1a]">
        
        {/* Sidebar */}
        <div className="w-full md:w-[256px] flex flex-col h-full bg-background dark:bg-[#1a1a1a] pb-4 gap-2 border-r border-[#dadce0] dark:border-[#3c4043]">
          <div className="px-4 py-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="w-full md:w-auto h-14 px-4 rounded-2xl bg-background hover:bg-[#f8f9fa] shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] dark:bg-[#1a1a1a] dark:hover:bg-[#303134] dark:shadow-[0_1px_2px_0_rgba(0,0,0,0.6),0_1px_3px_1px_rgba(0,0,0,0.3)] transition-all flex items-center justify-start gap-3 text-[#3c4043] dark:text-[#e8eaed]"
                >
                  <Plus className="h-6 w-6 text-blue-500" />
                  <span className="font-medium text-[14px]">Nouveau</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 mt-2">
                <DropdownMenuItem onClick={handleCreateFolder} className="gap-3 py-2">
                  <Folder className="h-4 w-4 text-blue-500 fill-blue-100" />
                  Nouveau dossier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCreateDocument} className="gap-3 py-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Document texte
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto w-full px-2">
            <Button variant="ghost" className="w-full justify-start gap-3 font-medium bg-[#e8f0fe] text-[#1967d2] dark:bg-[#3c4043] dark:text-[#e8eaed] rounded-r-full">
              <Home className="h-5 w-5" /> Mon Drive
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 font-medium text-[#3c4043] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] rounded-r-full">
              <Users className="h-5 w-5" /> Partagés avec moi
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div 
          className="flex-1 flex flex-col min-w-0 bg-background dark:bg-[#202124] rounded-tl-2xl overflow-hidden shadow-sm border-t md:border-t-0 md:border-l border-[#e3e3e3] dark:border-[#3c4043] relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500 flex flex-col items-center justify-center rounded-tl-2xl">
              <div className="bg-background dark:bg-[#202124] p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
                <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Déposer les fichiers ici</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Ils seront ajoutés à {currentFolder ? <span className="font-medium text-blue-600">"{currentFolder.name}"</span> : "Mon Drive"}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Header & Breadcrumb */}
          <div className="h-16 border-b border-[#dadce0] dark:border-[#3c4043] flex items-center justify-between px-6 shrink-0 bg-background dark:bg-[#202124]">
            <div className="flex items-center text-[18px] text-[#202124] dark:text-[#e8eaed]">
              <button onClick={() => handleBreadcrumbClick(-1)} className="hover:bg-muted p-1.5 rounded-md transition-colors font-medium">
                Mon Drive
              </button>
              {path.map((folder, idx) => (
                <div key={folder.id} className="flex items-center text-[#5f6368] dark:text-[#9aa0a6]">
                  <ChevronRight className="h-5 w-5 mx-1" />
                  <button onClick={() => handleBreadcrumbClick(idx)} className="hover:bg-muted p-1.5 rounded-md transition-colors text-[#202124] dark:text-[#e8eaed] font-medium">
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 h-9 text-sm rounded-full border border-[#dadce0] dark:border-[#3c4043] bg-[#f1f3f4] dark:bg-[#303134] focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 transition-all focus:w-64"
                />
              </div>
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')}>
                <ListIcon className="h-5 w-5" />
              </Button>
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('grid')}>
                <LayoutGrid className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Files / Folders List */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <DataTableSkeleton count={4} />
            ) : filteredNodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <Folder className="h-16 w-16 mb-4" />
                <p>{searchQuery.trim() ? 'Aucun résultat pour cette recherche.' : 'Ce dossier est vide ou glissez-y vos fichiers.'}</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="rounded-xl border shadow-sm bg-card overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-medium">Nom</th>
                      <th className="px-6 py-3 font-medium w-32">Propriétaire</th>
                      <th className="px-6 py-3 font-medium w-32">Dernière modif.</th>
                      <th className="px-6 py-3 font-medium w-24 text-right">Taille</th>
                      <th className="px-6 py-3 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredNodes.map(node => (
                      <tr 
                        key={node.id} 
                        className="hover:bg-accent hover:text-accent-foreground transition-colors group cursor-pointer"
                        onDoubleClick={() => handleNodeDoubleClick(node)}
                      >
                        <td className="px-6 py-4 flex items-center gap-3">
                          {node.node_type === 'folder' ? <Folder className="h-5 w-5 text-blue-500 fill-blue-100 dark:fill-blue-900" /> : <FileText className="h-5 w-5 text-blue-600" />}
                          <span className="font-medium truncate max-w-[300px]">{node.name}</span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">Moi</td>
                        <td className="px-6 py-4 text-muted-foreground">{new Date(node.updated_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-muted-foreground text-right">{node.size ? `${(node.size / 1024).toFixed(1)} KB` : '--'}</td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleNavigate(node)}>Ouvrir</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setRenameNode(node); setRenameOpen(true); }}>Renommer</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setShareNode(node); setShareOpen(true); }}>Partager</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => handleDownload(node, e)} className="gap-2 focus:bg-[#f1f3f4] dark:focus:bg-[#3c4043] cursor-pointer">
                                <Download className="h-4 w-4 text-[#5f6368] dark:text-[#9aa0a6]" />
                                <span className="text-[#3c4043] dark:text-[#e8eaed]">Télécharger</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(node.id)}>Supprimer</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredNodes.map(node => (
                  <EntityContextMenu
                    key={node.id}
                    actions={[
                      { label: 'Ouvrir', onClick: () => handleNavigate(node) },
                      { label: 'Renommer', onClick: () => { setRenameNode(node); setRenameOpen(true); } },
                      { label: 'Partager', onClick: () => { setShareNode(node); setShareOpen(true); } },
                      { label: 'Télécharger', onClick: () => handleDownload(node) },
                      { label: 'Supprimer', onClick: () => handleDelete(node.id), destructive: true },
                    ]}
                  >
                  <div
                    className="group border rounded-xl p-4 flex flex-col items-center gap-3 hover:bg-accent hover:shadow-md transition-all cursor-pointer bg-card relative"
                    onDoubleClick={() => handleNodeDoubleClick(node)}
                  >
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/5 hover:bg-black/10 dark:bg-background/10 dark:hover:bg-background/20 rounded-full">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleNavigate(node)}>Ouvrir</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setShareNode(node); setShareOpen(true); }}>Partager</DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleDownload(node, e)} className="gap-2 focus:bg-[#f1f3f4] dark:focus:bg-[#3c4043] cursor-pointer">
                            <Download className="h-4 w-4 text-[#5f6368] dark:text-[#9aa0a6]" />
                            <span className="text-[#3c4043] dark:text-[#e8eaed]">Télécharger</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(node.id)}>Supprimer</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {node.node_type === 'folder' ? (
                      <Folder className="h-16 w-16 text-blue-500 fill-blue-100 dark:fill-blue-900" />
                    ) : node.name.toLowerCase().endsWith('.xlsx') || node.name.toLowerCase().endsWith('.csv') ? (
                      <FileSpreadsheet className="h-16 w-16 text-green-500" />
                    ) : node.name.toLowerCase().endsWith('.pptx') ? (
                      <Presentation className="h-16 w-16 text-yellow-500" />
                    ) : (
                      <FileText className="h-16 w-16 text-blue-600" />
                    )}
                    <span className="font-medium text-sm text-center truncate w-full">{node.name}</span>
                  </div>
                  </EntityContextMenu>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} node={shareNode} />
      <RenameSheet
        open={renameOpen}
        onOpenChange={setRenameOpen}
        item={renameNode ? { key: renameNode.id, name: renameNode.name, type: renameNode.node_type as 'folder' | 'file' } : null}
        onRename={handleRename}
      />
    </AppLayout>
  );
}
