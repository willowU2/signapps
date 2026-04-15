"use client";

// Idea 7: Meet recording → auto-create doc with transcript
// Idea 13: Slides → present in Meet
// Idea 16: Meet → show attendee contact cards

import { useState, useEffect } from "react";
import {
  FileText,
  Presentation,
  UserCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import Link from "next/link";
import { getClient, ServiceName } from "@/lib/api/factory";

const docsClient = () => getClient(ServiceName.DOCS);
const contactsClient = () => getClient(ServiceName.CONTACTS);

/** Idea 7 – Create document from meet recording transcript */
export function MeetRecordingToDoc({
  meetingId,
  meetingTitle,
  transcript,
}: {
  meetingId: string;
  meetingTitle: string;
  transcript: string;
}) {
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const createDoc = async () => {
    setLoading(true);
    try {
      const { data } = await docsClient().post<{ id: string }>("/documents", {
        title: `Transcription — ${meetingTitle}`,
        content: `# ${meetingTitle}\n\n**Date :** ${new Date().toLocaleDateString("fr-FR")}\n\n## Transcription\n\n${transcript}`,
        source: "meet_recording",
        source_id: meetingId,
      });
      setDocId(data.id);
      toast.success("Document créé depuis l'enregistrement");
    } catch {
      const local = {
        meetingId,
        meetingTitle,
        transcript,
        queued_at: new Date().toISOString(),
      };
      const q = JSON.parse(localStorage.getItem("interop-meet-docs") || "[]");
      q.push(local);
      localStorage.setItem("interop-meet-docs", JSON.stringify(q));
      toast.info("Document en attente de création");
    } finally {
      setLoading(false);
    }
  };

  if (docId)
    return (
      <Button size="sm" variant="outline" asChild className="h-7 gap-1 text-xs">
        <Link href={`/docs/${docId}`}>
          <FileText className="w-3.5 h-3.5" />
          Ouvrir le document
          <ExternalLink className="w-3 h-3" />
        </Link>
      </Button>
    );

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={createDoc}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileText className="w-3.5 h-3.5" />
      )}
      Créer doc transcription
    </Button>
  );
}

/** Idea 13 – Start presenting slides in a Meet room */
export function SlidesToMeet({
  slideId,
  slideTitle,
}: {
  slideId: string;
  slideTitle: string;
}) {
  const [loading, setLoading] = useState(false);

  const presentInMeet = async () => {
    setLoading(true);
    try {
      const meetClient = getClient(ServiceName.MEET);
      const { data } = await meetClient.post<{ room_url: string }>("/rooms", {
        title: `Présentation — ${slideTitle}`,
        source: "slides",
        source_id: slideId,
      });
      window.open(data.room_url, "_blank");
    } catch {
      // Fallback: navigate to meet with slide context
      window.open(`/meet?present=slides:${slideId}`, "_blank");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={presentInMeet}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Presentation className="w-3.5 h-3.5" />
      )}
      Présenter dans Meet
    </Button>
  );
}

interface ContactCard {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  job_title?: string;
}

/** Idea 16 – Show contact cards for meeting attendees */
export function MeetAttendeeContacts({
  attendeeEmails,
}: {
  attendeeEmails: string[];
}) {
  const [contacts, setContacts] = useState<ContactCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attendeeEmails.length) {
      setLoading(false);
      return;
    }
    const promises = attendeeEmails.slice(0, 8).map((email) =>
      contactsClient()
        .get<ContactCard[]>("/contacts", { params: { email } })
        .then(({ data }) => data[0] || null)
        .catch(() => null),
    );
    Promise.all(promises).then((results) => {
      setContacts(results.filter((c): c is ContactCard => c !== null));
      setLoading(false);
    });
  }, [attendeeEmails]);

  if (loading) return <div className="animate-pulse h-12 rounded bg-muted" />;
  if (!contacts.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Participants</p>
      <div className="flex flex-wrap gap-2">
        {contacts.map((c) => (
          <Link key={c.id} href={`/contacts/${c.id}`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="p-2 flex items-center gap-2">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="text-xs">
                    {c.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs font-medium leading-tight">{c.name}</p>
                  {c.job_title && (
                    <p className="text-[10px] text-muted-foreground">
                      {c.job_title}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
