/**
 * Register the Serwist-generated service worker (/sw.js).
 * Call this once from a client component on app mount.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "activated" &&
          navigator.serviceWorker.controller
        ) {
          // New version available -- could show a toast here in the future
          console.info("[SW] New service worker activated.");
        }
      });
    });

    console.info("[SW] Service worker registered:", registration.scope);
    return registration;
  } catch (error) {
    console.error("[SW] Registration failed:", error);
    return null;
  }
}
