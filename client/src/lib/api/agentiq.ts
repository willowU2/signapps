/**
 * AgentIQ API Client
 *
 * Thin wrapper around the Next.js proxy route for AgentIQ dashboard data.
 */

const BASE = "/api/agentiq";

export const agentiqApi = {
  dashboard: () => fetch(`${BASE}/dashboard`).then((r) => r.json()),
  ideas: () => fetch(`${BASE}/ideas`).then((r) => r.json()),
  reviewers: () => fetch(`${BASE}/reviewers`).then((r) => r.json()),
  subagents: () => fetch(`${BASE}/subagents`).then((r) => r.json()),
  guidelines: () => fetch(`${BASE}/guidelines`).then((r) => r.json()),
  decideIdea: (id: string, decision: string) =>
    fetch(`${BASE}/ideas/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }).then((r) => r.json()),
};
