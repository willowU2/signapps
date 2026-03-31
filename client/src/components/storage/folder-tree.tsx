'use client';

import { SpinnerInfinity } from 'spinners-react';
import { useState, useCallback, useEffect } from 'react';
import { FileIcon, FileText, Image as ImageIcon, FileJson, FileArchive, Video, Music } from 'lucide-react';
import { storageApi } from '@/lib/api';
import { 
  Files, 
  FolderItem, 
  FolderTrigger, 
  FolderPanel, 
  SubFiles, 
  FileItem as UIFileItem 
} from '@/components/animate-ui/components/base/files';

interface FolderTreeProps {
  bucket: string;
  currentPath: string;
  onSelectFolder: (path: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file';
}

interface FolderNode {
  name: string;
  path: string;
  type: 'folder';
  children: (FolderNode | FileNode)[];
  loaded: boolean;
  loading: boolean;
}

type TreeNode = FolderNode | FileNode;

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return ImageIcon;
  if (['json'].includes(ext)) return FileJson;
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return FileArchive;
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return Video;
  if (['mp3', 'wav', 'ogg'].includes(ext)) return Music;
  if (['txt', 'md', 'csv'].includes(ext)) return FileText;
  return FileIcon;
}

export function FolderTree({ bucket, currentPath, onSelectFolder }: FolderTreeProps) {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [rootLoaded, setRootLoaded] = useState(false);
  const [rootLoading, setRootLoading] = useState(false);
  // Default open the root folder item out-of-the-box
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['root_bucket']);

  const loadChildren = useCallback(async (prefix: string): Promise<TreeNode[]> => {
    try {
      const response = await storageApi.listFiles(bucket, prefix, '/');
      const prefixes = response.data.prefixes || [];
      const objects = response.data.objects || [];

      const folders: FolderNode[] = prefixes.map((p: string) => ({
        name: p.replace(prefix, '').replace(/\/$/, '') || p,
        path: p,
        type: 'folder',
        children: [],
        loaded: false,
        loading: false,
      }));

      const files: FileNode[] = objects
        .filter((o: any) => !o.key.endsWith('/'))
        .map((o: any) => ({
          name: o.key.split('/').pop() || o.key,
          path: o.key,
          type: 'file'
        }));

      return [...folders, ...files];
    } catch {
      return [];
    }
  }, [bucket]);

  // Load root folders on first render
  const loadRoot = useCallback(async () => {
    if (rootLoaded || rootLoading) return;
    setRootLoading(true);
    const children = await loadChildren('');
    setRoots(children);
    setRootLoaded(true);
    setRootLoading(false);
  }, [rootLoaded, rootLoading, loadChildren]);

  // Auto-load root
  useEffect(() => {
    if (!rootLoaded && !rootLoading) {
      loadRoot();
    }
  }, [rootLoaded, rootLoading, loadRoot]);

  const loadFolder = useCallback(async (path: string) => {
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.type === 'folder') {
          if (node.path === path) {
            if (!node.loaded && !node.loading) {
              node.loading = true;
              loadChildren(path).then(children => {
                setRoots(prev => {
                  const update = (ns: TreeNode[]): TreeNode[] =>
                    ns.map(n => {
                      if (n.type === 'folder' && n.path === path) {
                        return { ...n, children, loaded: true, loading: false };
                      }
                      if (n.type === 'folder') return { ...n, children: update(n.children) };
                      return n;
                    });
                  return update(prev);
                });
              });
              return { ...node, loading: true };
            }
          }
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    setRoots(prev => updateNode(prev));
  }, [loadChildren]);

  const handleOpenChange = (newOpen: string[]) => {
    setExpandedFolders(newOpen);
    // Find newly opened folders and load their children dynamically
    const newlyOpened = newOpen.filter(path => !expandedFolders.includes(path));
    newlyOpened.forEach(path => {
      if (path !== 'root_bucket') {
        loadFolder(path);
      }
    });
  };

  const renderNode = (node: TreeNode) => {
    if (node.type === 'file') {
      return (
        <UIFileItem key={node.path} icon={getFileIcon(node.name)}>
          {node.name}
        </UIFileItem>
      );
    }

    return (
      <FolderItem key={node.path} value={node.path}>
        <FolderTrigger
          onClick={() => onSelectFolder(node.path)}
        >
          <div className="flex items-center gap-2">
            {node.loading && <SpinnerInfinity size={14} className="opacity-50" />}
            <span>{node.name}</span>
          </div>
        </FolderTrigger>
        <FolderPanel>
          <SubFiles>
            {node.children.map(child => renderNode(child))}
          </SubFiles>
        </FolderPanel>
      </FolderItem>
    );
  };

  return (
    <div className="relative w-full rounded-2xl border bg-background overflow-auto min-h-[400px]">
      {rootLoading ? (
        <div className="flex items-center justify-center h-full min-h-[400px] gap-2 p-4 text-muted-foreground text-sm">
          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} />
          <span>Chargement de l'arborescence...</span>
        </div>
      ) : (
        <Files 
          className="w-full" 
          open={expandedFolders} 
          onOpenChange={handleOpenChange}
        >
          <FolderItem value="root_bucket">
             <FolderTrigger onClick={() => onSelectFolder('')}>
               / ({bucket})
             </FolderTrigger>
             <FolderPanel>
                <SubFiles>
                  {roots.map(node => renderNode(node))}
                </SubFiles>
             </FolderPanel>
          </FolderItem>
        </Files>
      )}
    </div>
  );
}
