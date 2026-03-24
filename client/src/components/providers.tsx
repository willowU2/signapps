'use client';
import { SpinnerInfinity } from 'spinners-react';


import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { get, set, del } from 'idb-keyval';
import { useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/components/auth/auth-provider';
import { PermissionsProvider } from '@/lib/permissions';
import { TenantProvider } from '@/lib/tenant';
import { PreferencesProvider } from '@/lib/preferences';

import { NotificationPermissionDialog } from '@/components/notifications/notification-permission-dialog';
import { CommandBar } from '@/components/layout/command-bar';
import { Sidebar } from '@/components/layout/sidebar';
import { RightSidebar } from '@/components/layout/right-sidebar';
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalModals } from '@/components/global-modals';
import { GlobalHooks } from '@/components/global-hooks';

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2">
        <SpinnerInfinity size={32} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} />
        <span>Loading...</span>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 1000 * 60 * 60 * 24, // 24 hours caching offline
            retry: false,
          },
        },
      })
  );

  const [persister] = useState(() => ({
    persistClient: async (client: any) => {
      try {
        await set('react-query-cache', client);
      } catch (e) {
        console.warn('IDB store failed', e);
      }
    },
    restoreClient: async () => {
      try {
        return await get('react-query-cache');
      } catch (e) {
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del('react-query-cache');
      } catch (e) {}
    },
  }));

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <Suspense fallback={<LoadingFallback />}>
            <AuthProvider>
              <TenantProvider>
                <PreferencesProvider>
                  <PermissionsProvider>
                    {children}
                    {!pathname?.startsWith('/login') && (
                      <>
                        <CommandBar />
                        <Sidebar />
                        <RightSidebar />
                      </>
                    )}
                    <GlobalModals />
                    <GlobalHooks />
                  </PermissionsProvider>
                </PreferencesProvider>
              </TenantProvider>
            </AuthProvider>
          </Suspense>
          <Toaster />
          <NotificationPermissionDialog />
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
