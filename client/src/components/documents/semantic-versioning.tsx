'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag, User, Clock } from 'lucide-react';

interface DocumentVersion {
  id: string;
  version: string;
  type: 'major' | 'minor' | 'patch';
  description: string;
  author: string;
  timestamp: Date;
  changes: number;
}

interface SemanticVersioningProps {
  versions?: DocumentVersion[];
}

export function SemanticVersioning({ versions }: SemanticVersioningProps) {
  const defaultVersions: DocumentVersion[] = [
    {
      id: '1',
      version: '2.0.0',
      type: 'major',
      description: 'Major redesign with new contract templates and approval workflow',
      author: 'Alice Johnson',
      timestamp: new Date('2024-03-20'),
      changes: 45,
    },
    {
      id: '2',
      version: '1.5.0',
      type: 'minor',
      description: 'Added support for multi-language contracts and digital signatures',
      author: 'Bob Smith',
      timestamp: new Date('2024-02-15'),
      changes: 18,
    },
    {
      id: '3',
      version: '1.4.2',
      type: 'patch',
      description: 'Fixed date formatting issue in contract headers',
      author: 'Carol Davis',
      timestamp: new Date('2024-01-30'),
      changes: 3,
    },
    {
      id: '4',
      version: '1.4.1',
      type: 'patch',
      description: 'Security patch for XSS vulnerability in document preview',
      author: 'David Wilson',
      timestamp: new Date('2024-01-15'),
      changes: 2,
    },
  ];

  const displayVersions = versions || defaultVersions;

  const getBadgeColor = (type: 'major' | 'minor' | 'patch') => {
    switch (type) {
      case 'major':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'minor':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'patch':
        return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getBadgeLabel = (type: 'major' | 'minor' | 'patch') => {
    switch (type) {
      case 'major':
        return 'Major';
      case 'minor':
        return 'Minor';
      case 'patch':
        return 'Patch';
    }
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Document Versions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayVersions.map((version) => (
              <Card key={version.id} className="border-slate-200 hover:border-slate-300 transition">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xl font-bold text-foreground">{version.version}</span>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${getBadgeColor(version.type)}`}
                      >
                        {getBadgeLabel(version.type)}
                      </span>
                    </div>
                    <div className="text-right text-xs text-slate-500 flex-shrink-0">
                      {version.changes} change{version.changes !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 mb-3">{version.description}</p>

                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{version.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{version.timestamp.toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
