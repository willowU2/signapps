/**
 * AI Mail API — typed helpers that wrap the generic AI chat endpoint
 * with mail-specific prompts.
 */
import { aiApi } from '@/lib/api/ai';

export const aiMailApi = {
  /**
   * Suggest 3 reply options for an email body.
   */
  suggestReply: (emailBody: string, context?: string) =>
    aiApi.chat(
      `Suggest 3 reply options for this email:\n${emailBody}\n${context || ''}`,
      { language: 'fr' },
    ),

  /**
   * Summarise a thread from an array of message texts.
   */
  summarizeThread: (messages: string[]) =>
    aiApi.chat(
      `Summarize this email thread:\n${messages.join('\n---\n')}`,
      { language: 'fr' },
    ),

  /**
   * Extract action items from an email body as a JSON array.
   */
  extractActions: (emailBody: string) =>
    aiApi.chat(
      `Extract action items from this email as JSON array:\n${emailBody}`,
      { language: 'fr' },
    ),

  /**
   * Rewrite an email body in the requested tone.
   * @param body    current email body text
   * @param tone    e.g. "Plus formel", "Plus amical", "Plus concis", "Plus persuasif"
   */
  rewriteTone: (body: string, tone: string) =>
    aiApi.chat(
      `Réécris ce texte d'email avec un ton "${tone}". Renvoie uniquement le corps réécrit, sans explication:\n\n${body}`,
      { language: 'fr' },
    ),

  /**
   * Translate an email body to the target language.
   * @param body     email body text (plain or HTML)
   * @param targetLang e.g. "FR", "EN", "ES", "DE"
   */
  translate: (body: string, targetLang: string) =>
    aiApi.chat(
      `Traduis ce texte d'email en ${targetLang}. Renvoie uniquement la traduction:\n\n${body}`,
      { language: 'fr' },
    ),

  /**
   * Analyse an email draft and return structured coaching feedback.
   * The response is expected to be JSON with keys: length, tone, clarity, cta.
   */
  coachDraft: (body: string) =>
    aiApi.chat(
      `Analyse ce brouillon d'email et renvoie un objet JSON STRICT (sans markdown, sans explication) avec exactement ces 4 clés:
{
  "length": "OK" | "Trop long (>500 mots)" | "Trop court",
  "tone": "Professionnel" | "Informel" | "Agressif detecte",
  "clarity": "Claire" | "Confuse — simplifier",
  "cta": "CTA presente" | "Pas d'appel a l'action"
}

Brouillon:\n${body}`,
      { language: 'fr' },
    ),
};
