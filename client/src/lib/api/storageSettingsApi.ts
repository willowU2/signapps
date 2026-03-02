import { storageApiClient } from '@/lib/api/core';

// Types
export interface StorageRule {
    id: string;
    file_type: string;
    mime_type_pattern: string | null;
    target_bucket: string;
    target_backend: string;
    is_active: boolean;
}

export interface UpsertStorageRule {
    file_type: string;
    mime_type_pattern: string | null;
    target_bucket: string;
    target_backend: string;
    is_active: boolean;
}

export interface IndexingRule {
    id: string;
    folder_path: string;
    bucket: string;
    include_subfolders: boolean;
    file_types_allowed: string[] | null;
    collection_name: string | null;
    is_active: boolean;
}

export interface UpsertIndexingRule {
    folder_path: string;
    bucket: string;
    include_subfolders: boolean;
    file_types_allowed: string[] | null;
    collection_name: string | null;
    is_active: boolean;
}

export interface SystemSetting {
    setting_value: string;
}

const STORAGE_API_BASE = '/storage_rules';
const AI_INDEX_API_BASE = '/indexing_rules';
const SETTINGS_API_BASE = '/settings'; // Global admin settings

export const storageSettingsApi = {
    // Global Settings
    getSystemSetting: async (key: string): Promise<SystemSetting> => {
        const response = await storageApiClient.get(`${SETTINGS_API_BASE}/${key}`);
        return response.data;
    },
    updateSystemSetting: async (key: string, value: string): Promise<void> => {
        await storageApiClient.put(`${SETTINGS_API_BASE}/${key}`, { setting_value: value });
    },

    // Storage Rules
    async getStorageRules(): Promise<StorageRule[]> {
        const { data } = await storageApiClient.get<StorageRule[]>(STORAGE_API_BASE);
        return data;
    },

    async createStorageRule(rule: UpsertStorageRule): Promise<StorageRule> {
        const { data } = await storageApiClient.post<StorageRule>(STORAGE_API_BASE, rule);
        return data;
    },

    async updateStorageRule(id: string, rule: UpsertStorageRule): Promise<StorageRule> {
        const { data } = await storageApiClient.put<StorageRule>(`${STORAGE_API_BASE}/${id}`, rule);
        return data;
    },

    async deleteStorageRule(id: string): Promise<void> {
        await storageApiClient.delete(`${STORAGE_API_BASE}/${id}`);
    },

    // Indexing Rules
    async getIndexingRules(): Promise<IndexingRule[]> {
        const { data } = await storageApiClient.get<IndexingRule[]>(AI_INDEX_API_BASE);
        return data;
    },

    async createIndexingRule(rule: UpsertIndexingRule): Promise<IndexingRule> {
        const { data } = await storageApiClient.post<IndexingRule>(AI_INDEX_API_BASE, rule);
        return data;
    },

    async updateIndexingRule(id: string, rule: UpsertIndexingRule): Promise<IndexingRule> {
        const { data } = await storageApiClient.put<IndexingRule>(`${AI_INDEX_API_BASE}/${id}`, rule);
        return data;
    },

    async deleteIndexingRule(id: string): Promise<void> {
        await storageApiClient.delete(`${AI_INDEX_API_BASE}/${id}`);
    }
};
