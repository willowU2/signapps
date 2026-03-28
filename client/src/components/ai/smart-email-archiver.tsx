'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Archive, RotateCcw, Folder, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

interface ArchiverEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  suggestedFolder?: string;
}

interface SmartEmailArchiverProps {
  emails?: ArchiverEmail[];
  onArchive?: (emailId: string, folder: string) => void;
}

export function SmartEmailArchiver({ emails = [], onArchive }: SmartEmailArchiverProps) {
  const [items, setItems] = useState<ArchiverEmail[]>(emails);
  const [undoStack, setUndoStack] = useState<ArchiverEmail[][]>([]);
  const [archived, setArchived] = useState<Set<string>>(new Set());

  const suggestFolders = (email: ArchiverEmail): string[] => {
    const keywords = email.subject.toLowerCase();
    if (keywords.includes('invoice') || keywords.includes('bill')) return ['Finance', 'Invoices'];
    if (keywords.includes('project') || keywords.includes('task')) return ['Projects', 'Work'];
    if (keywords.includes('contract') || keywords.includes('agreement')) return ['Legal', 'Contracts'];
    return ['Archive', 'General'];
  };

  const archiveEmail = (emailId: string, folder: string) => {
    const email = items.find((e) => e.id === emailId);
    if (!email) return;

    setUndoStack((prev) => [...prev, items]);
    setArchived((prev) => new Set(prev).add(emailId));
    onArchive?.(emailId, folder);
    toast.success(`Archived to "${folder}"`);
  };

  const undoArchive = () => {
    if (undoStack.length === 0) {
      toast.error('Rien à annuler');
      return;
    }
    const prevState = undoStack[undoStack.length - 1];
    setItems(prevState);
    setUndoStack((prev) => prev.slice(0, -1));
    setArchived(new Set());
    toast.info('Action undone');
  };

  const getEmailFolders = (email: ArchiverEmail): string[] => {
    return email.suggestedFolder ? [email.suggestedFolder] : suggestFolders(email);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Smart Email Archiver
        </CardTitle>
        <Button
          onClick={undoArchive}
          disabled={undoStack.length === 0}
          variant="outline"
          size="sm"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Undo
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No emails to archive</p>
          ) : (
            items.map((email) => {
              const folders = getEmailFolders(email);
              const isArchived = archived.has(email.id);

              return (
                <div
                  key={email.id}
                  className={`p-3 border rounded-lg transition-colors ${
                    isArchived ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{email.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{email.from}</span>
                        <span className="text-xs text-gray-400">{email.date}</span>
                      </div>
                    </div>
                  </div>
                  {!isArchived && (
                    <div className="flex gap-2 flex-wrap items-center">
                      <Lightbulb className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      <div className="flex gap-1 flex-wrap">
                        {folders.map((folder) => (
                          <Button
                            key={folder}
                            onClick={() => archiveEmail(email.id, folder)}
                            variant="outline"
                            size="xs"
                            className="h-7 text-xs"
                          >
                            <Folder className="h-3 w-3 mr-1" />
                            {folder}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
