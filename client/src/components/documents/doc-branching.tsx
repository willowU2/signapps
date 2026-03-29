'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch, Merge, Eye, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface DocBranch {
  id: string;
  name: string;
  isMain: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  children?: string[];
}

interface DocBranchingProps {
  documentId?: string;
  onMerge?: (fromBranch: string, toBranch: string) => void;
}

export function DocBranching({ documentId = 'doc-123', onMerge }: DocBranchingProps) {
  const [branches, setBranches] = useState<DocBranch[]>([
    {
      id: 'main',
      name: 'main',
      isMain: true,
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date('2026-03-20'),
      author: 'Admin',
      children: ['draft-v2', 'legal-review'],
    },
    {
      id: 'draft-v2',
      name: 'draft-v2',
      isMain: false,
      createdAt: new Date('2026-02-10'),
      updatedAt: new Date('2026-03-18'),
      author: 'John Doe',
      children: [],
    },
    {
      id: 'legal-review',
      name: 'legal-review',
      isMain: false,
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-03-21'),
      author: 'Legal Team',
      children: [],
    },
  ]);

  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);

  const initiiateMerge = (fromId: string) => {
    setMergeFrom(fromId);
    toast.info(`Select branch to merge into`);
  };

  const completeMerge = (toId: string) => {
    if (!mergeFrom || mergeFrom === toId) {
      toast.error('Invalid merge operation');
      return;
    }
    onMerge?.(mergeFrom, toId);
    setMergeFrom(null);
    toast.success(`Merged "${mergeFrom}" into "${toId}"`);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const mainBranch = branches.find((b) => b.isMain);
  const childBranches = branches.filter((b) => !b.isMain);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Document Branching: {documentId}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Main Branch */}
          {mainBranch && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Main Branch</h3>
              <div className="relative">
                <div
                  className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    selectedBranch === mainBranch.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-border bg-muted hover:border-border'
                  }`}
                  onClick={() => setSelectedBranch(mainBranch.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{mainBranch.name}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(mainBranch.updatedAt)}
                        </span>
                        <span>by {mainBranch.author}</span>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                      Active
                    </span>
                  </div>
                </div>

                {/* Branch Tree Connector */}
                {childBranches.length > 0 && (
                  <div className="absolute left-6 top-full h-4 w-0.5 bg-gray-300" />
                )}
              </div>
            </div>
          )}

          {/* Child Branches */}
          {childBranches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground ml-8">Feature Branches</h3>
              <div className="space-y-2 ml-8 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-gray-300">
                {childBranches.map((branch) => (
                  <div
                    key={branch.id}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer pl-6 before:absolute before:left-0 before:top-4 before:w-6 before:h-0.5 before:bg-gray-300 ${
                      selectedBranch === branch.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-border hover:border-border'
                    } ${mergeFrom === branch.id ? 'ring-2 ring-orange-400' : ''}`}
                    onClick={() => setSelectedBranch(branch.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm">{branch.name}</p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{formatDate(branch.updatedAt)}</span>
                          <span>{branch.author}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            initiiateMerge(branch.id);
                          }}
                          variant="outline"
                          size="xs"
                          className="h-7"
                        >
                          <Merge className="h-3 w-3 mr-1" />
                          Merge
                        </Button>
                        <Button variant="ghost" size="xs" className="h-7">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Merge Action */}
          {mergeFrom && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm font-medium text-orange-800 mb-2">
                Merging from: <span className="font-semibold">{mergeFrom}</span>
              </p>
              <div className="space-y-2">
                {branches
                  .filter((b) => b.id !== mergeFrom)
                  .map((branch) => (
                    <Button
                      key={branch.id}
                      onClick={() => completeMerge(branch.id)}
                      className="w-full text-left justify-start"
                      variant="outline"
                    >
                      Merge into {branch.name}
                    </Button>
                  ))}
                <Button
                  onClick={() => {
                    setMergeFrom(null);
                    toast.info('Merge cancelled');
                  }}
                  variant="ghost"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Diff Link */}
          {selectedBranch && !selectedBranch.startsWith('main') && (
            <Button variant="outline" className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              View Diff from Main
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
