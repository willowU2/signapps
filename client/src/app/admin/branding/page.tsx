'use client';

/**
 * WL1: Admin Branding Page
 *
 * Allows tenant admins to configure white-label settings:
 *  - Logo upload / URL
 *  - Primary brand color
 *  - Favicon URL
 *  - App name override
 *
 * Changes are applied via PUT /api/v1/tenants/:id/branding and take effect
 * immediately via CSS variables injected in the root layout.
 */

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette, Upload, Eye, RotateCcw, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantBranding {
  logo_url?: string;
  primary_color?: string;
  favicon_url?: string;
  app_name?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrandingPage() {
  usePageTitle('Branding');

  const [branding, setBranding] = useState<TenantBranding>({});
  const [original, setOriginal] = useState<TenantBranding>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // ── Load current branding ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        // First get the current tenant
        const tenantRes = await fetch('/api/v1/tenant', { credentials: 'include' });
        if (!tenantRes.ok) throw new Error('Failed to load tenant');
        const tenant = await tenantRes.json();
        setTenantId(tenant.id);

        // Then load branding
        const brandingRes = await fetch(`/api/v1/tenants/${tenant.id}/branding`, {
          credentials: 'include',
        });
        if (brandingRes.ok) {
          const data = await brandingRes.json();
          setBranding(data.branding ?? {});
          setOriginal(data.branding ?? {});
        }
      } catch (err) {
        toast.error('Failed to load branding settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Save branding ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/tenants/${tenantId}/branding`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Save failed');
      }

      const data = await res.json();
      setBranding(data.branding ?? branding);
      setOriginal(data.branding ?? branding);

      // Apply CSS variable immediately
      if (branding.primary_color) {
        document.documentElement.style.setProperty('--brand-primary', branding.primary_color);
      }

      toast.success('Branding saved successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset branding ─────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/v1/tenants/${tenantId}/branding`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Reset failed');

      setBranding({});
      setOriginal({});
      document.documentElement.style.removeProperty('--brand-primary');
      toast.success('Branding reset to defaults');
    } catch {
      toast.error('Failed to reset branding');
    }
  };

  const isDirty = JSON.stringify(branding) !== JSON.stringify(original);

  // ── Preview — apply CSS vars live ─────────────────────────────────────────
  useEffect(() => {
    if (!previewMode) return;
    if (branding.primary_color) {
      document.documentElement.style.setProperty('--brand-primary-preview', branding.primary_color);
    }
  }, [branding.primary_color, previewMode]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Branding</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Customize the look and feel for your tenant (white-label settings).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye className="size-4" />
              {previewMode ? 'Stop Preview' : 'Preview'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              <RotateCcw className="size-4" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  id="logo_url"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={branding.logo_url ?? ''}
                  onChange={(e) => setBranding((b) => ({ ...b, logo_url: e.target.value || undefined }))}
                />
                <Button variant="outline" size="sm" className="shrink-0">
                  <Upload className="size-4" />
                  Upload
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                PNG or SVG recommended. Will appear in the sidebar and login page.
              </p>
            </div>
            {branding.logo_url && (
              <div className="rounded-md border bg-muted/40 p-4 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={branding.logo_url}
                  alt="Logo preview"
                  className="max-h-16 max-w-48 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* App Name */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">App Name</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="app_name">Application Name</Label>
            <Input
              id="app_name"
              placeholder="SignApps"
              maxLength={64}
              value={branding.app_name ?? ''}
              onChange={(e) => setBranding((b) => ({ ...b, app_name: e.target.value || undefined }))}
            />
            <p className="text-xs text-muted-foreground">
              Displayed in the browser title bar, email footers, and login page.
              Leave empty to use &ldquo;SignApps&rdquo;.
            </p>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand Colors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="primary_color_picker"
                  value={branding.primary_color ?? '#6366f1'}
                  onChange={(e) =>
                    setBranding((b) => ({ ...b, primary_color: e.target.value }))
                  }
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  id="primary_color"
                  placeholder="#6366f1"
                  maxLength={7}
                  value={branding.primary_color ?? ''}
                  onChange={(e) =>
                    setBranding((b) => ({ ...b, primary_color: e.target.value || undefined }))
                  }
                  className="font-mono w-32"
                />
                {branding.primary_color && (
                  <div
                    className="size-9 rounded-md border"
                    style={{ backgroundColor: branding.primary_color }}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Applied as the primary accent color throughout the UI. Hex format required (e.g. #1a73e8).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Favicon */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Favicon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="favicon_url">Favicon URL</Label>
            <Input
              id="favicon_url"
              type="url"
              placeholder="https://example.com/favicon.ico"
              value={branding.favicon_url ?? ''}
              onChange={(e) =>
                setBranding((b) => ({ ...b, favicon_url: e.target.value || undefined }))
              }
            />
            <p className="text-xs text-muted-foreground">
              ICO or 32×32 PNG. Shown in browser tabs and bookmarks.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
