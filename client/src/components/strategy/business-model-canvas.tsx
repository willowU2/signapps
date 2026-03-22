"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasBlock {
  id: string;
  key: string;
  label: string;
  icon: string;
  content: string;
}

const INITIAL_BLOCKS: CanvasBlock[] = [
  {
    id: "1",
    key: "partners",
    label: "Partenaires clés",
    icon: "🤝",
    content: "",
  },
  {
    id: "2",
    key: "activities",
    label: "Activités clés",
    icon: "⚙️",
    content: "",
  },
  {
    id: "3",
    key: "resources",
    label: "Ressources clés",
    icon: "💎",
    content: "",
  },
  {
    id: "4",
    key: "value",
    label: "Proposition de valeur",
    icon: "⭐",
    content: "",
  },
  {
    id: "5",
    key: "relations",
    label: "Relations clients",
    icon: "💬",
    content: "",
  },
  {
    id: "6",
    key: "channels",
    label: "Canaux de distribution",
    icon: "📢",
    content: "",
  },
  {
    id: "7",
    key: "segments",
    label: "Segments clients",
    icon: "👥",
    content: "",
  },
  {
    id: "8",
    key: "costs",
    label: "Structure de coûts",
    icon: "💰",
    content: "",
  },
  {
    id: "9",
    key: "revenue",
    label: "Flux de revenus",
    icon: "💵",
    content: "",
  },
];

export function BusinessModelCanvas() {
  const [blocks, setBlocks] = useState<CanvasBlock[]>(INITIAL_BLOCKS);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleUpdateBlock = (blockId: string, content: string) => {
    setBlocks(
      blocks.map((block) =>
        block.id === blockId ? { ...block, content } : block
      )
    );
  };

  const handleStartEdit = (blockId: string) => {
    setEditingId(blockId);
  };

  const handleStopEdit = () => {
    setEditingId(null);
  };

  const getBlockPosition = (index: number) => {
    const positions = [
      "col-span-2 row-span-2", // partners (top-left, 2x2)
      "col-span-2 row-span-2", // activities (top-middle, 2x2)
      "col-span-2 row-span-2", // resources (top-right, 2x2)
      "col-span-2 row-span-3", // value (middle-center, 2x3)
      "col-span-2 row-span-2", // relations (middle-right, 2x2)
      "col-span-2 row-span-2", // channels (middle-right-lower, 2x2)
      "col-span-2 row-span-2", // segments (bottom-right, 2x2)
      "col-span-2 row-span-2", // costs (bottom-left, 2x2)
      "col-span-2 row-span-2", // revenue (bottom-middle, 2x2)
    ];
    return positions[index] || "";
  };

  return (
    <div className="w-full space-y-4 p-4 border border-border/50 rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Tableau de Modèle Commercial</h2>
      </div>

      {/* Canvas Grid - Simplified 2D Layout */}
      <div className="grid grid-cols-4 gap-2 auto-rows-max">
        {/* Top Row */}
        <CanvasBlockComponent
          block={blocks[0]}
          isEditing={editingId === blocks[0].id}
          onEdit={() => handleStartEdit(blocks[0].id)}
          onStopEdit={handleStopEdit}
          onUpdate={(content) => handleUpdateBlock(blocks[0].id, content)}
        />

        <CanvasBlockComponent
          block={blocks[1]}
          isEditing={editingId === blocks[1].id}
          onEdit={() => handleStartEdit(blocks[1].id)}
          onStopEdit={handleStopEdit}
          onUpdate={(content) => handleUpdateBlock(blocks[1].id, content)}
        />

        <CanvasBlockComponent
          block={blocks[2]}
          isEditing={editingId === blocks[2].id}
          onEdit={() => handleStartEdit(blocks[2].id)}
          onStopEdit={handleStopEdit}
          onUpdate={(content) => handleUpdateBlock(blocks[2].id, content)}
        />

        {/* Middle Center - Value Proposition (spans 2 rows) */}
        <div className="col-span-4 row-span-2">
          <CanvasBlockComponent
            block={blocks[3]}
            isEditing={editingId === blocks[3].id}
            onEdit={() => handleStartEdit(blocks[3].id)}
            onStopEdit={handleStopEdit}
            onUpdate={(content) => handleUpdateBlock(blocks[3].id, content)}
            size="lg"
          />
        </div>

        {/* Relations */}
        <CanvasBlockComponent
          block={blocks[4]}
          isEditing={editingId === blocks[4].id}
          onEdit={() => handleStartEdit(blocks[4].id)}
          onStopEdit={handleStopEdit}
          onUpdate={(content) => handleUpdateBlock(blocks[4].id, content)}
        />

        {/* Channels */}
        <CanvasBlockComponent
          block={blocks[5]}
          isEditing={editingId === blocks[5].id}
          onEdit={() => handleStartEdit(blocks[5].id)}
          onStopEdit={handleStopEdit}
          onUpdate={(content) => handleUpdateBlock(blocks[5].id, content)}
        />

        {/* Segments */}
        <CanvasBlockComponent
          block={blocks[6]}
          isEditing={editingId === blocks[6].id}
          onEdit={() => handleStartEdit(blocks[6].id)}
          onStopEdit={handleStopEdit}
          onUpdate={(content) => handleUpdateBlock(blocks[6].id, content)}
        />

        {/* Bottom Row */}
        <CanvasBlockComponent
          block={blocks[7]}
          isEditing={editingId === blocks[7].id}
          onEdit={() => handleStartEdit(blocks[7].id)}
          onStopEdit={handleStopEdit}
          onUpdate={(content) => handleUpdateBlock(blocks[7].id, content)}
        />

        <CanvasBlockComponent
          block={blocks[8]}
          isEditing={editingId === blocks[8].id}
          onEdit={() => handleStartEdit(blocks[8].id)}
          onStopEdit={handleStopEdit}
          onUpdate={(content) => handleUpdateBlock(blocks[8].id, content)}
        />
      </div>

      {/* Info */}
      <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
        <p>Cliquez sur chaque bloc pour éditer le contenu</p>
      </div>
    </div>
  );
}

interface BlockProps {
  block: CanvasBlock;
  isEditing: boolean;
  onEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (content: string) => void;
  size?: "sm" | "lg";
}

function CanvasBlockComponent({
  block,
  isEditing,
  onEdit,
  onStopEdit,
  onUpdate,
  size = "sm",
}: BlockProps) {
  return (
    <div
      className={cn(
        "border border-border/50 rounded-lg bg-muted/30 p-3 cursor-pointer transition-all hover:bg-muted/50",
        size === "lg" ? "col-span-4 min-h-24" : "min-h-32"
      )}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-lg">{block.icon}</p>
          <h3 className="font-semibold text-xs text-primary">{block.label}</h3>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={block.content}
            onChange={(e) => onUpdate(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={onStopEdit}
            placeholder="Entrez le contenu..."
            autoFocus
            className="w-full h-20 p-2 text-xs border border-border rounded bg-background focus:ring-1 focus:ring-ring focus:border-ring outline-none"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onStopEdit();
            }}
            className="w-full h-7 text-xs"
          >
            Terminer
          </Button>
        </div>
      ) : (
        <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">
          {block.content || (
            <span className="text-muted-foreground italic">
              Cliquer pour ajouter du contenu...
            </span>
          )}
        </p>
      )}
    </div>
  );
}
