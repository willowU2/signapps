'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranslationMemory } from '@/components/i18n/translation-memory';
import { GlossaryManager } from '@/components/i18n/glossary-manager';
import { InContextEditor } from '@/components/i18n/in-context-editor';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Languages } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SUPPORTED_LOCALES = [
  { code: 'fr', label: 'Français', dir: 'ltr', status: 'complete' },
  { code: 'en', label: 'English', dir: 'ltr', status: 'complete' },
  { code: 'de', label: 'Deutsch', dir: 'ltr', status: 'partial' },
  { code: 'es', label: 'Español', dir: 'ltr', status: 'partial' },
  { code: 'ar', label: 'العربية', dir: 'rtl', status: 'in_progress' },
  { code: 'he', label: 'עברית', dir: 'rtl', status: 'in_progress' },
];

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  complete: 'default',
  partial: 'secondary',
  in_progress: 'outline',
};

export default function I18nAdminPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Internationalization</h1>
              <p className="text-muted-foreground">Manage translations, glossaries and locale settings</p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supported Languages</CardTitle>
            <CardDescription>Language coverage overview — RTL languages (Arabic, Hebrew) are fully supported</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {SUPPORTED_LOCALES.map(l => (
                <div key={l.code} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                  <span className="font-medium text-sm">{l.label}</span>
                  <Badge variant="outline" className="text-xs">{l.code.toUpperCase()}</Badge>
                  {l.dir === 'rtl' && <Badge variant="outline" className="text-xs text-orange-600">RTL</Badge>}
                  <Badge variant={STATUS_VARIANTS[l.status]} className="text-xs capitalize">{l.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="editor">
          <TabsList>
            <TabsTrigger value="editor">In-Context Editor</TabsTrigger>
            <TabsTrigger value="memory">Translation Memory</TabsTrigger>
            <TabsTrigger value="glossary">Glossary</TabsTrigger>
          </TabsList>
          <TabsContent value="editor"><InContextEditor /></TabsContent>
          <TabsContent value="memory"><TranslationMemory /></TabsContent>
          <TabsContent value="glossary"><GlossaryManager /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
