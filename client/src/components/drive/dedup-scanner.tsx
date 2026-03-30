'use client';

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { driveApi, DriveNode } from '@/lib/api';
import { ScanSearch, Trash2, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DuplicateGroup {
  key: string;
  nodes: DriveNode[];
  toDelete: Set<string>;
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

function detectDuplicates(nodes: DriveNode[]): DuplicateGroup[] {
  const map = new Map<string, DriveNode[]>();

  for (const node of nodes) {
    if (node.node_type === 'folder') continue;
    // Group by: sha256_hash if available, else name+size
    const key = `${node.name}__${node.size ?? 0}`;
    const existing = map.get(key) ?? [];
    map.set(key, [...existing, node]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, group] of map.entries()) {
    if (group.length > 1) {
      // Default: keep the oldest (first created), mark rest for deletion
      const sorted = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const toDelete = new Set<string>(sorted.slice(1).map(n => n.id));
      groups.push({ key, nodes: sorted, toDelete });
    }
  }

  return groups;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DedupScanner() {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [deleting, setDeleting] = useState(false);


  const handleScan = async () => {
    setScanning(true);
    // Force-fetch fresh data
    const nodes = await queryClient.fetchQuery<DriveNode[]>({
      queryKey: ['drive-nodes', null],
      queryFn: () => driveApi.listNodes(null),
    });
    await new Promise(r => setTimeout(r, 600)); // UX: show scanning animation
    const detected = detectDuplicates(nodes);
    setGroups(detected);
    setScanned(true);
    setScanning(false);
    if (detected.length === 0) {
      toast.success('Aucun doublon détecté !');
    } else {
      toast.info(`${detected.length} groupe(s) de doublons détectés`);
    }
  };

  const toggleDelete = (groupKey: string, nodeId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.key !== groupKey) return g;
      const newSet = new Set(g.toDelete);
      if (newSet.has(nodeId)) newSet.delete(nodeId);
      else newSet.add(nodeId);
      return { ...g, toDelete: newSet };
    }));
  };

  const totalToDelete = useMemo(() =>
    groups.reduce((acc, g) => acc + g.toDelete.size, 0),
  [groups]);

  const handleDeleteSelected = async () => {
    if (totalToDelete === 0) return;
    setDeleting(true);
    const toastId = toast.loading(`Suppression de ${totalToDelete} doublon(s)…`);
    let success = 0;
    for (const group of groups) {
      for (const id of group.toDelete) {
        try {
          await driveApi.deleteNode(id);
          success++;
        } catch {
          toast.error(`Erreur suppression ${id}`);
        }
      }
    }
    toast.success(`${success} doublon(s) supprimé(s)`, { id: toastId });
    // Re-scan
    setScanned(false);
    setGroups([]);
    queryClient.invalidateQueries({ queryKey: ['drive-nodes'] });
    setDeleting(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Détection de doublons</span>
          {scanned && (
            <Badge variant={groups.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
              {groups.length > 0 ? `${groups.length} groupe(s)` : 'Aucun doublon'}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleScan}
          disabled={scanning || deleting}
        >
          {scanning ? (
            <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Scan en cours…</>
          ) : (
            <><ScanSearch className="h-3.5 w-3.5 mr-2" />Scanner les doublons</>
          )}
        </Button>
      </div>

      {/* Results */}
      {scanned && groups.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 py-3">
          <CheckCircle2 className="h-4 w-4" />
          Votre Drive est propre — aucun doublon trouvé.
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.key} className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground truncate">
                  {group.nodes[0].name}
                </span>
                <Badge variant="secondary" className="text-xs ml-auto shrink-0">{group.nodes.length} copies</Badge>
              </div>
              <div className="divide-y">
                {group.nodes.map((node, i) => (
                  <div key={node.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Checkbox
                      checked={group.toDelete.has(node.id)}
                      onCheckedChange={() => toggleDelete(group.key, node.id)}
                      id={`dedup-${node.id}`}
                    />
                    <label htmlFor={`dedup-${node.id}`} className="flex-1 min-w-0 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="text-sm truncate">{node.name}</span>
                        {i === 0 && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 border-green-300 text-green-700">
                            Original
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(node.created_at).toLocaleDateString('fr-FR')}
                        {node.size ? ` · ${(node.size / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">{totalToDelete} fichier(s) sélectionné(s) pour suppression</p>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={totalToDelete === 0 || deleting}
            >
              {deleting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Suppression…</>
              ) : (
                <><Trash2 className="h-3.5 w-3.5 mr-2" />Supprimer les doublons</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Hint text before first scan */}
      {!scanned && !scanning && (
        <p className="text-xs text-muted-foreground">
          Analyse les fichiers du Drive par nom et taille pour détecter les copies en double.
        </p>
      )}
    </div>
  );
}

