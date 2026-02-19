'use client';

export interface FileItem {
    key: string;
    name: string;
    type: 'folder' | 'file';
    size?: number;
    lastModified?: string;
    contentType?: string;
    id?: string;
    bucket?: string;
    originalPath?: string;
}

export type DriveView = 'my-drive' | 'shared' | 'recent' | 'starred' | 'trash';
