import path from "path";

const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  typescript: {
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

export default nextConfig;
