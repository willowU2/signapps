"use client";

import { useState, useCallback } from "react";
import { Mail, TrendingUp, Loader2, Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSocialStore } from "@/stores/social-store";
import { useAuthStore } from "@/lib/store";
import { mailApi } from "@/lib/api/mail";

// ─── S2: Social → Mail digest ─────────────────────────────────────────────────

/**
 * Builds an HTML email summarising social performance.
 */
function buildDigestHtml(params: {
  topPosts: { id: string; content: string; likesCount?: number; sharesCount?: number; commentsCount?: number; platform?: string }[];
  analytics: { totalFollowers?: number; followersGrowth?: number; totalReach?: number; engagementRate?: number } | null;
  period: string;
}): string {
  const { topPosts, analytics, period } = params;

  const postRows = topPosts
    .slice(0, 3)
    .map((p, i) => {
      const engagement = (p.likesCount ?? 0) + (p.sharesCount ?? 0) + (p.commentsCount ?? 0);
      const platform = p.platform ?? "—";
      const content = p.content.slice(0, 120) + (p.content.length > 120 ? "…" : "");
      return `
        <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
          <td style="padding:8px 12px;font-size:13px;color:#374151;">${i + 1}. ${content}</td>
          <td style="padding:8px 12px;font-size:13px;color:#6b7280;text-align:center;">${platform}</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#7c3aed;text-align:center;">${engagement.toLocaleString("fr-FR")}</td>
        </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:24px 32px;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">Digest Social — ${period}</h1>
      <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:14px;">Généré automatiquement par SignApps</p>
    </div>

    <div style="padding:24px 32px;">
      <h2 style="font-size:16px;color:#111827;margin:0 0 16px;">Vue d'ensemble</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:22px;font-weight:700;color:#7c3aed;">${analytics?.totalFollowers?.toLocaleString("fr-FR") ?? "—"}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Abonnés totaux</div>
          </td>
          <td style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;width:33%;margin:0 8px;">
            <div style="font-size:22px;font-weight:700;color:#2563eb;">${analytics?.totalReach?.toLocaleString("fr-FR") ?? "—"}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Portée totale</div>
          </td>
          <td style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:22px;font-weight:700;color:#059669;">${analytics?.followersGrowth != null ? (analytics.followersGrowth > 0 ? "+" : "") + analytics.followersGrowth.toLocaleString("fr-FR") : "—"}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Croissance abonnés</div>
          </td>
        </tr>
      </table>

      <h2 style="font-size:16px;color:#111827;margin:0 0 12px;">Top 3 posts par engagement</h2>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#ede9fe;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#7c3aed;font-weight:600;">Contenu</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#7c3aed;font-weight:600;">Plateforme</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#7c3aed;font-weight:600;">Engagement</th>
          </tr>
        </thead>
        <tbody>${postRows}</tbody>
      </table>

      <p style="font-size:12px;color:#9ca3af;margin-top:24px;text-align:center;">
        Digest généré le ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  </div>
</body>
</html>`;
}

interface SocialMailDigestProps {
  /** Optional CSS class for the wrapper */
  className?: string;
}

export function SocialMailDigest({ className }: SocialMailDigestProps) {
  const { analytics, topPosts, fetchAnalytics, isLoadingAnalytics } = useSocialStore();
  const { user } = useAuthStore();
  const [sending, setSending] = useState(false);

  const handleSendDigest = useCallback(async () => {
    if (!user?.email) {
      toast.error("Aucune adresse email trouvée pour votre compte.")
      return
    }

    // Fetch fresh data if not loaded yet
    if (!analytics) {
      await fetchAnalytics()
    }

    setSending(true)
    try {
      // Retrieve a mail account to send from
      const accountsRes = await mailApi.listAccounts()
      const accounts = accountsRes.data ?? []
      const accountId: string | undefined = Array.isArray(accounts) && accounts.length > 0
        ? accounts[0].id
        : undefined

      if (!accountId) {
        toast.error("Aucun compte mail configuré. Configurez un compte dans Paramètres → Mail.")
        return
      }

      const period = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      const bodyHtml = buildDigestHtml({ topPosts, analytics, period })

      await mailApi.sendEmail({
        account_id: accountId,
        recipient: user.email,
        subject: `Digest Social SignApps — ${period}`,
        body_html: bodyHtml,
      })

      toast.success("Digest envoyé à " + user.email)
    } catch (err) {
      console.error("Social digest send error:", err)
      toast.error("Impossible d'envoyer le digest. Vérifiez votre configuration mail.")
    } finally {
      setSending(false)
    }
  }, [analytics, topPosts, user, fetchAnalytics])

  const totalEngagement = topPosts
    .slice(0, 3)
    .reduce((acc, p) => acc + (p.likesCount ?? 0) + (p.sharesCount ?? 0) + (p.commentsCount ?? 0), 0)

  return (
    <div className={className}>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Digest Social</h3>
            <p className="text-xs text-muted-foreground">Résumé de performance par email</p>
          </div>
        </div>

        {isLoadingAnalytics ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Chargement des données…
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <Users className="h-3.5 w-3.5 text-blue-500 mx-auto mb-1" />
              <div className="text-sm font-semibold">
                {analytics?.totalFollowers?.toLocaleString("fr-FR") ?? "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">Abonnés</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <Eye className="h-3.5 w-3.5 text-green-500 mx-auto mb-1" />
              <div className="text-sm font-semibold">
                {analytics?.totalReach?.toLocaleString("fr-FR") ?? "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">Portée</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <TrendingUp className="h-3.5 w-3.5 text-violet-500 mx-auto mb-1" />
              <div className="text-sm font-semibold">
                {totalEngagement.toLocaleString("fr-FR")}
              </div>
              <div className="text-[10px] text-muted-foreground">Engagement top3</div>
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="w-full gap-2"
          onClick={handleSendDigest}
          disabled={sending || isLoadingAnalytics}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {sending ? "Envoi en cours…" : "Envoyer le digest par email"}
        </Button>
      </div>
    </div>
  )
}
