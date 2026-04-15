"use client";

// Idea 10: Design → export to social post
// Idea 11: Design → use as email template header
// Idea 12: Sheets data → feed into CRM reports

import { useState } from "react";
import { Share2, Mail, BarChart3, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const socialClient = () => getClient(ServiceName.SOCIAL);
const mailClient = () => getClient(ServiceName.MAIL);
const identityClient = () => getClient(ServiceName.IDENTITY);

/** Idea 10 – Export design as a social post draft */
export function DesignToSocialPost({
  designId,
  designTitle,
  exportUrl,
}: {
  designId: string;
  designTitle: string;
  exportUrl?: string;
}) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const export_ = async () => {
    setLoading(true);
    try {
      await socialClient().post("/posts/drafts", {
        title: designTitle,
        media_url: exportUrl,
        source: "design",
        source_id: designId,
        status: "draft",
      });
      setDone(true);
      toast.success("Brouillon de post social créé");
    } catch {
      window.open(`/social?draft=design:${designId}`, "_blank");
      setDone(true);
      toast.info("Ouverture dans Social pour création manuelle");
    } finally {
      setLoading(false);
    }
  };

  if (done)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <CheckCircle className="w-3 h-3 text-green-500" />
        Post social créé
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={export_}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Share2 className="w-3.5 h-3.5" />
      )}
      Publier sur Social
    </Button>
  );
}

/** Idea 11 – Use design as email template header */
export function DesignToEmailTemplate({
  designId,
  designTitle,
  exportUrl,
}: {
  designId: string;
  designTitle: string;
  exportUrl?: string;
}) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const useAsHeader = async () => {
    setLoading(true);
    try {
      await mailClient().post("/templates", {
        name: `En-tête — ${designTitle}`,
        header_image_url: exportUrl,
        source: "design",
        source_id: designId,
        type: "header_only",
      });
      setDone(true);
      toast.success("En-tête de mail créé depuis le design");
    } catch {
      window.open(`/mail?template=design:${designId}`, "_blank");
      setDone(true);
      toast.info("Ouverture dans Mail pour création manuelle");
    } finally {
      setLoading(false);
    }
  };

  if (done)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Mail className="w-3 h-3" />
        Template mail créé
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={useAsHeader}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Mail className="w-3.5 h-3.5" />
      )}
      Template email
    </Button>
  );
}

/** Idea 12 – Push Sheets data to CRM reports */
export function SheetsToCrmReport({
  spreadsheetId,
  spreadsheetTitle,
  sheetName,
}: {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetName: string;
}) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const pushToCrm = async () => {
    setLoading(true);
    try {
      await identityClient().post("/crm/reports/from-sheet", {
        spreadsheet_id: spreadsheetId,
        spreadsheet_title: spreadsheetTitle,
        sheet_name: sheetName,
        synced_at: new Date().toISOString(),
      });
      setDone(true);
      toast.success("Données Sheets envoyées au CRM");
    } catch {
      toast.error("CRM indisponible — réessayez plus tard");
    } finally {
      setLoading(false);
    }
  };

  if (done)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <BarChart3 className="w-3 h-3" />
        Données CRM mises à jour
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={pushToCrm}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <BarChart3 className="w-3.5 h-3.5" />
      )}
      Vers CRM
    </Button>
  );
}
