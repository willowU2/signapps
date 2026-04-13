"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { AgentChat } from "@/components/social/agent-chat";

export default function AgentPage() {
  usePageTitle("Social — Agent IA");
  return <AgentChat />;
}
