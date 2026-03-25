import path from "path";
import withSerwistInit from "@serwist/next";

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
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // AQ-CACH: long-lived cache for public images and fonts
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // AQ-CACH: icons and manifest
        source: '/favicon:path*',
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
        ],
      },
    ];
  },
  images: { unoptimized: true },
  typescript: {
    // TODO: Fix pre-existing TS errors (SpinnerInfinity props) then set to false
    ignoreBuildErrors: true,
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

export default withSerwist(nextConfig);
