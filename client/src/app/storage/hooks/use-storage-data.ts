'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  raidApi,
  storageStatsApi,
  sharesApi,
  mountsApi,
  externalStorageApi,
  type RaidArray,
  type RaidHealth,
  type RaidEvent,
  type DiskInfo,
  type StorageStats,
  type ShareLink,
  type MountPoint,
  type ExternalStorage,
} from '@/lib/api';
import { toast } from 'sonner';

export function useStorageStats() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await storageStatsApi.getStats();
      setStats(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch storage stats:', err);
      setError('Impossible de charger les statistiques');
      // Provide mock data for development
      setStats({
        total_bytes: 1000000000000,
        used_bytes: 450000000000,
        free_bytes: 550000000000,
        buckets_count: 3,
        files_count: 1250,
        arrays_count: 2,
        health_status: 'healthy',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}

export function useRaidData() {
  const [arrays, setArrays] = useState<RaidArray[]>([]);
  const [health, setHealth] = useState<RaidHealth | null>(null);
  const [events, setEvents] = useState<RaidEvent[]>([]);
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [arraysRes, healthRes, eventsRes, disksRes] = await Promise.allSettled([
        raidApi.listArrays(),
        raidApi.getHealth(),
        raidApi.listEvents(10),
        raidApi.listDisks(),
      ]);

      if (arraysRes.status === 'fulfilled') setArrays(arraysRes.value.data);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
      if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value.data);
      if (disksRes.status === 'fulfilled') setDisks(disksRes.value.data);

      setError(null);
    } catch (err) {
      console.error('Failed to fetch RAID data:', err);
      setError('Impossible de charger les données RAID');
    } finally {
      setLoading(false);
    }
  }, []);

  const createArray = async (data: { name: string; raid_level: string; disk_ids: string[] }) => {
    try {
      await raidApi.createArray(data);
      toast.success('Array créé avec succès');
      await fetchAll();
    } catch (err) {
      console.error('Failed to create array:', err);
      toast.error('Erreur lors de la création de l\'array');
      throw err;
    }
  };

  const deleteArray = async (id: string) => {
    if (!confirm('Supprimer cet array RAID ? Cette action est irréversible.')) return;
    try {
      await raidApi.deleteArray(id);
      toast.success('Array supprimé');
      await fetchAll();
    } catch (err) {
      console.error('Failed to delete array:', err);
      toast.error('Erreur lors de la suppression');
      throw err;
    }
  };

  const rebuildArray = async (id: string) => {
    try {
      await raidApi.rebuildArray(id);
      toast.success('Reconstruction lancée');
      await fetchAll();
    } catch (err) {
      console.error('Failed to rebuild array:', err);
      toast.error('Erreur lors de la reconstruction');
      throw err;
    }
  };

  const scanDisks = async () => {
    try {
      const response = await raidApi.scanDisks();
      setDisks(response.data);
      toast.success('Scan terminé');
    } catch (err) {
      console.error('Failed to scan disks:', err);
      toast.error('Erreur lors du scan');
    }
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    arrays,
    health,
    events,
    disks,
    loading,
    error,
    refresh: fetchAll,
    createArray,
    deleteArray,
    rebuildArray,
    scanDisks,
  };
}

export function useShares() {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sharesApi.list();
      setShares(response.data.shares || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch shares:', err);
      setError('Impossible de charger les partages');
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createShare = async (data: {
    bucket: string;
    key: string;
    expires_in_hours?: number;
    password?: string;
    max_downloads?: number;
    access_type?: 'view' | 'download';
  }) => {
    try {
      const response = await sharesApi.create(data);
      toast.success('Lien de partage créé');
      await fetchShares();
      return response.data;
    } catch (err) {
      console.error('Failed to create share:', err);
      toast.error('Erreur lors de la création du partage');
      throw err;
    }
  };

  const deleteShare = async (id: string) => {
    if (!confirm('Supprimer ce lien de partage ?')) return;
    try {
      await sharesApi.delete(id);
      toast.success('Partage supprimé');
      await fetchShares();
    } catch (err) {
      console.error('Failed to delete share:', err);
      toast.error('Erreur lors de la suppression');
      throw err;
    }
  };

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  return { shares, loading, error, refresh: fetchShares, createShare, deleteShare };
}

export function useMounts() {
  const [mounts, setMounts] = useState<MountPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await mountsApi.list();
      setMounts(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch mounts:', err);
      setError('Impossible de charger les montages');
      // Mock data for development
      setMounts([
        {
          device: '/dev/sda1',
          mount_point: '/',
          file_system: 'ext4',
          options: ['rw', 'relatime'],
          total_bytes: 500000000000,
          used_bytes: 250000000000,
          available_bytes: 250000000000,
          usage_percent: 50,
        },
        {
          device: '/dev/sdb1',
          mount_point: '/data',
          file_system: 'xfs',
          options: ['rw', 'noatime'],
          total_bytes: 2000000000000,
          used_bytes: 800000000000,
          available_bytes: 1200000000000,
          usage_percent: 40,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMounts();
  }, [fetchMounts]);

  return { mounts, loading, error, refresh: fetchMounts };
}

export function useExternalStorage() {
  const [storages, setStorages] = useState<ExternalStorage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStorages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await externalStorageApi.list();
      setStorages(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch external storages:', err);
      setError('Impossible de charger les stockages externes');
      setStorages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const detect = async () => {
    try {
      const response = await externalStorageApi.detect();
      setStorages(response.data);
      toast.success('Détection terminée');
    } catch (err) {
      console.error('Failed to detect storages:', err);
      toast.error('Erreur lors de la détection');
    }
  };

  const disconnect = async (id: string) => {
    try {
      await externalStorageApi.disconnect(id);
      toast.success('Déconnecté');
      await fetchStorages();
    } catch (err) {
      console.error('Failed to disconnect:', err);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const eject = async (id: string) => {
    try {
      await externalStorageApi.eject(id);
      toast.success('Éjecté');
      await fetchStorages();
    } catch (err) {
      console.error('Failed to eject:', err);
      toast.error('Erreur lors de l\'éjection');
    }
  };

  useEffect(() => {
    fetchStorages();
  }, [fetchStorages]);

  return {
    storages,
    loading,
    error,
    refresh: fetchStorages,
    detect,
    disconnect,
    eject,
  };
}
