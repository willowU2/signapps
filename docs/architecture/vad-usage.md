# VAD (Voice Activity Detection) usage

`@ricky0123/vad-web` spawns its own Web Worker and AudioWorklet internally
for the Silero ONNX inference (see `vad.worklet.bundle.min.js` and the
`Worker` constructor inside `bundle.min.js` under `node_modules/@ricky0123/vad-web/dist/`).
No wrapper is needed at the P3 layer — the main thread only receives
start/stop events and `onSpeechEnd` classification results, which carry
small `Float32Array` frame buffers.

Callers continue importing the lib directly. Dynamic import is already
in place via the P2 lazy wrappers:

- `client/src/hooks/use-voice-chat.ts` — `await import("@ricky0123/vad-web")`
- `client/src/components/meet/mediapipe-lazy.tsx` — `import("@ricky0123/vad-web").then(...)`

The Turbopack alias on `onnxruntime-web/wasm -> onnxruntime-web/dist/ort.min.js`
(see `client/next.config.ts`) keeps the bundler from trying to process
the native WASM import at build time, and `serverExternalPackages:
["onnxruntime-web"]` keeps onnxruntime out of the SSR bundle.

## Why no wrapper?

At Wave W we considered wrapping the VAD in a dedicated worker
(`vad.worker.ts` + `vad-client.ts`) following the same pattern as the
formula and markdown workers. The audit showed:

1. The library already runs its ONNX inference in a worker/worklet,
   so adding another message-passing layer would only add postMessage
   overhead without reducing main-thread work.
2. The public API surface (`MicVAD.new({ onSpeechStart, onSpeechEnd,
   onFrameProcessed, ... })`) is callback-driven — wrapping it in a
   Promise-based client would lose the streaming semantics that the
   callers rely on.
3. The main-thread cost is limited to the `getUserMedia` setup and
   callback dispatch, which are already cheap.

## CSP implications

The VAD worker is same-origin (served from the Next.js asset pipeline)
so it falls under `worker-src 'self' blob:`, which is already in the
CSP after Wave W Task 4. If a future vendored bundle inlines the
worker as a blob URL, no CSP change is needed.
