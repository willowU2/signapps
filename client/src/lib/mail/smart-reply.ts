/**
 * Smart email reply suggestions using local LLM
 */

const OLLAMA_BASE = "http://localhost:11434";

export interface SmartReply {
  text: string;
  tone: "positive" | "neutral" | "decline";
}

/**
 * Generate 3 short reply suggestions for an email
 */
export async function generateSmartReplies(
  emailBody: string,
  senderName: string,
): Promise<SmartReply[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: `Genere exactement 3 reponses courtes (1-2 phrases max) a cet email de ${senderName}. Format JSON: [{"text":"...","tone":"positive|neutral|decline"}]\n\nEmail:\n${emailBody.slice(0, 500)}`,
        system:
          "Tu es un assistant email professionnel. Reponds en JSON uniquement.",
        stream: false,
        options: { num_predict: 200, temperature: 0.7 },
      }),
    });
    const data = await response.json();
    try {
      return JSON.parse(data.response);
    } catch {
      return getDefaultReplies();
    }
  } catch {
    return getDefaultReplies();
  }
}

function getDefaultReplies(): SmartReply[] {
  return [
    {
      text: "Merci, bien recu. Je reviens vers vous rapidement.",
      tone: "positive",
    },
    { text: "Bien note, je vais y reflechir.", tone: "neutral" },
    {
      text: "Merci pour votre message. Ce n'est pas possible pour le moment.",
      tone: "decline",
    },
  ];
}
