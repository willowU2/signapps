"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { PreferencesPage } from "@/lib/preferences";
import { usePageTitle } from '@/hooks/use-page-title';

export default function SettingsPreferencesPage() {
  usePageTitle('Preferences');
  return (
    <AppLayout>
      <div className="w-full py-2">
        <PreferencesPage />
      </div>
    </AppLayout>
  );
}
