"use client";

// IDEA-046: Public calendar sharing link — generate read-only iCal URL

import { useState, useCallback } from "react";
import {
  Link2,
  Copy,
  RefreshCw,
  Globe,
  Lock,
  QrCode,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface PublicCalendarLinkProps {
  calendarId: string;
  calendarName: string;
}

interface PublicLinkData {
  token: string;
  icalUrl: string;
  htmlUrl: string;
  expiresAt?: string;
  createdAt: string;
}

export function PublicCalendarLink({
  calendarId,
  calendarName,
}: PublicCalendarLinkProps) {
  const [publicLink, setPublicLink] = useState<PublicLinkData | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const generateLink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/${calendarId}/public-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read_only: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Construct iCal URL from the token
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const token = data.token || data.public_token || crypto.randomUUID();
      const icalUrl = `${base}/api/calendar/public/${token}/feed.ics`;
      const htmlUrl = `${base}/cal/public/${token}`;

      setPublicLink({
        token,
        icalUrl,
        htmlUrl,
        expiresAt: data.expires_at,
        createdAt: new Date().toISOString(),
      });
      setIsPublic(true);
      toast.success("Lien de calendrier public généré");
    } catch {
      toast.error("Impossible de générer le lien public");
      setIsPublic(false);
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  const revokeLink = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(`/api/calendar/${calendarId}/public-link`, {
        method: "DELETE",
      });
      setPublicLink(null);
      setIsPublic(false);
      toast.success("Lien public révoqué");
    } catch {
      toast.error("Impossible de révoquer le lien");
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied to clipboard`))
      .catch(() => toast.error("Impossible de copier"));
  };

  const handleToggle = async (val: boolean) => {
    if (val) {
      await generateLink();
    } else {
      await revokeLink();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          Public Calendar Link
        </CardTitle>
        <CardDescription>
          Share <strong>{calendarName}</strong> as a read-only public calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
          <div className="flex items-center gap-3">
            {isPublic ? (
              <Globe className="h-4 w-4 text-green-500" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">
                {isPublic ? "Public" : "Private"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPublic
                  ? "Anyone with the link can view this calendar"
                  : "Only shared users can access this calendar"}
              </p>
            </div>
          </div>
          <Switch
            checked={isPublic}
            onCheckedChange={handleToggle}
            disabled={loading}
          />
        </div>

        {/* Link display */}
        {publicLink && isPublic && (
          <div className="space-y-3">
            {/* iCal URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Link2 className="h-3 w-3" />
                iCal Feed URL
                <Badge variant="outline" className="text-[10px] ml-1">
                  Subscribe in any calendar app
                </Badge>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={publicLink.icalUrl}
                  readOnly
                  className="h-8 text-xs font-mono bg-muted/30"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 shrink-0"
                  onClick={() =>
                    copyToClipboard(publicLink.icalUrl, "iCal URL")
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Web view URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <ExternalLink className="h-3 w-3" />
                Web View URL
              </Label>
              <div className="flex gap-2">
                <Input
                  value={publicLink.htmlUrl}
                  readOnly
                  className="h-8 text-xs font-mono bg-muted/30"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 shrink-0"
                  onClick={() => copyToClipboard(publicLink.htmlUrl, "Web URL")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={generateLink}
                disabled={loading}
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={revokeLink}
                disabled={loading}
              >
                Revoke access
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              This link provides read-only access. No account required to view.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
