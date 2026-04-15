"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  FileText,
  MessageSquare,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { usersApi, storageApi, chatApi } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  status: "active" | "completed" | "pending";
  lastUpdated: string;
}

interface SharedDocument {
  id: string;
  name: string;
  type: "contract" | "invoice" | "proposal";
  sharedDate: string;
}

interface Message {
  id: string;
  sender: string;
  subject: string;
  date: string;
  unread: boolean;
}

export function ClientPortal() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        // Load users as "projects" — each user represents an active account
        const usersRes = await usersApi.list(0, 10).catch(() => null);
        type RawUser = {
          id: string;
          display_name?: string;
          username: string;
          last_login?: string;
          created_at: string;
        };
        const pud = usersRes?.data as
          | { users?: RawUser[] }
          | RawUser[]
          | undefined;
        const rawUsers =
          (pud as { users?: RawUser[] })?.users ??
          (Array.isArray(pud) ? (pud as RawUser[]) : null);
        if (rawUsers) {
          const mapped: Project[] = rawUsers.slice(0, 5).map((u) => ({
            id: u.id,
            name: u.display_name || u.username,
            status: "active" as const,
            lastUpdated: u.last_login
              ? new Date(u.last_login).toLocaleDateString()
              : new Date(u.created_at).toLocaleDateString(),
          }));
          setProjects(mapped);
        }
      } catch {
        setProjects([]);
      }

      try {
        // Load files from default bucket as shared documents
        const filesRes = await storageApi.listBuckets().catch(() => null);
        const bucketName = filesRes?.data?.[0]?.name;
        if (bucketName) {
          const listRes = await storageApi
            .listFiles(bucketName, "", "/")
            .catch(() => null);
          const objects =
            (listRes?.data as { objects?: { key: string; size: number }[] })
              ?.objects ?? [];
          const mapped: SharedDocument[] = objects.slice(0, 5).map((obj, i) => {
            const name = obj.key.split("/").pop() || obj.key;
            const ext = name.split(".").pop()?.toLowerCase();
            const type: SharedDocument["type"] =
              ext === "pdf"
                ? "contract"
                : ext === "xlsx" || ext === "csv"
                  ? "invoice"
                  : "proposal";
            return {
              id: String(i),
              name,
              type,
              sharedDate: "recently",
            };
          });
          setDocuments(mapped);
        }
      } catch {
        setDocuments([]);
      }

      try {
        // Load chat channels as messages
        const channelsRes = await chatApi.getChannels().catch(() => null);
        const channels = channelsRes?.data ?? [];
        const mapped: Message[] = channels.slice(0, 5).map((ch) => ({
          id: ch.id,
          sender: ch.name,
          subject: ch.topic || `#${ch.name}`,
          date: new Date(ch.created_at).toLocaleDateString(),
          unread: false,
        }));
        setMessages(mapped);
      } catch {
        setMessages([]);
      }

      setLoading(false);
    };

    loadAll();
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      active: "default",
      pending: "secondary",
      completed: "outline",
    };
    return (
      <Badge variant={variants[status] || "default"} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getDocumentIcon = (type: string) => {
    return <FileText className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Projects Section */}
      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
          <CardDescription>Projects you're collaborating on</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
              >
                <div className="flex-1">
                  <p className="font-medium">{project.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {project.lastUpdated}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(project.status)}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">
            View All Projects
          </Button>
        </CardContent>
      </Card>

      {/* Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle>Shared Documents</CardTitle>
          <CardDescription>Documents shared with you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getDocumentIcon(doc.type)}
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {doc.type} • {doc.sharedDate}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">
            View All Documents
          </Button>
        </CardContent>
      </Card>

      {/* Messages Section */}
      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>
            Communication with your account team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer ${msg.unread ? "bg-muted/50" : ""}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium truncate ${msg.unread ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {msg.sender}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {msg.subject}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{msg.date}</p>
                  {msg.unread && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 ml-auto" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">
            View All Messages
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
