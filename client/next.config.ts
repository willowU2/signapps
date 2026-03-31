import path from "path";
import withSerwistInit from "@serwist/next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  async headers() {
    return [
      {
        // Immutable cache for hashed static assets — safe to cache forever
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // AQ-CACH: long-lived cache for public images and fonts
        source: '/images/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // AQ-CACH: icons and manifest
        source: '/favicon(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          // NOTE (C6 - accepted risk): 'unsafe-eval' is required by the formula evaluator
          // (Function() constructor in client/src/lib/sheets/formula.ts) and by several
          // third-party libraries (monaco-editor, Tiptap extensions, Serwist service worker
          // compilation). Removing it would break the spreadsheet/macro editor.
          // Mitigation: the formula evaluator has been hardened (C1) — strict length limit +
          // identifier rejection — so the actual injection surface is minimal.
          // TODO: replace Function() with a pure recursive-descent parser to allow removing
          // 'unsafe-eval' entirely.
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://localhost:*; connect-src 'self' http://localhost:* ws://localhost:*; font-src 'self' data:; media-src 'self' blob:; frame-src 'self'" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'http' as const, hostname: 'localhost' },
      { protocol: 'https' as const, hostname: '**.signapps.local' },
      { protocol: 'https' as const, hostname: 'raw.githubusercontent.com' },
      { protocol: 'https' as const, hostname: '**.github.io' },
      { protocol: 'https' as const, hostname: 'cdn.jsdelivr.net' },
      { protocol: 'https' as const, hostname: '**' },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {
    root: path.resolve(__dirname, ".."),
    resolveAlias: {
      // onnxruntime-web/wasm is used by @ricky0123/vad-web;
      // alias to the pre-built bundle so Turbopack doesn't try to
      // process native WASM imports at build time.
      "onnxruntime-web/wasm": "onnxruntime-web/dist/ort.min.js",
    },
  },
  serverExternalPackages: ["onnxruntime-web"],
};

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withAnalyzer(withSerwist(nextConfig));
