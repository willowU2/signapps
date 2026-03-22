'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { storageApi } from '@/lib/api';

interface FolderTreeProps {
  bucket: string;
  currentPath: string;
  onSelectFolder: (path: string) => void;
}

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  loaded: boolean;
  loading: boolean;
  expanded: boolean;
}

export function FolderTree({ bucket, currentPath, onSelectFolder }: FolderTreeProps) {
  const [roots, setRoots] = useState<FolderNode[]>([]);
  const [rootLoaded, setRootLoaded] = useState(false);
  const [rootLoading, setRootLoading] = useState(false);

  const loadChildren = useCallback(async (prefix: string): Promise<FolderNode[]> => {
    try {
      const response = await storageApi.listFiles(bucket, prefix, '/');
      const prefixes = response.data.prefixes || [];
      return prefixes.map((p: string) => ({
        name: p.replace(prefix, '').replace(/\/$/, '') || p,
        path: p,
        children: [],
        loaded: false,
        loading: false,
        expanded: false,
      }));
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
  if (!rootLoaded && !rootLoading) {
    loadRoot();
  }

  const toggleFolder = useCallback(async (path: string) => {
    const updateNode = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.map(node => {
        if (node.path === path) {
          if (!node.loaded) {
            // Need to load children
            node.loading = true;
            loadChildren(path).then(children => {
              setRoots(prev => {
                const update = (ns: FolderNode[]): FolderNode[] =>
                  ns.map(n => {
                    if (n.path === path) {
                      return { ...n, children, loaded: true, loading: false, expanded: true };
                    }
                    return { ...n, children: update(n.children) };
                  });
                return update(prev);
              });
            });
            return { ...node, loading: true };
          }
          return { ...node, expanded: !node.expanded };
        }
        return { ...node, children: updateNode(node.children) };
      });
    };
    setRoots(prev => updateNode(prev));
  }, [loadChildren]);

  const renderNode = (node: FolderNode, depth: number = 0) => {
    const isSelected = currentPath === node.path;

    return (
      <div key={node.path}>
        <button
          className={cn(
            'flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-muted transition-colors',
            isSelected && 'bg-primary/10 text-primary font-medium'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            onSelectFolder(node.path);
            toggleFolder(node.path);
          }}
        >
          {node.loading ? (
            <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3.5 w-3.5 shrink-0  text-muted-foreground" />
          ) : node.expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {node.expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-blue-500" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {node.expanded && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      {/* Root item */}
      <button
        className={cn(
          'flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-muted transition-colors',
          currentPath === '' && 'bg-primary/10 text-primary font-medium'
        )}
        onClick={() => onSelectFolder('')}
      >
        <Folder className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="truncate">/</span>
      </button>

      {rootLoading ? (
        <div className="flex items-center gap-2 px-2 py-4 text-muted-foreground text-xs">
          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3 w-3 " />
          Loading...
        </div>
      ) : (
        roots.map(node => renderNode(node, 1))
      )}
    </div>
  );
}
