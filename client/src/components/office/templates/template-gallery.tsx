'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * TemplateGallery
 *
 * Main gallery component for browsing and selecting document templates.
 */

import React, { useEffect, useCallback } from 'react';
import { Search, Filter, Star, Clock, Grid3X3, List, FileText, Table, Presentation, Briefcase, GraduationCap, User, Megaphone, Scale, Users, Calculator, Palette, Folder, Heart, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useTemplatesStore } from '@/stores/templates-store';
import type { TemplateMetadata, TemplateCategory, DocumentType } from '@/lib/office/templates/types';
import { TEMPLATE_CATEGORIES, DOCUMENT_TYPE_LABELS } from '@/lib/office/templates/types';

// ============================================================================
// Icons
// ============================================================================

const CATEGORY_ICONS: Record<TemplateCategory, React.ElementType> = {
  business: Briefcase,
  education: GraduationCap,
  personal: User,
  marketing: Megaphone,
  legal: Scale,
  hr: Users,
  finance: Calculator,
  creative: Palette,
  custom: Folder,
};

const DOCUMENT_TYPE_ICONS: Record<DocumentType, React.ElementType> = {
  doc: FileText,
  sheet: Table,
  slide: Presentation,
};

// ============================================================================
// Template Card Component
// ============================================================================

interface TemplateCardProps {
  template: TemplateMetadata;
  onSelect: (template: TemplateMetadata) => void;
  onFavorite?: (templateId: string) => void;
  isFavorite?: boolean;
  viewMode?: 'grid' | 'list';
}

