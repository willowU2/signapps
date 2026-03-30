'use client';

/**
 * ResourceCard Component
 *
 * Displays a resource with its availability and quick booking action.
 */

import * as React from 'react';
import {
  Building2,
  Monitor,
  Car,
  Box,
  Users,
  MapPin,
  Check,
  X,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Resource } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface ResourceCardProps {
  resource: Resource;
  isAvailable?: boolean;
  nextAvailable?: Date;
  onBook?: (resource: Resource) => void;
  onViewSchedule?: (resource: Resource) => void;
  className?: string;
}

// ============================================================================
// Resource Type Icons
// ============================================================================

const resourceTypeIcons: Record<Resource['type'], React.ElementType> = {
  room: Building2,
  equipment: Monitor,
  vehicle: Car,
  other: Box,
};

const resourceTypeLabels: Record<Resource['type'], string> = {
  room: 'Salle',
  equipment: 'Équipement',
  vehicle: 'Véhicule',
  other: 'Autre',
};

// ============================================================================
// Main Component
// ============================================================================

export function ResourceCard({
  resource,
  isAvailable = true,
  nextAvailable,
  onBook,
  onViewSchedule,
  className,
}: ResourceCardProps) {
  const Icon = resourceTypeIcons[resource.type];

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Availability Indicator */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-1',
          isAvailable ? 'bg-green-500' : 'bg-red-500'
        )}
      />

      {/* Image */}
      {resource.imageUrl && (
        <div className="h-32 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resource.imageUrl}
            alt={resource.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{resource.name}</CardTitle>
              <CardDescription className="text-xs">
                {resourceTypeLabels[resource.type]}
              </CardDescription>
            </div>
          </div>
          <Badge variant={isAvailable ? 'default' : 'secondary'}>
            {isAvailable ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Disponible
              </>
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                Occupé
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        {resource.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {resource.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {resource.capacity && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {resource.capacity} pers.
            </span>
          )}
          {resource.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {resource.location}
            </span>
          )}
          {resource.floor && (
            <span className="flex items-center gap-1">
              Étage {resource.floor}
            </span>
          )}
        </div>

        {/* Amenities */}
        {resource.amenities && resource.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {resource.amenities.slice(0, 4).map((amenity) => (
              <Badge key={amenity} variant="outline" className="text-xs">
                {amenity}
              </Badge>
            ))}
            {resource.amenities.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{resource.amenities.length - 4}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onViewSchedule?.(resource)}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Planning
        </Button>
        <Button
          size="sm"
          className="flex-1"
          disabled={!isAvailable}
          onClick={() => onBook?.(resource)}
        >
          Réserver
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

export function ResourceCardCompact({
  resource,
  isAvailable = true,
  onBook,
  className,
}: Pick<ResourceCardProps, 'resource' | 'isAvailable' | 'onBook' | 'className'>) {
  const Icon = resourceTypeIcons[resource.type];

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer',
        className
      )}
      onClick={() => onBook?.(resource)}
    >
      <div
        className={cn(
          'p-2 rounded-lg',
          isAvailable ? 'bg-green-100' : 'bg-red-100'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5',
            isAvailable ? 'text-green-600' : 'text-red-600'
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{resource.name}</h4>
        <p className="text-xs text-muted-foreground">
          {resource.location || resourceTypeLabels[resource.type]}
        </p>
      </div>
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          isAvailable ? 'bg-green-500' : 'bg-red-500'
        )}
      />
    </div>
  );
}

export default ResourceCard;
