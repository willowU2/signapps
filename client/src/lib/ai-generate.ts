/**
 * AI content generation — local LLM integration via Ollama
 */

const OLLAMA_BASE = "http://localhost:11434";

export interface GenerateOptions {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface GenerateResult {
  text: string;
  model: string;
  duration: number;
}

/**
 * Generate text with local Ollama LLM
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const start = Date.now();
  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model || "llama3.2",
      prompt: options.prompt,
      system: options.system || "Tu es un assistant professionnel. Reponds en francais.",
      stream: false,
      options: {
        num_predict: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
      },
    }),
  });
  const data = await response.json();
  return {
    text: data.response || "",
    model: options.model || "llama3.2",
    duration: Date.now() - start,
  };
}

/**
 * Summarize text
 */
export function summarize(text: string): Promise<GenerateResult> {
  return generate({ prompt: `Resume ce texte en 2-3 phrases:\n\n${text}`, temperature: 0.3 });
}

/**
 * Translate text
 */
export function translate(text: string, targetLang: string): Promise<GenerateResult> {
  return generate({ prompt: `Traduis en ${targetLang}:\n\n${text}`, temperature: 0.2 });
}

/**
 * Reformulate text
 */
export function reformulate(text: string, style: "formal" | "casual" | "concise"): Promise<GenerateResult> {
  const styles = { formal: "formel et professionnel", casual: "decontracte et amical", concise: "court et direct" };
  return generate({ prompt: `Reformule ce texte en style ${styles[style]}:\n\n${text}`, temperature: 0.5 });
}
