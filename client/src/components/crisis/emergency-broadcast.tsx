"use client";

import { useState } from "react";
import { Send, AlertCircle, Mail, Bell, Smartphone } from "lucide-react";

interface RecipientGroup {
  id: string;
  name: string;
  memberCount: number;
}

interface BroadcastMessage {
  id: string;
  content: string;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  recipients: string[];
  createdAt: string;
  status: "draft" | "sent" | "failed";
}

const DEFAULT_GROUPS: RecipientGroup[] = [
  { id: "all-staff", name: "All Staff", memberCount: 250 },
  { id: "management", name: "Management", memberCount: 45 },
  { id: "department-heads", name: "Department Heads", memberCount: 12 },
  { id: "field-teams", name: "Field Teams", memberCount: 89 },
];

const DEFAULT_MESSAGES: BroadcastMessage[] = [
  {
    id: "1",
    content: "System maintenance scheduled for tonight 10 PM - 2 AM UTC",
    channels: { push: true, email: true, sms: false },
    recipients: ["all-staff"],
    createdAt: "2026-03-22T09:15:00Z",
    status: "sent",
  },
  {
    id: "2",
    content: "Emergency: Building evacuation drill today at 3 PM",
    channels: { push: true, email: true, sms: true },
    recipients: ["all-staff"],
    createdAt: "2026-03-21T14:30:00Z",
    status: "sent",
  },
];

export function EmergencyBroadcast() {
  const [messages, setMessages] = useState<BroadcastMessage[]>(DEFAULT_MESSAGES);
  const [messageContent, setMessageContent] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState({
    push: true,
    email: true,
    sms: false,
  });

  const handleGroupToggle = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleChannelToggle = (channel: "push" | "email" | "sms") => {
    setChannels((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  };

  const handleSend = () => {
    if (!messageContent.trim() || selectedGroups.size === 0) return;

    const newMessage: BroadcastMessage = {
      id: String(messages.length + 1),
      content: messageContent,
      channels,
      recipients: Array.from(selectedGroups),
      createdAt: new Date().toISOString(),
      status: "sent",
    };

    setMessages([newMessage, ...messages]);
    setMessageContent("");
    setSelectedGroups(new Set());
    setChannels({ push: true, email: true, sms: false });
  };

  const recipientCount = Array.from(selectedGroups).reduce(
    (sum, groupId) =>
      sum + (DEFAULT_GROUPS.find((g) => g.id === groupId)?.memberCount || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">Emergency Broadcast</h2>
          <p className="text-muted-foreground">Send urgent messages to staff across all channels</p>
        </div>
      </div>

      <div className="border rounded-lg bg-background p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Message
          </label>
          <textarea
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Type your emergency message here..."
            className="w-full rounded border bg-background border-border p-3 text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-3">
            Recipient Groups ({recipientCount} recipients)
          </label>
          <div className="space-y-2">
            {DEFAULT_GROUPS.map((group) => (
              <label key={group.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedGroups.has(group.id)}
                  onChange={() => handleGroupToggle(group.id)}
                  className="rounded"
                />
                <span className="text-foreground font-medium">{group.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({group.memberCount} members)
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-3">
            Send via
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.push}
                onChange={() => handleChannelToggle("push")}
                className="rounded"
              />
              <Bell className="w-4 h-4 text-blue-600" />
              <span className="text-foreground">Push Notification</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.email}
                onChange={() => handleChannelToggle("email")}
                className="rounded"
              />
              <Mail className="w-4 h-4 text-blue-600" />
              <span className="text-foreground">Email</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.sms}
                onChange={() => handleChannelToggle("sms")}
                className="rounded"
              />
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span className="text-foreground">SMS</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={!messageContent.trim() || selectedGroups.size === 0}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send Broadcast
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Recent Broadcasts</h3>
        {messages.map((msg) => (
          <div key={msg.id} className="border rounded-lg p-4 bg-muted">
            <div className="flex items-start justify-between mb-2">
              <p className="text-foreground font-medium">{msg.content}</p>
              <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-800 rounded">
                {msg.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(msg.createdAt).toLocaleString()} •{" "}
              {msg.recipients.map((r) => DEFAULT_GROUPS.find((g) => g.id === r)?.name).join(", ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
