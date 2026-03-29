'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, FileText, ArrowRight } from 'lucide-react';
import { useSocialStore } from '@/stores/social-store';
import { PostTemplate } from '@/lib/api/social';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['Announcement', 'Product Update', 'Tip', 'Question', 'Event', 'Promotion', 'Other'];

function CreateTemplateDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: Omit<PostTemplate, 'id' | 'createdAt'>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [category, setCategory] = useState('Other');
  const [isSaving, setIsSaving] = useState(false);

  const addHashtag = () => {
    const tag = hashtagInput.replace('#', '').trim();
    if (tag && !hashtags.includes(tag)) {
      setHashtags((prev) => [...prev, tag]);
    }
    setHashtagInput('');
  };

  const handleCreate = async () => {
    if (!name || !content) return;
    setIsSaving(true);
    try {
      await onCreate({ name, content, hashtags, category });
      setName('');
      setContent('');
      setHashtags([]);
      setHashtagInput('');
      setCategory('Other');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Template Name</Label>
            <Input
              placeholder="e.g. Product Launch Announcement"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    category === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Content</Label>
            <Textarea
              placeholder="Write your template content…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label>Hashtags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="#hashtag"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    addHashtag();
                  }
                }}
              />
              <Button variant="outline" onClick={addHashtag}>Add</Button>
            </div>
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hashtags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setHashtags((prev) => prev.filter((h) => h !== tag))}
                  >
                    #{tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleCreate} disabled={isSaving || !name || !content}>
              {isSaving ? 'Creating…' : 'Create Template'}
            </Button>
            <Button variant="outline" onClick={onClose}>Annuler</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TemplateLibrary() {
  const { templates, fetchTemplates, createTemplate, deleteTemplate } = useSocialStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const allCategories = ['All', ...CATEGORIES];

  const filtered = templates.filter((t) => {
    const matchCat = categoryFilter === 'All' || t.category === categoryFilter;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const useTemplate = (template: PostTemplate) => {
    // Navigate to compose with pre-filled content via URL params
    const params = new URLSearchParams({
      content: template.content + (template.hashtags.length ? '\n\n' + template.hashtags.map((h) => `#${h}`).join(' ') : ''),
    });
    router.push(`/social/compose?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Template Library</h2>
          <p className="text-sm text-muted-foreground">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="font-medium">
            {templates.length === 0 ? 'No templates yet' : 'No templates match your filters'}
          </p>
          {templates.length === 0 && (
            <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <Card key={template.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-tight">{template.name}</CardTitle>
                  <Badge variant="outline" className="text-xs shrink-0">{template.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-4">{template.content}</p>
                {template.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.hashtags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
                    ))}
                    {template.hashtags.length > 5 && (
                      <Badge variant="secondary" className="text-xs">+{template.hashtags.length - 5}</Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => useTemplate(template)}
                  >
                    Use Template
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTemplateDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={createTemplate}
      />
    </div>
  );
}
