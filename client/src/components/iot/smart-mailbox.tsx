"use client";

import { useState } from "react";
import { Mail, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Mailbox {
  id: string;
  lockerNumber: string;
  recipient: string;
  status: "pending" | "notified" | "collected";
  notificationSent: boolean;
  parcelType: string;
}

export default function SmartMailbox() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([
    {
      id: "1",
      lockerNumber: "L-101",
      recipient: "John Smith",
      status: "pending",
      notificationSent: false,
      parcelType: "Package",
    },
    {
      id: "2",
      lockerNumber: "L-102",
      recipient: "Sarah Johnson",
      status: "notified",
      notificationSent: true,
      parcelType: "Letter",
    },
    {
      id: "3",
      lockerNumber: "L-103",
      recipient: "Mike Davis",
      status: "collected",
      notificationSent: true,
      parcelType: "Package",
    },
    {
      id: "4",
      lockerNumber: "L-104",
      recipient: "Emma Wilson",
      status: "notified",
      notificationSent: true,
      parcelType: "Certified Package",
    },
    {
      id: "5",
      lockerNumber: "L-105",
      recipient: "Alex Brown",
      status: "pending",
      notificationSent: false,
      parcelType: "Letter",
    },
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "notified":
        return <Badge className="bg-blue-500">Notified</Badge>;
      case "collected":
        return <Badge className="bg-green-500">Collected</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const sendNotification = (id: string) => {
    setMailboxes((prevMailboxes) =>
      prevMailboxes.map((mailbox) =>
        mailbox.id === id
          ? { ...mailbox, notificationSent: true, status: "notified" }
          : mailbox
      )
    );
  };

  const markCollected = (id: string) => {
    setMailboxes((prevMailboxes) =>
      prevMailboxes.map((mailbox) =>
        mailbox.id === id ? { ...mailbox, status: "collected" } : mailbox
      )
    );
  };

  const pendingCount = mailboxes.filter((m) => m.status === "pending").length;
  const notifiedCount = mailboxes.filter((m) => m.status === "notified").length;
  const collectedCount = mailboxes.filter((m) => m.status === "collected").length;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Mail className="w-6 h-6" />
        Smart Mailbox
      </h2>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-3 bg-yellow-50">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </Card>
        <Card className="p-3 bg-blue-50">
          <p className="text-xs text-muted-foreground">Notified</p>
          <p className="text-2xl font-bold text-blue-600">{notifiedCount}</p>
        </Card>
        <Card className="p-3 bg-green-50">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-2xl font-bold text-green-600">{collectedCount}</p>
        </Card>
      </div>

      <div className="space-y-3">
        {mailboxes.map((mailbox) => (
          <Card key={mailbox.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{mailbox.lockerNumber}</h3>
                <p className="text-sm text-muted-foreground">{mailbox.recipient}</p>
                <Badge className="mt-2 bg-gray-600">{mailbox.parcelType}</Badge>
              </div>
              <div className="text-right space-y-2">
                {getStatusBadge(mailbox.status)}
                {mailbox.notificationSent && (
                  <div className="flex items-center gap-1 text-sm text-green-600 font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    Notified
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              {mailbox.status === "pending" && (
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => sendNotification(mailbox.id)}
                >
                  Send Notification
                </Button>
              )}
              {mailbox.status === "notified" && (
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => markCollected(mailbox.id)}
                >
                  Mark Collected
                </Button>
              )}
              {mailbox.status === "collected" && (
                <div className="flex-1 flex items-center justify-center text-sm text-green-600 font-semibold">
                  ✓ Collected
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
