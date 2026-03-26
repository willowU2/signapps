'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileSignature, Plus, Trash2, Edit, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { socialApi, Signature } from '@/lib/api/social';

// ── Signature Settings Page Section ──────────────────────────────────

export function PostSignatures() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [autoAdd, setAutoAdd] = useState(false);

  const fetchSignatures = useCallback(async () => {
    try {
      setLoading(true);
      const res = await socialApi.signatures.list();
      setSignatures(res.data);
    } catch {
      toast.error('Failed to load signatures');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  const resetForm = () => {
    setName('');
    setContent('');
    setAutoAdd(false);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (sig: Signature) => {
    setEditingId(sig.id);
    setName(sig.name);
    setContent(sig.content);
    setAutoAdd(sig.autoAdd);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        const res = await socialApi.signatures.update(editingId, {
          name: name.trim(),
          content: content.trim(),
          autoAdd,
        });
        setSignatures((prev) =>
          prev.map((s) => (s.id === editingId ? res.data : s)),
        );
        toast.success('Signature updated');
      } else {
        const res = await socialApi.signatures.create({
          name: name.trim(),
          content: content.trim(),
          autoAdd,
        });
        setSignatures((prev) => [...prev, res.data]);
        toast.success('Signature created');
      }
      setDialogOpen(false);
      resetForm();
    } catch {
      toast.error(editingId ? 'Failed to update signature' : 'Failed to create signature');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await socialApi.signatures.delete(id);
      setSignatures((prev) => prev.filter((s) => s.id !== id));
      toast.success('Signature deleted');
    } catch {
      toast.error('Failed to delete signature');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Post Signatures</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Post Signatures</h3>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Add Signature
        </Button>
      </div>

      {signatures.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          <FileSignature className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No signatures yet.</p>
          <p className="text-xs mt-1">
            Create reusable text signatures to append to your posts.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {signatures.map((sig) => (
            <Card key={sig.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{sig.name}</span>
                    {sig.autoAdd && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <Check className="h-3 w-3 mr-0.5" />
                        Auto
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(sig)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(sig.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {sig.content}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Signature preview */}
      {signatures.some((s) => s.autoAdd) && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Auto-appended signature preview
          </p>
          <Separator />
          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
            {signatures
              .filter((s) => s.autoAdd)
              .map((s) => s.content)
              .join('\n')}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Signature' : 'New Signature'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sig-name">Name</Label>
              <Input
                id="sig-name"
                placeholder="e.g. Company footer, Personal sign-off"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sig-content">Content</Label>
              <Textarea
                id="sig-content"
                placeholder="Your signature text...&#10;e.g. — Sent from SignApps Social"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sig-auto">Auto-append to every post</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically add this signature to new posts
                </p>
              </div>
              <Switch
                id="sig-auto"
                checked={autoAdd}
                onCheckedChange={setAutoAdd}
              />
            </div>

            {/* Live preview */}
            {content.trim() && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Preview</p>
                <div className="text-sm text-muted-foreground">
                  Your post content here...
                </div>
                <Separator className="my-1" />
                <div className="text-sm whitespace-pre-wrap">{content}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || !content.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Signature'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Compact Signature Selector (for Post Composer) ───────────────────

interface SignatureSelectorProps {
  onSelect: (signatureContent: string) => void;
}

export function SignatureSelector({ onSelect }: SignatureSelectorProps) {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await socialApi.signatures.list();
        if (!cancelled) setSignatures(res.data);
      } catch {
        // silent -- selector is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || signatures.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() => setOpen(!open)}
      >
        <FileSignature className="h-3.5 w-3.5" />
        Signature
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute bottom-full left-0 mb-1 z-50 w-56 rounded-lg border bg-popover p-1 shadow-md">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Append signature
            </p>
            {signatures.map((sig) => (
              <button
                key={sig.id}
                onClick={() => {
                  onSelect(sig.content);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate">{sig.name}</span>
                {sig.autoAdd && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Auto
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
