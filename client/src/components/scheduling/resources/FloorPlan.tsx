/**
 * Floor Plan View Component
 *
 * Interactive 2D floor plan with SVG showing resource locations,
 * real-time availability status, zoom/pan support, and filtering.
 */

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Filter,
  Users,
  Monitor,
  Wifi,
  Video,
  Coffee,
  X,
} from 'lucide-react';
import type {
  FloorPlanData,
  FloorPlanResource,
  FloorPlanViewState,
  Resource,
  Booking,
  DateRange,
} from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface FloorPlanProps {
  floorPlan: FloorPlanData;
  resources: Resource[];
  bookings: Booking[];
  currentTime?: Date;
  selectedResourceId?: string;
  onResourceSelect?: (resourceId: string | null) => void;
  onResourceBook?: (resourceId: string, slot: DateRange) => void;
  className?: string;
}

interface ResourceStatus {
  available: boolean;
  currentBooking?: Booking;
  nextAvailable?: Date;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

const STATUS_COLORS = {
  available: {
    fill: 'fill-green-100 dark:fill-green-900/30',
    stroke: 'stroke-green-500',
    bg: 'bg-green-500',
  },
  occupied: {
    fill: 'fill-red-100 dark:fill-red-900/30',
    stroke: 'stroke-red-500',
    bg: 'bg-red-500',
  },
  soon: {
    fill: 'fill-yellow-100 dark:fill-yellow-900/30',
    stroke: 'stroke-yellow-500',
    bg: 'bg-yellow-500',
  },
  selected: {
    fill: 'fill-primary/20',
    stroke: 'stroke-primary',
    bg: 'bg-primary',
  },
};

const AMENITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'visioconference': Video,
  'videoconference': Video,
  'wifi': Wifi,
  'display': Monitor,
  'ecran': Monitor,
  'cafe': Coffee,
  'coffee': Coffee,
};

// ============================================================================
// Main Component
// ============================================================================

