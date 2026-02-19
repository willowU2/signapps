import { useState, useCallback } from 'react';
import { favoritesApi } from '@/lib/api';

export interface Favorite {
  id: string;
  bucket: string;
  key: string;
  is_folder: boolean;
  display_name?: string;
  color?: string;
  sort_order: number;
  filename: string;
}

export interface UseFavoritesReturn {
  favorites: Favorite[];
  loading: boolean;
  error: Error | null;
  fetchFavorites: () => Promise<void>;
  addFavorite: (
    bucket: string,
    key: string,
    isFolder: boolean,
    displayName?: string,
    color?: string
  ) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  updateFavorite: (
    id: string,
    displayName?: string,
    color?: string
  ) => Promise<void>;
  reorderFavorites: (order: string[]) => Promise<void>;
  checkIsFavorite: (bucket: string, key: string) => Promise<boolean>;
  removeFavoriteByPath: (bucket: string, key: string) => Promise<void>;
}

/**
 * Hook pour gerer les favoris.
 * Fournit l'acces aux API favoris avec cache et gestion d'erreurs.
 */
export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await favoritesApi.list();
      setFavorites(response.data?.favorites || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addFavorite = useCallback(
    async (
      bucket: string,
      key: string,
      isFolder: boolean,
      displayName?: string,
      color?: string
    ) => {
      setError(null);
      try {
        await favoritesApi.add({
          bucket,
          key,
          is_folder: isFolder,
          display_name: displayName,
          color,
        });
        // Refresh the list
        await fetchFavorites();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [fetchFavorites]
  );

  const removeFavorite = useCallback(async (id: string) => {
    setError(null);
    try {
      await favoritesApi.remove(id);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, []);

  const updateFavorite = useCallback(
    async (id: string, displayName?: string, color?: string) => {
      setError(null);
      try {
        await favoritesApi.update(id, {
          display_name: displayName,
          color,
        });
        setFavorites((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  display_name: displayName,
                  color,
                }
              : f
          )
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    []
  );

  const reorderFavorites = useCallback(async (order: string[]) => {
    setError(null);
    try {
      await favoritesApi.reorder(order);
      // Update local favorites order
      const favoriteMap = new Map(favorites.map((f) => [f.id, f]));
      const reordered = order
        .map((id) => favoriteMap.get(id))
        .filter((f) => f !== undefined) as Favorite[];
      setFavorites(reordered);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, [favorites]);

  const checkIsFavorite = useCallback(
    async (bucket: string, key: string): Promise<boolean> => {
      setError(null);
      try {
        const response = await favoritesApi.check(bucket, key);
        return response.data || false;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return false;
      }
    },
    []
  );

  const removeFavoriteByPath = useCallback(
    async (bucket: string, key: string) => {
      setError(null);
      try {
        await favoritesApi.removeByPath(bucket, key);
        setFavorites((prev) =>
          prev.filter((f) => !(f.bucket === bucket && f.key === key))
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    []
  );

  return {
    favorites,
    loading,
    error,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    updateFavorite,
    reorderFavorites,
    checkIsFavorite,
    removeFavoriteByPath,
  };
}
