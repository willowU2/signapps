"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { PreferencesPage } from "@/lib/preferences";

export default function SettingsPreferencesPage() {
  return (
    <AppLayout>
      <div className="w-full py-2">
        <PreferencesPage />
      </div>
    </AppLayout>
  );
}
