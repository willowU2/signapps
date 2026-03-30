'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { driveApi, DriveNode } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Folder, Image, FileText, Clock, Share2, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartFolder {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  filter: (node: DriveNode) => boolean;
}

// ─── Smart folder definitions ─────────────────────────────────────────────────

const SMART_FOLDERS: SmartFolder[] = [
  {
    id: 'images',
    name: 'Images',
    icon: <Image className="h-4 w-4" />,
    color: 'text-pink-600',
    filter: (n) => !!(n.mime_type?.startsWith('image/')),
  },
  {
    id: 'documents',
    name: 'Documents',
    icon: <FileText className="h-4 w-4" />,
    color: 'text-blue-600',
    filter: (n) => {
      const ext = n.name.split('.').pop()?.toLowerCase() ?? '';
      const mime = n.mime_type?.toLowerCase() ?? '';
      return ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx'].includes(ext) ||
        mime.includes('pdf') || mime.includes('word') || mime.includes('spreadsheet');
    },
  },
  {
    id: 'recents',
    name: 'Récents',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-amber-600',
    filter: (n) => {
      const d = new Date(n.updated_at);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      return d >= sevenDaysAgo;
    },
  },
  {
    id: 'shared',
    name: 'Partagés',
    icon: <Share2 className="h-4 w-4" />,
    color: 'text-green-600',
    filter: (n) => !!(n.access_role && n.access_role !== 'owner'),
  },
];

// ─── Smart folder view ────────────────────────────────────────────────────────

interface SmartFolderViewProps {
  folder: SmartFolder;
  nodes: DriveNode[];
  onNodeClick: (node: DriveNode) => void;
  onClose: () => void;
}

function SmartFolderView({ folder, nodes, onNodeClick, onClose }: SmartFolderViewProps) {
  const filtered = nodes.filter(folder.filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={folder.color}>{folder.icon}</span>
          <h3 className="font-semibold text-sm">{folder.name}</h3>
          <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Fermer
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Aucun fichier dans ce dossier intelligent.</p>
      ) : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {filtered.map(node => (
            <button
              key={node.id}
              onClick={() => onNodeClick(node)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40 transition-colors text-left"
            >
              {node.node_type === 'folder'
                ? <Folder className="h-4 w-4 text-blue-500 fill-blue-100 shrink-0" />
                : <FileText className="h-4 w-4 text-blue-600 shrink-0" />}
              <span className="flex-1 truncate font-medium">{node.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(node.updated_at).toLocaleDateString('fr-FR')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface SmartFoldersProps {
  onNodeClick?: (node: DriveNode) => void;
}

export function SmartFolders({ onNodeClick }: SmartFoldersProps) {
  const [activeFolder, setActiveFolder] = useState<SmartFolder | null>(null);

  // Fetch all root nodes to apply filters against
  const { data: nodes = [], isLoading } = useQuery<DriveNode[]>({
    queryKey: ['drive-smart-folders'],
    queryFn: () => driveApi.listNodes(null),
    staleTime: 60_000,
  });

  const handleNodeClick = (node: DriveNode) => {
    onNodeClick?.(node);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Dossiers intelligents
      </p>

      {activeFolder ? (
        isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="h-4 w-4 animate-spin" />Chargement…
          </div>
        ) : (
          <SmartFolderView
            folder={activeFolder}
            nodes={nodes}
            onNodeClick={handleNodeClick}
            onClose={() => setActiveFolder(null)}
          />
        )
      ) : (
        <div className="space-y-1">
          {SMART_FOLDERS.map(sf => {
            const count = nodes.filter(sf.filter).length;
            return (
              <button
                key={sf.id}
                onClick={() => setActiveFolder(sf)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
              >
                <span className={sf.color}>{sf.icon}</span>
                <span className="flex-1 text-sm font-medium">{sf.name}</span>
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <Badge variant="secondary" className="text-xs shrink-0">{count}</Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
