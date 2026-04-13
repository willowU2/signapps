"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { AccountConnector } from "@/components/social/account-connector";

export default function SocialAccountsPage() {
  usePageTitle("Social — Comptes");
  return <AccountConnector />;
}
