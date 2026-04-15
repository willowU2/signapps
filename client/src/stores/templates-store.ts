/**
 * Templates Store
 *
 * Zustand store for document templates management.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  TemplateMetadata,
  Template,
  TemplateGalleryFilters,
  TemplateCategory,
  DocumentType,
} from "@/lib/office/templates/types";
import { templatesApi } from "@/lib/office/templates/api";

// ============================================================================
// Types
// ============================================================================

interface TemplatesState {
  // Gallery state
  templates: TemplateMetadata[];
  featuredTemplates: TemplateMetadata[];
  recentTemplates: TemplateMetadata[];
  favoriteTemplates: TemplateMetadata[];
  myTemplates: TemplateMetadata[];

  // Pagination
  currentPage: number;
  pageSize: number;
  totalTemplates: number;
  hasMore: boolean;

  // Filters
  filters: TemplateGalleryFilters;

  // Loading states
  isLoading: boolean;
  isLoadingMore: boolean;
  isLoadingFeatured: boolean;
  isLoadingRecent: boolean;
  isLoadingFavorites: boolean;
  isLoadingMyTemplates: boolean;

  // Selected template for preview/apply
  selectedTemplate: Template | null;
  isLoadingSelected: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchTemplates: (resetPage?: boolean) => Promise<void>;
  fetchMoreTemplates: () => Promise<void>;
  fetchFeaturedTemplates: (documentType?: DocumentType) => Promise<void>;
  fetchRecentTemplates: () => Promise<void>;
  fetchFavoriteTemplates: () => Promise<void>;
  fetchMyTemplates: () => Promise<void>;
  selectTemplate: (templateId: string) => Promise<void>;
  clearSelectedTemplate: () => void;
  setFilters: (filters: Partial<TemplateGalleryFilters>) => void;
  resetFilters: () => void;
  setCategory: (category: TemplateCategory | "all") => void;
  setDocumentType: (documentType: DocumentType | "all") => void;
  setSearch: (search: string) => void;
  addToFavorites: (templateId: string) => Promise<void>;
  removeFromFavorites: (templateId: string) => Promise<void>;
  addToRecent: (template: TemplateMetadata) => void;
  clearError: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FILTERS: TemplateGalleryFilters = {
  search: "",
  category: "all",
  documentType: "all",
  visibility: "all",
  tags: [],
  featuredOnly: false,
  sortBy: "usageCount",
  sortOrder: "desc",
};

const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Store
// ============================================================================

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      // Initial state
      templates: [],
      featuredTemplates: [],
      recentTemplates: [],
      favoriteTemplates: [],
      myTemplates: [],

      currentPage: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      totalTemplates: 0,
      hasMore: false,

      filters: DEFAULT_FILTERS,

      isLoading: false,
      isLoadingMore: false,
      isLoadingFeatured: false,
      isLoadingRecent: false,
      isLoadingFavorites: false,
      isLoadingMyTemplates: false,

      selectedTemplate: null,
      isLoadingSelected: false,

      error: null,

      // Actions
      fetchTemplates: async (resetPage = true) => {
        const { filters, pageSize } = get();
        const page = resetPage ? 1 : get().currentPage;

        set({ isLoading: true, error: null });
        if (resetPage) {
          set({ currentPage: 1, templates: [] });
        }

        try {
          const response = await templatesApi.getTemplates(
            filters,
            page,
            pageSize,
          );
          set({
            templates: response.templates,
            totalTemplates: response.total,
            hasMore: response.hasMore,
            currentPage: page,
            isLoading: false,
          });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Erreur lors du chargement",
            isLoading: false,
          });
        }
      },

      fetchMoreTemplates: async () => {
        const {
          hasMore,
          isLoadingMore,
          currentPage,
          filters,
          pageSize,
          templates,
        } = get();

        if (!hasMore || isLoadingMore) return;

        set({ isLoadingMore: true, error: null });

        try {
          const response = await templatesApi.getTemplates(
            filters,
            currentPage + 1,
            pageSize,
          );
          set({
            templates: [...templates, ...response.templates],
            totalTemplates: response.total,
            hasMore: response.hasMore,
            currentPage: currentPage + 1,
            isLoadingMore: false,
          });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Erreur lors du chargement",
            isLoadingMore: false,
          });
        }
      },

      fetchFeaturedTemplates: async (documentType?: DocumentType) => {
        set({ isLoadingFeatured: true });

        try {
          const templates = await templatesApi.getFeaturedTemplates(
            documentType,
            10,
          );
          set({ featuredTemplates: templates, isLoadingFeatured: false });
        } catch (error) {
          set({ isLoadingFeatured: false });
        }
      },

      fetchRecentTemplates: async () => {
        set({ isLoadingRecent: true });

        try {
          const templates = await templatesApi.getRecentTemplates(10);
          set({ recentTemplates: templates, isLoadingRecent: false });
        } catch (error) {
          set({ isLoadingRecent: false });
        }
      },

      fetchFavoriteTemplates: async () => {
        set({ isLoadingFavorites: true });

        try {
          const templates = await templatesApi.getFavoriteTemplates();
          set({ favoriteTemplates: templates, isLoadingFavorites: false });
        } catch (error) {
          set({ isLoadingFavorites: false });
        }
      },

      fetchMyTemplates: async () => {
        set({ isLoadingMyTemplates: true });

        try {
          const response = await templatesApi.getMyTemplates();
          set({ myTemplates: response.templates, isLoadingMyTemplates: false });
        } catch (error) {
          set({ isLoadingMyTemplates: false });
        }
      },

      selectTemplate: async (templateId: string) => {
        set({ isLoadingSelected: true, error: null });

        try {
          const template = await templatesApi.getTemplate(templateId);
          set({ selectedTemplate: template, isLoadingSelected: false });

          // Add to recent (extract metadata only, excluding content)
          const { content: _, ...metadata } = template;
          get().addToRecent(metadata);
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Erreur lors du chargement",
            isLoadingSelected: false,
          });
        }
      },

      clearSelectedTemplate: () => {
        set({ selectedTemplate: null });
      },

      setFilters: (newFilters: Partial<TemplateGalleryFilters>) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        }));
        get().fetchTemplates(true);
      },

      resetFilters: () => {
        set({ filters: DEFAULT_FILTERS });
        get().fetchTemplates(true);
      },

      setCategory: (category: TemplateCategory | "all") => {
        get().setFilters({ category });
      },

      setDocumentType: (documentType: DocumentType | "all") => {
        get().setFilters({ documentType });
      },

      setSearch: (search: string) => {
        get().setFilters({ search });
      },

      addToFavorites: async (templateId: string) => {
        try {
          await templatesApi.addToFavorites(templateId);

          // Update local state
          const template = get().templates.find((t) => t.id === templateId);
          if (template) {
            set((state) => ({
              favoriteTemplates: [...state.favoriteTemplates, template],
            }));
          }
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Erreur lors de l'ajout aux favoris",
          });
        }
      },

      removeFromFavorites: async (templateId: string) => {
        try {
          await templatesApi.removeFromFavorites(templateId);

          // Update local state
          set((state) => ({
            favoriteTemplates: state.favoriteTemplates.filter(
              (t) => t.id !== templateId,
            ),
          }));
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Erreur lors de la suppression des favoris",
          });
        }
      },

      addToRecent: (template: TemplateMetadata) => {
        set((state) => {
          const filtered = state.recentTemplates.filter(
            (t) => t.id !== template.id,
          );
          return {
            recentTemplates: [template, ...filtered].slice(0, 10),
          };
        });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "templates-store",
      partialize: (state) => ({
        recentTemplates: state.recentTemplates,
        filters: state.filters,
      }),
    },
  ),
);

// ============================================================================
// Selectors
// ============================================================================

export const selectTemplates = (state: TemplatesState) => state.templates;
export const selectFeaturedTemplates = (state: TemplatesState) =>
  state.featuredTemplates;
export const selectRecentTemplates = (state: TemplatesState) =>
  state.recentTemplates;
export const selectFavoriteTemplates = (state: TemplatesState) =>
  state.favoriteTemplates;
export const selectMyTemplates = (state: TemplatesState) => state.myTemplates;
export const selectSelectedTemplate = (state: TemplatesState) =>
  state.selectedTemplate;
export const selectFilters = (state: TemplatesState) => state.filters;
export const selectIsLoading = (state: TemplatesState) => state.isLoading;
export const selectHasMore = (state: TemplatesState) => state.hasMore;
export const selectError = (state: TemplatesState) => state.error;

export default useTemplatesStore;
