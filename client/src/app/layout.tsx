import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/print.css";
import { Providers } from "@/components/providers";
import { ContextAssistant } from "@/components/ai/context-assistant";
import ClickSpark from "@/components/ui/click-spark";
import { PwaRegister } from "@/components/pwa-register";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { OfflineIndicator } from "@/components/offline-indicator";
import { FeedbackWidget } from "@/components/feedback-widget";
import { ErrorBoundary } from "@/components/error-boundary";
import { RTLProvider } from "@/components/i18n/rtl-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SignApps Platform",
  description: "Enterprise microservices management platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SignApps",
  },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* AQ-WCAG: skip-to-content link for keyboard/screen-reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded focus:text-sm focus:font-medium"
        >
          Aller au contenu principal
        </a>
        <ClickSpark sparkColor="var(--primary)" sparkSize={6} sparkRadius={20} sparkCount={8} duration={400}>
          <Providers>
            <RTLProvider>
              <ErrorBoundary>
                <main id="main-content" tabIndex={-1}>
                  {children}
                </main>
              </ErrorBoundary>
            </RTLProvider>
          </Providers>
          <ContextAssistant />
          <PwaRegister />
          <MobileBottomNav />
          <OfflineIndicator />
          <FeedbackWidget />
        </ClickSpark>
      </body>
    </html>
  );
}
