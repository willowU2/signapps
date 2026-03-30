/**
 * Voice command engine — STT + command parsing
 * Uses Web Speech API as fallback (Whisper.rs integration planned)
 */

export interface VoiceCommand {
  pattern: RegExp;
  action: string;
  params?: string[];
}

const COMMANDS: VoiceCommand[] = [
  { pattern: /cr[ée]+r?\s+(?:une?\s+)?t[aâ]che\s+(.+)/i, action: "task.create", params: ["title"] },
  { pattern: /envoyer?\s+(?:un?\s+)?(?:e-?)?mail\s+[àa]\s+(.+)/i, action: "email.compose", params: ["to"] },
  { pattern: /planifier?\s+(?:une?\s+)?r[ée]union\s+(.+)/i, action: "meeting.schedule", params: ["title"] },
  { pattern: /rechercher?\s+(.+)/i, action: "search", params: ["query"] },
  { pattern: /aller?\s+(?:au?x?\s+)?(.+)/i, action: "navigate", params: ["destination"] },
  { pattern: /ouvrir?\s+(.+)/i, action: "open", params: ["target"] },
  { pattern: /dicter?\s+(?:un?\s+)?email/i, action: "email.dictate", params: [] },
  { pattern: /wiki|base\s+de\s+connaissance/i, action: "navigate", params: ["destination"] },
];

export interface ParsedCommand {
  action: string;
  params: Record<string, string>;
  raw: string;
}

export function parseVoiceCommand(transcript: string): ParsedCommand | null {
  const clean = transcript.trim();
  for (const cmd of COMMANDS) {
    const match = clean.match(cmd.pattern);
    if (match) {
      const params: Record<string, string> = {};
      (cmd.params || []).forEach((p, i) => { params[p] = match[i + 1] || ""; });
      return { action: cmd.action, params, raw: clean };
    }
  }
  return null;
}

/**
 * Start listening with Web Speech API
 */
export function startListening(onResult: (transcript: string) => void, onError?: (err: string) => void): (() => void) | null {
  type RecognitionInstance = { lang: string; continuous: boolean; interimResults: boolean; onresult: unknown; onerror: unknown; start: () => void; stop: () => void };
  type SpeechRecognitionCtor = new () => RecognitionInstance;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) {
    onError?.("Speech API non supportee");
    return null;
  }
  const recognition = new SR();
  recognition.lang = "fr-FR";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e: { results: { 0: { 0: { transcript: string } } } }) => { onResult(e.results[0][0].transcript); };
  recognition.onerror = (e: { error: string }) => { onError?.(e.error); };
  recognition.start();
  return () => recognition.stop();
}
