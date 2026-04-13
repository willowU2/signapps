"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { MediaLibrary } from "@/components/social/media-library";

export default function SocialMediaPage() {
  usePageTitle("Social — Médiathèque");
  return <MediaLibrary />;
}