export function FloorPlan({
  floorPlan,
  resources,
  bookings,
  currentTime = new Date(),
  selectedResourceId,
  onResourceSelect,
  onResourceBook,
  className,
}: FloorPlanProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // View state
  const [viewState, setViewState] = React.useState<FloorPlanViewState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedResourceId,
  });

  // Interaction state
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [hoveredResourceId, setHoveredResourceId] = React.useState<string | null>(null);

  // Filters
  const [capacityFilter, setCapacityFilter] = React.useState<string>('all');
  const [amenityFilter, setAmenityFilter] = React.useState<string[]>([]);
  const [showAvailableOnly, setShowAvailableOnly] = React.useState(false);

  // Sync selected resource
  React.useEffect(() => {
    setViewState((prev) => ({ ...prev, selectedResourceId }));
  }, [selectedResourceId]);

  // Get resource status
  const getResourceStatus = React.useCallback(
    (resourceId: string): ResourceStatus => {
      const now = currentTime;
      const resourceBookings = bookings.filter((b) => b.resourceId === resourceId);

      const currentBooking = resourceBookings.find(
        (b) => b.start <= now && b.end && b.end > now
      );

      if (currentBooking) {
        // Find next available time
        const sortedBookings = resourceBookings
          .filter((b) => b.end && b.end > now)
          .sort((a, b) => a.start.getTime() - b.start.getTime());

        let nextAvailable = currentBooking.end;
        for (const booking of sortedBookings) {
          if (nextAvailable && booking.start <= nextAvailable && booking.end) {
            nextAvailable = booking.end;
          } else {
            break;
          }
        }

        return {
          available: false,
          currentBooking,
          nextAvailable,
        };
      }

      return { available: true };
    },
    [bookings, currentTime]
  );

  // Filter resources
  const filteredResources = React.useMemo(() => {
    return floorPlan.resources.filter((fpResource) => {
      const resource = resources.find((r) => r.id === fpResource.resourceId);
      if (!resource) return false;

      // Capacity filter
      if (capacityFilter !== 'all') {
        const minCapacity = parseInt(capacityFilter, 10);
        if (!resource.capacity || resource.capacity < minCapacity) return false;
      }

      // Amenity filter
      if (amenityFilter.length > 0) {
        const hasAllAmenities = amenityFilter.every((a) =>
          resource.amenities?.some((ra) => ra.toLowerCase().includes(a.toLowerCase()))
        );
        if (!hasAllAmenities) return false;
      }

      // Availability filter
      if (showAvailableOnly) {
        const status = getResourceStatus(resource.id);
        if (!status.available) return false;
      }

      return true;
    });
  }, [floorPlan.resources, resources, capacityFilter, amenityFilter, showAvailableOnly, getResourceStatus]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewState.panX, y: e.clientY - viewState.panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setViewState((prev) => ({
      ...prev,
      panX: e.clientX - dragStart.x,
      panY: e.clientY - dragStart.y,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom + delta)),
    }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      handleZoom(e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
    }
  };

  const resetView = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: 1,
      panX: 0,
      panY: 0,
    }));
  };

  // Resource click handler
  const handleResourceClick = (fpResource: FloorPlanResource) => {
    onResourceSelect?.(
      viewState.selectedResourceId === fpResource.resourceId
        ? null
        : fpResource.resourceId
    );
  };

  // Get all unique amenities
  const allAmenities = React.useMemo(() => {
    const amenities = new Set<string>();
    resources.forEach((r) => {
      r.amenities?.forEach((a) => amenities.add(a.toLowerCase()));
    });
    return Array.from(amenities);
  }, [resources]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Floor selector */}
          <Badge variant="outline" className="font-medium">
            {floorPlan.name}
          </Badge>

          {/* Capacity filter */}
          <Select value={capacityFilter} onValueChange={setCapacityFilter}>
            <SelectTrigger className="w-[140px] h-8">
              <Users className="h-4 w-4 mr-2 opacity-50" />
              <SelectValue placeholder="Capacit\u00e9" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="2">2+ personnes</SelectItem>
              <SelectItem value="4">4+ personnes</SelectItem>
              <SelectItem value="8">8+ personnes</SelectItem>
              <SelectItem value="12">12+ personnes</SelectItem>
            </SelectContent>
          </Select>

          {/* Amenity filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={amenityFilter.length > 0 ? 'secondary' : 'outline'}
                size="sm"
                className="h-8"
              >
                <Filter className="h-4 w-4 mr-2" />
                \u00c9quipements
                {amenityFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {amenityFilter.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60" align="start">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">\u00c9quipements</h4>
                <div className="flex flex-wrap gap-2">
                  {allAmenities.map((amenity) => {
                    const isSelected = amenityFilter.includes(amenity);
                    const Icon = AMENITY_ICONS[amenity] || Monitor;
                    return (
                      <Button
                        key={amenity}
                        variant={isSelected ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setAmenityFilter((prev) =>
                            isSelected
                              ? prev.filter((a) => a !== amenity)
                              : [...prev, amenity]
                          );
                        }}
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {amenity}
                      </Button>
                    );
                  })}
                </div>
                {amenityFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => setAmenityFilter([])}
                  >
                    Effacer les filtres
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Available only toggle */}
          <Button
            variant={showAvailableOnly ? 'secondary' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setShowAvailableOnly(!showAvailableOnly)}
          >
            Disponibles uniquement
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleZoom(-ZOOM_STEP)}
                  disabled={viewState.zoom <= MIN_ZOOM}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>D\u00e9zoomer</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(viewState.zoom * 100)}%
          </span>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleZoom(ZOOM_STEP)}
                  disabled={viewState.zoom >= MAX_ZOOM}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoomer</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={resetView}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>R\u00e9initialiser la vue</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Floor Plan Canvas */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-hidden relative bg-muted/20',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${floorPlan.width} ${floorPlan.height}`}
          className="w-full h-full"
          style={{
            transform: `scale(${viewState.zoom}) translate(${viewState.panX / viewState.zoom}px, ${viewState.panY / viewState.zoom}px)`,
            transformOrigin: 'center',
          }}
        >
          {/* Background grid */}
          <defs>
            <pattern
              id="floor-grid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted-foreground/20"
              />
            </pattern>
          </defs>
          {/* Background grid pattern (only if no SVG map) */}
          {!floorPlan.svgContent && (
            <rect
              width={floorPlan.width}
              height={floorPlan.height}
              fill="url(#floor-grid)"
            />
          )}

          {/* User uploaded Blueprint Map */}
          {floorPlan.svgContent && (
            <image
              href={
                floorPlan.svgContent.startsWith('<svg') 
                  ? `data:image/svg+xml;utf8,${encodeURIComponent(floorPlan.svgContent)}` 
                  : floorPlan.svgContent
              }
              width={floorPlan.width}
              height={floorPlan.height}
              className="opacity-95 dark:opacity-80 transition-opacity pointer-events-none"
              preserveAspectRatio="xMidYMid meet"
            />
          )}

          {/* Fallback Building outline */}
          {!floorPlan.svgContent && (
            <rect
              x={20}
              y={20}
              width={floorPlan.width - 40}
              height={floorPlan.height - 40}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-border"
              rx={8}
            />
          )}

          {/* Resources */}
          {filteredResources.map((fpResource) => {
            const resource = resources.find((r) => r.id === fpResource.resourceId);
            if (!resource) return null;

            const status = getResourceStatus(fpResource.resourceId);
            const isSelected = viewState.selectedResourceId === fpResource.resourceId;
            const isHovered = hoveredResourceId === fpResource.resourceId;

            // Determine color based on status
            let colorSet = status.available ? STATUS_COLORS.available : STATUS_COLORS.occupied;
            if (isSelected) colorSet = STATUS_COLORS.selected;

            // Check if becoming available soon (within 30 minutes)
            if (!status.available && status.nextAvailable) {
              const minutesUntilAvailable =
                (status.nextAvailable.getTime() - currentTime.getTime()) / 60000;
              if (minutesUntilAvailable <= 30) {
                colorSet = STATUS_COLORS.soon;
              }
            }

            return (
              <g
                key={fpResource.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleResourceClick(fpResource);
                }}
                onMouseEnter={() => setHoveredResourceId(fpResource.resourceId)}
                onMouseLeave={() => setHoveredResourceId(null)}
                className="cursor-pointer"
              >
                {/* Native Browser Tooltip */}
                <title>
                  {fpResource.name}
                  {resource.capacity ? ` (${resource.capacity} pers.)` : ''} - 
                  {status.available ? ' Disponible' : ' Occupé'}
                </title>

                {/* Room shape */}
                <rect
                  x={fpResource.bounds.x}
                  y={fpResource.bounds.y}
                  width={fpResource.bounds.width}
                  height={fpResource.bounds.height}
                  rx={4}
                  className={cn(
                    colorSet.fill,
                    colorSet.stroke,
                    'stroke-2 transition-all duration-200',
                    isHovered && 'stroke-[3]',
                    isSelected && 'stroke-[3]'
                  )}
                />

                {/* Room label */}
                <text
                  x={fpResource.bounds.x + fpResource.bounds.width / 2}
                  y={fpResource.bounds.y + fpResource.bounds.height / 2 - 8}
                  textAnchor="middle"
                  className="fill-foreground text-sm font-medium pointer-events-none"
                >
                  {fpResource.name}
                </text>

                {/* Capacity */}
                {resource.capacity && (
                  <text
                    x={fpResource.bounds.x + fpResource.bounds.width / 2}
                    y={fpResource.bounds.y + fpResource.bounds.height / 2 + 12}
                    textAnchor="middle"
                    className="fill-muted-foreground text-xs pointer-events-none"
                  >
                    {resource.capacity} pers.
                  </text>
                )}

                {/* Status indicator dot */}
                <circle
                  cx={fpResource.bounds.x + fpResource.bounds.width - 8}
                  cy={fpResource.bounds.y + 8}
                  r={6}
                  className={cn(
                    colorSet.stroke,
                    'fill-background stroke-2',
                    status.available
                      ? 'fill-green-500'
                      : status.nextAvailable &&
                          (status.nextAvailable.getTime() - currentTime.getTime()) / 60000 <= 30
                        ? 'fill-yellow-500'
                        : 'fill-red-500'
                  )}
                />
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex items-center gap-4 p-2 rounded-lg bg-background/80 backdrop-blur-sm border text-xs">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded-full', STATUS_COLORS.available.bg)} />
            <span>Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded-full', STATUS_COLORS.soon.bg)} />
            <span>Bient\u00f4t libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded-full', STATUS_COLORS.occupied.bg)} />
            <span>Occup\u00e9</span>
          </div>
        </div>

        {/* Drag hint */}
        {!isDragging && viewState.zoom === 1 && viewState.panX === 0 && viewState.panY === 0 && (
          <div className="absolute top-4 right-4 flex items-center gap-2 p-2 rounded-lg bg-muted/80 backdrop-blur-sm text-xs text-muted-foreground">
            <Move className="h-4 w-4" />
            <span>Glisser pour d\u00e9placer</span>
          </div>
        )}
      </div>

      {/* Selected resource detail panel */}
      <AnimatePresence>
        {viewState.selectedResourceId && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-4 right-4 w-80 shadow-2xl rounded-xl overflow-hidden"
          >
            <ResourceDetailPanel
              resourceId={viewState.selectedResourceId}
              resources={resources}
              floorPlanResources={floorPlan.resources}
              status={getResourceStatus(viewState.selectedResourceId)}
              currentTime={currentTime}
              onClose={() => onResourceSelect?.(null)}
              onBook={onResourceBook}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Resource Detail Panel
// ============================================================================

interface ResourceDetailPanelProps {
  resourceId: string;
  resources: Resource[];
  floorPlanResources: FloorPlanResource[];
  status: ResourceStatus;
  currentTime: Date;
  onClose: () => void;
  onBook?: (resourceId: string, slot: DateRange) => void;
}

function ResourceDetailPanel({
  resourceId,
  resources,
  floorPlanResources,
  status,
  currentTime,
  onClose,
  onBook,
}: ResourceDetailPanelProps) {
  const resource = resources.find((r) => r.id === resourceId);
  const fpResource = floorPlanResources.find((fp) => fp.resourceId === resourceId);

  if (!resource || !fpResource) return null;

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="border border-border/50 p-4 bg-background/95 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{fpResource.name}</h3>
          <p className="text-sm text-muted-foreground">
            {resource.location || floorPlanResources[0]?.name}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full bg-muted/50 hover:bg-muted" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        {/* Status */}
        <Badge
          variant={status.available ? 'default' : 'secondary'}
          className={cn(
            status.available
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          )}
        >
          {status.available
            ? 'Disponible'
            : status.currentBooking
              ? `Occup\u00e9 jusqu'\u00e0 ${formatTime(status.currentBooking.end!)}`
              : 'Occup\u00e9'}
        </Badge>

        {/* Capacity */}
        {resource.capacity && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{resource.capacity} personnes</span>
          </div>
        )}
      </div>

      {/* Amenities */}
      {resource.amenities && resource.amenities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {resource.amenities.map((amenity) => {
            const Icon = AMENITY_ICONS[amenity.toLowerCase()] || Monitor;
            return (
              <Badge key={amenity} variant="outline" className="text-xs">
                <Icon className="h-3 w-3 mr-1" />
                {amenity}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Next available */}
      {!status.available && status.nextAvailable && (
        <p className="mt-3 text-sm text-muted-foreground">
          Prochaine disponibilit\u00e9:{' '}
          <span className="font-medium text-foreground">{formatTime(status.nextAvailable)}</span>
        </p>
      )}

      {/* Book button */}
      {status.available && onBook && (
        <Button
          className="mt-4 w-full"
          onClick={() =>
            onBook(resourceId, {
              start: currentTime,
              end: new Date(currentTime.getTime() + 60 * 60 * 1000), // +1h
            })
          }
        >
          R\u00e9server maintenant
        </Button>
      )}
    </div>
  );

}
