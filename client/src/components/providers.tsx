"use client";
import { SpinnerInfinity } from "spinners-react";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { get, set, del } from "idb-keyval";
import { useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PermissionsProvider } from "@/lib/permissions";
import { TenantProvider } from "@/lib/tenant";
import { PreferencesProvider } from "@/lib/preferences";
import { AccessibilityProvider } from "@/components/accessibility/a11y-provider";

import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalHooks } from "@/components/global-hooks";
import { useServiceWorker } from "@/hooks/use-service-worker";
import { GlobalPolling } from "@/components/global-polling";
import { ThemeInitializer } from "@/components/theme-initializer";
import { RouteProgressBar } from "@/components/layout/route-progress-bar";
import { PasswordExpiryBanner } from "@/components/auth/password-expiry-banner";
import { installConsoleFilter } from "@/lib/console-filter";
import dynamic from "next/dynamic";

// Install the benign-warning filter as soon as the client module loads.
// See `lib/console-filter.ts` for the list of silenced patterns.
installConsoleFilter();

// AQ-PERF (J1 2026-04-18): these components are always rendered on the
// full-app shell (after /login) but none of them is visible on first paint.
// Loading them dynamically with `ssr: false` keeps the main shared chunk
// slim — saves ~110 kB gzipped of `cmdk` + `lucide-react` icons from the
// per-route first-load across the whole app.
const NotificationPermissionDialog = dynamic(
  () =>
    import("@/components/notifications/notification-permission-dialog").then(
      (m) => m.NotificationPermissionDialog,
    ),
  { ssr: false },
);
const CommandBar = dynamic(
  () => import("@/components/layout/command-bar").then((m) => m.CommandBar),
  { ssr: false },
);
const RadialMenu = dynamic(
  () => import("@/components/layout/radial-menu").then((m) => m.RadialMenu),
  { ssr: false },
);
const GlobalModals = dynamic(
  () => import("@/components/global-modals").then((m) => m.GlobalModals),
  { ssr: false },
);
const OnboardingWizard = dynamic(
  () =>
    import("@/components/onboarding/onboarding-wizard").then(
      (m) => m.OnboardingWizard,
    ),
  { ssr: false },
);
const MobileBottomNav = dynamic(
  () =>
    import("@/components/layout/mobile-bottom-nav").then(
      (m) => m.MobileBottomNav,
    ),
  { ssr: false },
);
const PwaInstallPrompt = dynamic(
  () =>
    import("@/components/pwa/pwa-install-prompt").then(
      (m) => m.PwaInstallPrompt,
    ),
  { ssr: false },
);
const DragDropOverlay = dynamic(
  () => import("@/components/drag-drop-overlay").then((m) => m.DragDropOverlay),
  { ssr: false },
);
const QuickDocumentSwitcher = dynamic(
  () =>
    import("@/components/layout/quick-switcher").then(
      (m) => m.QuickDocumentSwitcher,
    ),
  { ssr: false },
);
const FirstRunDialog = dynamic(
  () => import("@/components/first-run-dialog").then((m) => m.FirstRunDialog),
  { ssr: false },
);
const OfflineBanner = dynamic(
  () =>
    import("@/components/layout/offline-banner").then((m) => m.OfflineBanner),
  { ssr: false },
);
// PomodoroTimer removed from global UI

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2">
        <SpinnerInfinity
          size={32}
          secondaryColor="rgba(128,128,128,0.2)"
          color="currentColor"
          speed={120}
        />
        <span>Chargement...</span>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useServiceWorker();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 min cache
            gcTime: 1000 * 60 * 60 * 24, // 24 hours caching offline
            retry: 2, // Retry failed requests twice
            refetchOnWindowFocus: false, // Don't refetch on tab switch
            refetchOnReconnect: true, // Refetch when network reconnects
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  const [persister] = useState(() => ({
    persistClient: async (client: any) => {
      try {
        await set("react-query-cache", client);
      } catch (e) {
        // IDB persistence not available; cache will not persist
      }
    },
    restoreClient: async () => {
      try {
        // Add a 5s timeout to prevent blocking the Suspense boundary
        // indefinitely when IndexedDB is slow (e.g., Playwright headless).
        const result = await Promise.race([
          get("react-query-cache"),
          new Promise<undefined>((resolve) =>
            setTimeout(() => resolve(undefined), 5000),
          ),
        ]);
        return result;
      } catch (e) {
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del("react-query-cache");
      } catch (e) {}
    },
  }));

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <AuthProvider>
                <TenantProvider>
                  <PreferencesProvider>
                    <AccessibilityProvider>
                      <PermissionsProvider>
                        <RouteProgressBar />
                        {!pathname?.startsWith("/login") && (
                          <PasswordExpiryBanner />
                        )}
                        {children}
                        {!pathname?.startsWith("/login") && (
                          <>
                            <CommandBar />
                            <RadialMenu />
                            <MobileBottomNav />
                            <PwaInstallPrompt />
                            <QuickDocumentSwitcher />
                          </>
                        )}
                        <GlobalModals />
                        <GlobalHooks />
                        <GlobalPolling />
                        <ThemeInitializer />
                        <DragDropOverlay />
                        <OnboardingWizard />
                        <FirstRunDialog />
                        <OfflineBanner />
                      </PermissionsProvider>
                    </AccessibilityProvider>
                  </PreferencesProvider>
                </TenantProvider>
              </AuthProvider>
            </Suspense>
          </ErrorBoundary>
          <Toaster />
          <NotificationPermissionDialog />
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
