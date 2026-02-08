'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, Folder, FileText, Image, Search, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'image';
  size?: string;
  modified: string;
}

const mockFiles: FileItem[] = [
  { id: '1', name: 'contracts', type: 'folder', modified: 'Feb 5, 2026' },
  { id: '2', name: 'reports', type: 'folder', modified: 'Feb 7, 2026' },
  { id: '3', name: 'spec.pdf', type: 'file', size: '2.4 MB', modified: 'Feb 8, 2026' },
  { id: '4', name: 'notes.md', type: 'file', size: '12 KB', modified: 'Feb 8, 2026' },
  { id: '5', name: 'diagram.png', type: 'image', size: '456 KB', modified: 'Feb 6, 2026' },
];

export default function StoragePage() {
  const [search, setSearch] = useState('');
  const [currentPath] = useState(['documents', 'projects']);

  const getIcon = (type: string) => {
    switch (type) {
      case 'folder':
        return <Folder className="h-5 w-5 text-blue-500" />;
      case 'image':
        return <Image className="h-5 w-5 text-green-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Storage</h1>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Files</span>
          {currentPath.map((path, i) => (
            <span key={i} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className={i === currentPath.length - 1 ? 'font-medium' : 'text-muted-foreground'}>
                {path}
              </span>
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* File List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {mockFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between py-3 hover:bg-muted/50 cursor-pointer px-2 -mx-2 rounded"
                >
                  <div className="flex items-center gap-3">
                    {getIcon(file.type)}
                    <div>
                      <p className="font-medium">{file.name}</p>
                      {file.size && (
                        <p className="text-xs text-muted-foreground">{file.size}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">{file.modified}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Storage Usage */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Storage Usage</span>
              <span className="text-sm text-muted-foreground">48 GB / 500 GB</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[9.6%] bg-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
