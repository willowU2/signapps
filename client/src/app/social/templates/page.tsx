"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { TemplateLibrary } from "@/components/social/template-library";

export default function SocialTemplatesPage() {
  usePageTitle("Social — Modèles");
  return <TemplateLibrary />;
}
