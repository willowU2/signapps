import { useState, useCallback } from 'react';
import { storageApi } from '@/lib/api';

export interface Permissions {
  bucket: string;
  key: string;
  mode: number;
  mode_string: string;
  owner_readable: boolean;
  owner_writable: boolean;
  owner_executable: boolean;
  group_readable: boolean;
  group_writable: boolean;
  group_executable: boolean;
  other_readable: boolean;
  other_writable: boolean;
  other_executable: boolean;
}

export interface UsePermissionsReturn {
  permissions: Permissions | null;
  loading: boolean;
  error: Error | null;
  fetchPermissions: (bucket: string, key: string) => Promise<void>;
  setPermissions: (bucket: string, key: string, mode: number) => Promise<void>;
  resetPermissions: (bucket: string, key: string) => Promise<void>;
}

/**
 * Hook pour gérer les permissions des fichiers.
 * Fournit l'accès aux API permissions avec cache et gestion d'erreurs.
 */
export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissionsState] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPermissions = useCallback(async (bucket: string, key: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await storageApi.getPermissions(bucket, key);
      setPermissionsState(response.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const setPermissions = useCallback(
    async (bucket: string, key: string, mode: number) => {
      setError(null);
      try {
        const response = await storageApi.setPermissions(bucket, key, { mode });
        setPermissionsState(response.data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    []
  );

  const resetPermissions = useCallback(
    async (bucket: string, key: string) => {
      setError(null);
      try {
        await storageApi.resetPermissions(bucket, key);
        setPermissionsState(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    []
  );

  return {
    permissions,
    loading,
    error,
    fetchPermissions,
    setPermissions,
    resetPermissions,
  };
}
