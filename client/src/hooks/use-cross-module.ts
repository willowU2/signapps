"use client";

/**
 * use-cross-module.ts — AI / Drive / Docs / Social cross-module utilities.
 * Used by all 30 interoperability feature components.
 */

import { useCallback } from "react";
import { aiApi } from "@/lib/api/ai";
import { driveApi } from "@/lib/api/drive";

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function docEditorUrl(targetId: string, name: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/docs/editor?id=${encodeURIComponent(targetId)}&name=${encodeURIComponent(name)}`;
}

export function driveNodeUrl(nodeId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/global-drive?node=${encodeURIComponent(nodeId)}`;
}

async function aiChat(prompt: string, systemPrompt: string): Promise<string> {
  const res = await aiApi.chat(prompt, { systemPrompt, language: "fr" });
  return res.data?.answer ?? "";
}

export function useSummarizeDoc() {
  return useCallback(async (text: string): Promise<string> => {
    return aiChat(
      `Résume ce texte de manière concise en bullet points clairs :\n\n${text.slice(0, 6000)}`,
      "Tu es un assistant de résumé de documents professionnels.",
    );
  }, []);
}

export function useTranslateDoc() {
  return useCallback(
    async (text: string, targetLang: string): Promise<string> => {
      return aiChat(
        `Traduis le texte suivant en ${targetLang}. Retourne uniquement le texte traduit.\n\n${text.slice(0, 6000)}`,
        "Tu es un traducteur professionnel.",
      );
    },
    [],
  );
}

export function useExtractKeywords() {
  return useCallback(async (text: string): Promise<string[]> => {
    const answer = await aiChat(
      `Extrais les 10 mots-clés SEO les plus importants de ce texte. Retourne uniquement une liste séparée par des virgules.\n\n${text.slice(0, 4000)}`,
      "Tu es un expert SEO. Retourne uniquement les mots-clés séparés par des virgules.",
    );
    return answer
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 10);
  }, []);
}

export function useProofreadDoc() {
  return useCallback(async (text: string): Promise<string> => {
    return aiChat(
      `Corrige les fautes d'orthographe et de grammaire. Retourne uniquement le texte corrigé.\n\n${text.slice(0, 6000)}`,
      "Tu es un correcteur professionnel.",
    );
  }, []);
}

export function useGenerateSocialPost() {
  return useCallback(
    async (summary: string, platform: string): Promise<string> => {
      return aiChat(
        `À partir de ce résumé, génère un post social engageant pour ${platform} (max 280 caractères) :\n\n${summary.slice(0, 2000)}`,
        "Tu es un expert en marketing des réseaux sociaux.",
      );
    },
    [],
  );
}

export function useGenerateDocFromPrompt() {
  return useCallback(async (prompt: string): Promise<string> => {
    return aiChat(
      `Rédige un document complet et structuré en Markdown sur : ${prompt}`,
      "Tu es un rédacteur professionnel. Utilise des titres, paragraphes et listes.",
    );
  }, []);
}

export function useSuggestRelatedDocs() {
  return useCallback(
    async (title: string, content: string): Promise<string[]> => {
      const answer = await aiChat(
        `Pour le document "${title}" :\n${content.slice(0, 2000)}\n\nSugère 5 titres de documents connexes utiles. Retourne uniquement les titres, un par ligne.`,
        "Tu es un assistant de gestion de connaissances.",
      );
      return answer
        .split("\n")
        .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
    },
    [],
  );
}

export function useAutoTagFile() {
  return useCallback(
    async (filename: string, mimeType: string): Promise<string[]> => {
      const answer = await aiChat(
        `Génère 5 tags pertinents pour un fichier nommé "${filename}" de type "${mimeType}". Retourne uniquement les tags séparés par des virgules.`,
        "Tu es un assistant d'organisation de fichiers.",
      );
      return answer
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5);
    },
    [],
  );
}

export async function uploadTextToDrive(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const file = new File([blob], filename, { type: "text/plain" });
  return driveApi.uploadFile(file, null);
}
