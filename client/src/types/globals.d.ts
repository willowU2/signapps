// Web Speech API — not yet in TypeScript's standard dom lib.
// Defines the SpeechRecognition interface and constructor for browsers that expose it.
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

declare global {
  interface Window {
    __signAppsAddConflict?: (
      type: 'merge' | 'auto-resolved' | 'overwritten',
      affectedBy: string[],
      description: string
    ) => void;
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
    katex?: {
      renderToString: (tex: string, options?: { displayMode?: boolean; throwOnError?: boolean }) => string;
    };
  }
  var scheduler: { yield: () => Promise<void> } | undefined;
}
export {};
