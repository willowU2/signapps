'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Plus, Trash2, Edit2, Check, X, ZoomIn, ZoomOut } from 'lucide-react';

interface MindNode {
  id: string;
  text: string;
  children: string[];
  parentId: string | null;
  color: string;
  x: number;
  y: number;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const createNode = (text: string, parentId: string | null, x: number, y: number): MindNode => ({
  id: `node-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  text,
  children: [],
  parentId,
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
  x,
  y,
});

const ROOT: MindNode = { id: 'root', text: 'Central Idea', children: [], parentId: null, color: '#6366f1', x: 400, y: 200 };

export function MindMapEditor() {
  const [nodes, setNodes] = useState<Record<string, MindNode>>({ root: ROOT });
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [selected, setSelected] = useState<string | null>('root');
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  const addChild = useCallback((parentId: string) => {
    const parent = nodes[parentId];
    if (!parent) return;
    const angle = (parent.children.length * 60) - 90;
    const rad = (angle * Math.PI) / 180;
    const dist = 160;
    const newNode = createNode('New Idea', parentId, parent.x + Math.cos(rad) * dist, parent.y + Math.sin(rad) * dist);
    setNodes(prev => ({
      ...prev,
      [newNode.id]: newNode,
      [parentId]: { ...prev[parentId], children: [...prev[parentId].children, newNode.id] },
    }));
    setEditing(newNode.id);
    setEditText('New Idea');
  }, [nodes]);

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'root') return;
    const node = nodes[nodeId];
    const deleteRecursive = (id: string, acc: Set<string>) => {
      acc.add(id);
      nodes[id]?.children.forEach(c => deleteRecursive(c, acc));
    };
    const toDelete = new Set<string>();
    deleteRecursive(nodeId, toDelete);

    setNodes(prev => {
      const next = { ...prev };
      toDelete.forEach(id => delete next[id]);
      if (node.parentId) {
        next[node.parentId] = { ...next[node.parentId], children: next[node.parentId].children.filter(c => !toDelete.has(c)) };
      }
      return next;
    });
    if (selected && toDelete.has(selected)) setSelected(null);
  }, [nodes, selected]);

  const saveEdit = useCallback(() => {
    if (!editing) return;
    setNodes(prev => ({ ...prev, [editing]: { ...prev[editing], text: editText } }));
    setEditing(null);
  }, [editing, editText]);

  const startEdit = (nodeId: string) => {
    setEditing(nodeId);
    setEditText(nodes[nodeId].text);
  };

  const renderEdges = () => {
    const edges: React.ReactElement[] = [];
    Object.values(nodes).forEach(node => {
      node.children.forEach(childId => {
        const child = nodes[childId];
        if (child) {
          edges.push(
            <line
              key={`edge-${node.id}-${childId}`}
              x1={node.x} y1={node.y} x2={child.x} y2={child.y}
              stroke={child.color} strokeWidth="2" strokeOpacity="0.6"
            />
          );
        }
      });
    });
    return edges;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-5 w-5 text-primary" />
            Mind Map Editor
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            {selected && selected !== 'root' && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteNode(selected)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {selected && (
              <Button size="sm" onClick={() => addChild(selected)} className="gap-1.5">
                <Plus className="h-4 w-4" />Add Child
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden bg-muted/20" style={{ height: 460 }}>
          <svg ref={svgRef} width="100%" height="100%" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            {renderEdges()}
            {Object.values(nodes).map(node => (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelected(node.id)}
                style={{ cursor: 'pointer' }}
              >
                <rect x="-60" y="-18" width="120" height="36" rx="8"
                  fill={selected === node.id ? node.color : 'white'}
                  stroke={node.color} strokeWidth="2"
                />
                {editing === node.id ? (
                  <foreignObject x="-55" y="-14" width="110" height="28">
                    <input
                      autoFocus
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && setEditing(null)}
                      className="w-full text-xs bg-transparent outline-none text-center"
                    />
                  </foreignObject>
                ) : (
                  <text textAnchor="middle" dominantBaseline="middle" fontSize="12"
                    fill={selected === node.id ? 'white' : '#111'}
                    fontWeight={node.id === 'root' ? 'bold' : 'normal'}
                  >
                    {node.text.slice(0, 16)}
                  </text>
                )}
                {selected === node.id && editing !== node.id && (
                  <circle cx="55" cy="-12" r="8" fill={node.color} onClick={e => { e.stopPropagation(); startEdit(node.id); }}>
                    <title>Edit</title>
                  </circle>
                )}
              </g>
            ))}
          </svg>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Click a node to select, then add children or edit. Click the edit circle to rename.</p>
      </CardContent>
    </Card>
  );
}