function TemplateCard({
  template,
  onSelect,
  onFavorite,
  isFavorite = false,
  viewMode = 'grid',
}: TemplateCardProps) {
  const DocIcon = DOCUMENT_TYPE_ICONS[template.documentType];
  const CategoryIcon = CATEGORY_ICONS[template.category];

  if (viewMode === 'list') {
    return (
      <div
        className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
        onClick={() => onSelect(template)}
      >
        {/* Thumbnail */}
        <div className="w-16 h-20 rounded border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {template.thumbnailUrl ? (
            <img
              src={template.thumbnailUrl}
              alt={template.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <DocIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{template.name}</h3>
            {template.featured && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
                <Star className="h-3 w-3 mr-1" />
                Vedette
              </Badge>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
              {template.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CategoryIcon className="h-3 w-3" />
              {TEMPLATE_CATEGORIES[template.category].label}
            </span>
            <span>{template.usageCount} utilisations</span>
            {template.rating && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {template.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onFavorite(template.id);
              }}
            >
              <Heart
                className={cn(
                  'h-4 w-4',
                  isFavorite && 'fill-red-500 text-red-500'
                )}
              />
            </Button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className="group rounded-lg border bg-card hover:border-primary/50 cursor-pointer transition-all overflow-hidden"
      onClick={() => onSelect(template)}
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden relative">
        {template.thumbnailUrl ? (
          <img
            src={template.thumbnailUrl}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <DocIcon className="h-12 w-12 text-muted-foreground" />
        )}

        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary">
            Utiliser
          </Button>
          {onFavorite && (
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onFavorite(template.id);
              }}
            >
              <Heart
                className={cn(
                  'h-4 w-4',
                  isFavorite && 'fill-red-500 text-red-500'
                )}
              />
            </Button>
          )}
        </div>

        {/* Featured badge */}
        {template.featured && (
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 bg-amber-100 text-amber-800 text-xs"
          >
            <Star className="h-3 w-3 mr-1 fill-amber-500" />
            Vedette
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium truncate">{template.name}</h3>
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {template.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs px-1.5">
            <CategoryIcon className="h-3 w-3 mr-1" />
            {TEMPLATE_CATEGORIES[template.category].label}
          </Badge>
          {template.rating && (
            <span className="flex items-center gap-1 ml-auto">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {template.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Category Section Component
// ============================================================================

interface CategorySectionProps {
  category: TemplateCategory;
  templates: TemplateMetadata[];
  onSelect: (template: TemplateMetadata) => void;
  onViewAll: () => void;
}

function CategorySection({
  category,
  templates,
  onSelect,
  onViewAll,
}: CategorySectionProps) {
  const Icon = CATEGORY_ICONS[category];
  const { label, description } = TEMPLATE_CATEGORIES[category];

  if (templates.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">{label}</h3>
          <Badge variant="secondary">{templates.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          Voir tout
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {templates.slice(0, 4).map((template) => (
          <TemplateCard key={template.id} template={template} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Gallery Component
// ============================================================================

interface TemplateGalleryProps {
  documentType?: DocumentType;
  onSelectTemplate: (template: TemplateMetadata) => void;
  className?: string;
}

export function TemplateGallery({
  documentType,
  onSelectTemplate,
  className,
}: TemplateGalleryProps) {
  const {
    templates,
    featuredTemplates,
    recentTemplates,
    favoriteTemplates,
    filters,
    isLoading,
    isLoadingMore,
    isLoadingFeatured,
    hasMore,
    error,
    fetchTemplates,
    fetchMoreTemplates,
    fetchFeaturedTemplates,
    fetchRecentTemplates,
    fetchFavoriteTemplates,
    setFilters,
    resetFilters,
    setCategory,
    setDocumentType,
    setSearch,
    addToFavorites,
    removeFromFavorites,
  } = useTemplatesStore();

  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = React.useState('browse');

  // Initialize
  useEffect(() => {
    if (documentType) {
      setDocumentType(documentType);
    } else {
      fetchTemplates();
    }
    fetchFeaturedTemplates(documentType);
    fetchRecentTemplates();
    fetchFavoriteTemplates();
  }, [documentType]);

  const handleFavorite = useCallback(
    (templateId: string) => {
      const isFav = favoriteTemplates.some((t) => t.id === templateId);
      if (isFav) {
        removeFromFavorites(templateId);
      } else {
        addToFavorites(templateId);
      }
    },
    [favoriteTemplates, addToFavorites, removeFromFavorites]
  );

  const isFavorite = useCallback(
    (templateId: string) => favoriteTemplates.some((t) => t.id === templateId),
    [favoriteTemplates]
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Galerie de modèles</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="h-10">
            <TabsTrigger value="browse" className="gap-2">
              <Grid3X3 className="h-4 w-4" />
              Parcourir
            </TabsTrigger>
            <TabsTrigger value="recent" className="gap-2">
              <Clock className="h-4 w-4" />
              Récents
            </TabsTrigger>
            <TabsTrigger value="favorites" className="gap-2">
              <Heart className="h-4 w-4" />
              Favoris
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Browse Tab */}
        <TabsContent value="browse" className="flex-1 flex flex-col mt-0">
          {/* Filters */}
          <div className="flex items-center gap-3 p-4 border-b">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un modèle..."
                value={filters.search || ''}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <Select
              value={filters.category || 'all'}
              onValueChange={(v) => setCategory(v as TemplateCategory | 'all')}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {Object.entries(TEMPLATE_CATEGORIES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.documentType || 'all'}
              onValueChange={(v) => setDocumentType(v as DocumentType | 'all')}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filters.search || filters.category !== 'all' || filters.documentType !== 'all') && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Réinitialiser
              </Button>
            )}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Featured Section */}
              {featuredTemplates.length > 0 && !filters.search && filters.category === 'all' && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-amber-500" />
                      <h3 className="font-semibold">Modèles en vedette</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {featuredTemplates.slice(0, 4).map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          onSelect={onSelectTemplate}
                          onFavorite={handleFavorite}
                          isFavorite={isFavorite(template.id)}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Loading */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-50" />
                  <p>Aucun modèle trouvé</p>
                  {filters.search && (
                    <Button variant="link" onClick={resetFilters}>
                      Réinitialiser les filtres
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Templates Grid */}
                  <div
                    className={cn(
                      viewMode === 'grid'
                        ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                        : 'space-y-2'
                    )}
                  >
                    {templates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={onSelectTemplate}
                        onFavorite={handleFavorite}
                        isFavorite={isFavorite(template.id)}
                        viewMode={viewMode}
                      />
                    ))}
                  </div>

                  {/* Load More */}
                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={fetchMoreTemplates}
                        disabled={isLoadingMore}
                      >
                        {isLoadingMore ? (
                          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4  mr-2" />
                        ) : null}
                        Charger plus
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Recent Tab */}
        <TabsContent value="recent" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {recentTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mb-3 opacity-50" />
                  <p>Aucun modèle récent</p>
                </div>
              ) : (
                <div
                  className={cn(
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                      : 'space-y-2'
                  )}
                >
                  {recentTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onSelect={onSelectTemplate}
                      onFavorite={handleFavorite}
                      isFavorite={isFavorite(template.id)}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Favorites Tab */}
        <TabsContent value="favorites" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {favoriteTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Heart className="h-12 w-12 mb-3 opacity-50" />
                  <p>Aucun modèle favori</p>
                  <p className="text-sm">Ajoutez des modèles à vos favoris pour y accéder rapidement</p>
                </div>
              ) : (
                <div
                  className={cn(
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                      : 'space-y-2'
                  )}
                >
                  {favoriteTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onSelect={onSelectTemplate}
                      onFavorite={handleFavorite}
                      isFavorite={true}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TemplateGallery;
