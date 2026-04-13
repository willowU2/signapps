"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { LinkInBioEditor } from "@/components/social/link-in-bio-editor";

export default function LinkInBioPage() {
  usePageTitle("Social — Link in Bio");
  return <LinkInBioEditor />;
}
