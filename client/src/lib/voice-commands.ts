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
  const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.("Speech API non supportee");
    return null;
  }
  const recognition = new (SpeechRecognition as new () => SpeechRecognition)();
  recognition.lang = "fr-FR";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e: SpeechRecognitionEvent) => { onResult(e.results[0][0].transcript); };
  recognition.onerror = (e: SpeechRecognitionErrorEvent) => { onError?.(e.error); };
  recognition.start();
  return () => recognition.stop();
}
