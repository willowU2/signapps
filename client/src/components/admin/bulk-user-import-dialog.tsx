'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { usersApi } from '@/lib/api/identity';
import { toast } from 'sonner';

interface ParsedUser {
  username: string;
  email: string;
  role: string;
  display_name?: string;
  valid: boolean;
  error?: string;
}

interface BulkUserImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

function parseCSV(text: string): ParsedUser[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const idxOf = (name: string) => header.findIndex(h => h.includes(name));
  const iUsername = idxOf('username') !== -1 ? idxOf('username') : 0;
  const iEmail = idxOf('email') !== -1 ? idxOf('email') : 1;
  const iRole = idxOf('role') !== -1 ? idxOf('role') : 2;
  const iDisplay = idxOf('display') !== -1 ? idxOf('display') : -1;

  return lines.slice(1).map((line, i) => {
    const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const username = cells[iUsername] || '';
    const email = cells[iEmail] || '';
    const role = cells[iRole] || 'user';
    const display_name = iDisplay >= 0 ? cells[iDisplay] : undefined;

    let error: string | undefined;
    if (!username) error = 'Missing username';
    else if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Email invalide';

    return { username, email, role, display_name, valid: !error, error };
  });
}

const ROLE_MAP: Record<string, number> = { admin: 2, user: 1, guest: 0 };

export function BulkUserImportDialog({ open, onOpenChange, onImported }: BulkUserImportDialogProps) {
  const [rows, setRows] = useState<ParsedUser[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRows(parseCSV(text));
    setResults(null);
  };

  const handleImport = async () => {
    const valid = rows.filter(r => r.valid);
    if (!valid.length) return;
    setImporting(true);
    let success = 0, failed = 0;
    await Promise.all(valid.map(async (r) => {
      try {
        await usersApi.create({
          username: r.username,
          email: r.email,
          password: Math.random().toString(36).slice(-10) + 'A1!',
          display_name: r.display_name,
          role: ROLE_MAP[r.role.toLowerCase()] ?? 1,
        });
        success++;
      } catch { failed++; }
    }));
    setImporting(false);
    setResults({ success, failed });
    if (success > 0) {
      toast.success(`${success} user(s) imported`);
      onImported();
    }
    if (failed > 0) toast.error(`${failed} user(s) failed`);
  };

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setRows([]); setResults(null); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk User Import (CSV)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm">Click to upload CSV or drag & drop</p>
            <p className="text-xs text-muted-foreground mt-1">
              Columns: <span className="font-mono">username, email, role, display_name</span>
            </p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>

          {rows.length > 0 && (
            <div className="flex gap-2 text-sm">
              <Badge variant="secondary">{rows.length} rows</Badge>
              <Badge className="bg-green-500/10 text-green-700">{validCount} valid</Badge>
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Display Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={r.valid ? '' : 'bg-red-500/5'}>
                    <TableCell>
                      {r.valid
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <span title={r.error}><AlertCircle className="h-4 w-4 text-red-500" /></span>
                      }
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.username}</TableCell>
                    <TableCell className="text-xs">{r.email}</TableCell>
                    <TableCell className="text-xs">{r.role}</TableCell>
                    <TableCell className="text-xs">{r.display_name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {results && (
          <div className="flex gap-3 text-sm">
            <span className="text-green-600 font-medium">{results.success} imported</span>
            {results.failed > 0 && <span className="text-red-500 font-medium">{results.failed} failed</span>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || importing}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Import {validCount} User{validCount !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
