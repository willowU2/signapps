"use client";

import { SpinnerInfinity } from "spinners-react";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { calendarApi } from "@/lib/api";

export function SendNotificationAdmin() {
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState("push");
  const [type, setType] = useState("event_reminder");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const handleSendTest = async () => {
    if (!title || !message) {
      toast.error("Please enter a title and message");
      return;
    }

    setLoading(true);
    try {
      const response = await calendarApi.post<{
        successful: number;
        failed: number;
      }>("/notifications/push/send", {
        title,
        body: message, // API expects "body"
        notification_type: type,
        channel,
        recipient: "self", // Send to current user
        send_to_all: true,
      });
      const result = response.data as { successful: number; failed: number };
      if (result.successful > 0) {
        toast.success(
          `Notification sent to ${result.successful} subscription(s)`,
        );
      } else if (result.failed > 0) {
        toast.warning(`No notifications delivered. ${result.failed} failed.`);
      } else {
        toast.info("Notification queued");
      }
      setTitle("");
      setMessage("");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      const errorMsg =
        err?.response?.data?.error || "Failed to send notification";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed bg-muted/30">
      <CardHeader>
        <CardTitle className="text-lg">Admin / Developer Testing</CardTitle>
        <CardDescription>
          Send a test notification to yourself to verify delivery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Browser Push</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event_reminder">Event Reminder</SelectItem>
                <SelectItem value="task_assignment">Task Assignment</SelectItem>
                <SelectItem value="daily_digest">Daily Digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Title / Subject</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="E.g., Reminder: Project Sync"
          />
        </div>

        <div className="space-y-2">
          <Label>Message Body</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Notification content..."
            rows={3}
          />
        </div>

        <Button
          onClick={handleSendTest}
          disabled={loading || !title || !message}
          className="w-full"
        >
          {loading ? (
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="h-4 w-4 mr-2 "
            />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send Test Notification
        </Button>
      </CardContent>
    </Card>
  );
}
