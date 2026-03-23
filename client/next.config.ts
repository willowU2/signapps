import path from "path";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  images: { unoptimized: true },
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

export default withSerwist(nextConfig);
