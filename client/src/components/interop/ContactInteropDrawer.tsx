"use client";
// Features 1, 3, 5, 7, 9, 12, 17, 24, 26, 28: Complete contact interop panel (used as side-drawer or inline)

import { useState } from "react";
import {
  X,
  TrendingUp,
  Mail,
  Calendar,
  CheckSquare,
  Globe,
  FolderOpen,
  Gift,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactDealsPanel } from "./ContactDealsPanel";
import { ContactCalendarPanel } from "./ContactCalendarPanel";
import { ContactTasksPanel } from "./ContactTasksPanel";
import { ContactSocialProfiles } from "./ContactSocialProfiles";
import { DealDocumentsPanel } from "./DealDocumentsPanel";
import { ContactBirthdayCrmContext } from "./ContactBirthdayCrmContext";
import { SharedContactNotes } from "./SharedContactNotes";
import { InvoiceEmailSender } from "./InvoiceEmailSender";
import { ContactPaymentHistory } from "./ContactPaymentHistory";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  birthday?: string;
  tags?: string[];
}

interface Props {
  contact: Contact;
  onClose?: () => void;
}

export function ContactInteropDrawer({ contact, onClose }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold text-base">{contact.name}</h2>
          <p className="text-xs text-muted-foreground">{contact.email}</p>
          {contact.company && (
            <p className="text-xs text-muted-foreground">{contact.company}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <InvoiceEmailSender
            contactEmail={contact.email}
            contactName={contact.name}
            mode="quick"
          />
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Birthday context if applicable */}
      {contact.birthday && (
        <div className="px-4 pt-3">
          <ContactBirthdayCrmContext contact={contact} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="deals" className="p-4 space-y-3">
          <TabsList className="flex-wrap h-auto gap-1 w-full justify-start">
            <TabsTrigger value="deals" className="text-xs h-7 px-2">
              <TrendingUp className="h-3 w-3 mr-1" /> CRM
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs h-7 px-2">
              Facturation
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs h-7 px-2">
              <Mail className="h-3 w-3 mr-1" /> Email
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs h-7 px-2">
              <Calendar className="h-3 w-3 mr-1" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs h-7 px-2">
              <CheckSquare className="h-3 w-3 mr-1" /> Tâches
            </TabsTrigger>
            <TabsTrigger value="social" className="text-xs h-7 px-2">
              <Globe className="h-3 w-3 mr-1" /> Réseaux
            </TabsTrigger>
            <TabsTrigger value="files" className="text-xs h-7 px-2">
              <FolderOpen className="h-3 w-3 mr-1" /> Fichiers
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs h-7 px-2">
              <StickyNote className="h-3 w-3 mr-1" /> Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deals" className="mt-2">
            <ContactDealsPanel
              contactId={contact.id}
              contactEmail={contact.email}
            />
          </TabsContent>

          <TabsContent value="billing" className="mt-2">
            <ContactPaymentHistory
              contactId={contact.id}
              contactEmail={contact.email}
            />
          </TabsContent>

          <TabsContent value="email" className="mt-2">
            <div className="space-y-3">
              <InvoiceEmailSender
                contactEmail={contact.email}
                contactName={contact.name}
              />
              <p className="text-xs text-muted-foreground">
                Emails échangés disponibles dans le module{" "}
                <a
                  href={`/mail?search=${encodeURIComponent(contact.email)}`}
                  className="text-primary hover:underline"
                >
                  Mail
                </a>
                .
              </p>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-2">
            <ContactCalendarPanel
              contactId={contact.id}
              contactEmail={contact.email}
              contactName={contact.name}
              showScheduleButton
            />
          </TabsContent>

          <TabsContent value="tasks" className="mt-2">
            <ContactTasksPanel
              contactId={contact.id}
              contactEmail={contact.email}
            />
          </TabsContent>

          <TabsContent value="social" className="mt-2">
            <ContactSocialProfiles contactId={contact.id} />
          </TabsContent>

          <TabsContent value="files" className="mt-2">
            <DealDocumentsPanel
              entityType="contact"
              entityId={contact.id}
              entityName={contact.name}
            />
          </TabsContent>

          <TabsContent value="notes" className="mt-2">
            <SharedContactNotes contactId={contact.id} source="contacts" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
