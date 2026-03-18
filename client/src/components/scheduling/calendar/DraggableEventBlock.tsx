'use client';

/**
 * DraggableEventBlock Component
 *
 * Wraps EventBlock with drag & drop functionality.
 * Supports moving events and resizing from top/bottom edges.
 */

import * as React from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSchedulingSelection } from '@/stores/scheduling-store';
import type { ScheduleBlock, EventLayout } from '@/lib/scheduling/types/scheduling';
import type { DragState } from '@/lib/scheduling/hooks/use-event-drag';

// ============================================================================
// Types
// ============================================================================

interface DraggableEventBlockProps {
  layout: EventLayout;
  className?: string;
  dragState?: DragState | null;
  previewLayout?: { top: number; height: number } | null;
  onClick?: (event: ScheduleBlock) => void;
  onDoubleClick?: (event: ScheduleBlock) => void;
  onDragStart?: (
    event: ScheduleBlock,
    type: 'move' | 'resize-top' | 'resize-bottom',
    e: React.MouseEvent | React.TouchEvent
  ) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getEventColor(event: ScheduleBlock): { bg: string; border: string; text: string } {
  const color = event.color || '#3b82f6';
  return {
    bg: `${color}15`,
    border: color,
    text: color,
  };
}

type DisplayMode = 'full' | 'compact' | 'minimal' | 'dot';

function getDisplayMode(height: number): DisplayMode {
  if (height < 20) return 'dot';
  if (height < 32) return 'minimal';
  if (height < 56) return 'compact';
  return 'full';
}

// ============================================================================
// Resize Handle Component
// ============================================================================

function ResizeHandle({
  position,
  onMouseDown,
  onTouchStart,
}: {
  position: 'top' | 'bottom';
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}) {
  return (
    <div
      className={cn(
        'absolute left-0 right-0 h-2 cursor-ns-resize opacity-0 hover:opacity-100',
        'group-hover:opacity-50 transition-opacity',
        'flex items-center justify-center',
        position === 'top' ? '-top-1' : '-bottom-1'
      )}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div className="w-8 h-1 bg-white/50 rounded-full" />
    </div>
  );
}

// ============================================================================
// Event Content Components
// ============================================================================

function EventTitle({ title, className }: { title: string; className?: string }) {
  return <span className={cn('font-medium truncate', className)}>{title}</span>;
}

function EventTime({ start, end, className }: { start: Date; end?: Date; className?: string }) {
  const startStr = format(start, 'HH:mm', { locale: fr });
  const endStr = end ? format(end, 'HH:mm', { locale: fr }) : null;
  return (
    <span className={cn('text-muted-foreground', className)}>
      {startStr}
      {endStr && ` - ${endStr}`}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DraggableEventBlock({
  layout,
  className,
  dragState,
  previewLayout,
  onClick,
  onDoubleClick,
  onDragStart,
}: DraggableEventBlockProps) {
  const { selectedBlockId, selectBlock } = useSchedulingSelection();
  const { block: event, top, height, left, width } = layout;

  const colors = getEventColor(event);
  const isSelected = selectedBlockId === event.id;
  const isCancelled = event.status === 'cancelled';
  const isDragging = dragState?.isDragging && dragState.eventId === event.id;

  // Use preview layout when dragging
  const displayTop = isDragging && previewLayout ? previewLayout.top : top;
  const displayHeight = isDragging && previewLayout ? previewLayout.height : height;
  const displayMode = getDisplayMode(displayHeight);

  // Event handlers
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    e.stopPropagation();
    selectBlock(event.id);
    onClick?.(event);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    e.stopPropagation();
    onDoubleClick?.(event);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    onDragStart?.(event, 'move', e);
  };

  const handleResizeTopStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onDragStart?.(event, 'resize-top', e);
  };

  const handleResizeBottomStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onDragStart?.(event, 'resize-bottom', e);
  };

  return (
    <motion.div
      layout={!isDragging}
      initial={false}
      animate={{
        top: displayTop,
        height: displayHeight,
        opacity: isDragging ? 0.8 : 1,
        scale: isDragging ? 1.02 : 1,
        zIndex: isDragging ? 100 : isSelected ? 20 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 30,
        mass: 0.5,
      }}
      className={cn(
        'group absolute cursor-grab overflow-hidden rounded-md',
        'transition-shadow duration-150',
        'hover:shadow-md hover:z-10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isSelected && !isDragging && 'ring-2 ring-primary ring-offset-1',
        isDragging && 'cursor-grabbing shadow-xl',
        isCancelled && 'opacity-50',
        className
      )}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      tabIndex={0}
      role="button"
      aria-label={`${event.title} - ${format(event.start, 'EEEE d MMMM à HH:mm', { locale: fr })}`}
      aria-selected={isSelected}
    >
      {/* Top Resize Handle */}
      {displayHeight > 40 && (
        <ResizeHandle
          position="top"
          onMouseDown={handleResizeTopStart}
          onTouchStart={handleResizeTopStart}
        />
      )}

      {/* Event Content */}
      <div
        className={cn(
          'h-full p-1.5',
          displayMode === 'dot' && 'flex items-center justify-center p-0',
          isCancelled && 'line-through'
        )}
        style={{ color: colors.text }}
      >
        {displayMode === 'dot' && (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: colors.border }}
            title={event.title}
          />
        )}

        {displayMode === 'minimal' && (
          <div className="flex items-center gap-1 overflow-hidden">
            <EventTitle title={event.title} className="text-xs" />
          </div>
        )}

        {displayMode === 'compact' && (
          <div className="flex flex-col overflow-hidden">
            <EventTitle title={event.title} className="text-xs" />
            <EventTime start={event.start} end={event.end} className="text-[10px]" />
          </div>
        )}

        {displayMode === 'full' && (
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <div className="flex items-center gap-1">
              <GripVertical className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 cursor-grab" />
              <EventTitle title={event.title} className="text-xs" />
            </div>
            <EventTime start={event.start} end={event.end} className="text-[10px]" />
            {event.metadata?.location && (
              <div className="text-[10px] text-muted-foreground truncate">
                {event.metadata.location as string}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Resize Handle */}
      {displayHeight > 40 && (
        <ResizeHandle
          position="bottom"
          onMouseDown={handleResizeBottomStart}
          onTouchStart={handleResizeBottomStart}
        />
      )}

      {/* Drag Preview Overlay */}
      {isDragging && previewLayout && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-md pointer-events-none" />
      )}
    </motion.div>
  );
}

export default DraggableEventBlock;
