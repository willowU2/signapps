"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { SocialInbox } from "@/components/social/social-inbox";

export default function SocialInboxPage() {
  usePageTitle("Social — Boîte de réception");
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Social Inbox</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Comments, mentions, and DMs from all platforms
        </p>
      </div>
      <SocialInbox />
    </div>
  );
}
