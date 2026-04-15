"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Wifi,
  WifiOff,
  Send,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

interface WsMessage {
  id: string;
  direction: "in" | "out";
  data: string;
  timestamp: Date;
}

const PRESET_URLS = [
  "ws://localhost:3013/ws",
  "ws://localhost:3008/ws",
  "ws://localhost:3001/ws",
];

export function WebSocketDebugger() {
  const [url, setUrl] = useState(PRESET_URLS[0]);
  const [connected, setConnecté] = useState(false);
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [message, setMessage] = useState('{"type":"ping"}');
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    try {
      setError("");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnecté(true);
      ws.onclose = () => {
        setConnecté(false);
      };
      ws.onerror = () => {
        setError("Échec de la connexion");
        setConnecté(false);
      };
      ws.onmessage = (e) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-in`,
            direction: "in",
            data: e.data,
            timestamp: new Date(),
          },
        ]);
      };
    } catch (e) {
      setError(`Error: ${e}`);
    }
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnecté(false);
  }, []);

  const sendMessage = useCallback(() => {
    if (!wsRef.current || !connected) return;
    wsRef.current.send(message);
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-out`,
        direction: "out",
        data: message,
        timestamp: new Date(),
      },
    ]);
  }, [message, connected]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wifi className="h-5 w-5 text-primary" />
            WebSocket Debugger
            <Badge
              variant={connected ? "default" : "secondary"}
              className={connected ? "bg-green-500" : ""}
            >
              {connected ? "Connecté" : "Déconnecté"}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* URL bar */}
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://localhost:3013/ws"
            className="font-mono text-sm"
            disabled={connected}
          />
          <Button
            onClick={connected ? disconnect : connect}
            variant={connected ? "destructive" : "default"}
            className="gap-1.5 shrink-0"
          >
            {connected ? (
              <WifiOff className="h-4 w-4" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            {connected ? "Disconnect" : "Connect"}
          </Button>
        </div>

        {/* Preset URLs */}
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_URLS.map((u) => (
            <button
              key={u}
              onClick={() => !connected && setUrl(u)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                url === u
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-accent"
              } ${connected ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={connected}
            >
              {u.replace("ws://localhost:", ":")}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Messages */}
        <ScrollArea className="h-56 border rounded-lg">
          <div className="p-2 space-y-1.5">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No messages yet
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 p-2 rounded text-xs font-mono ${
                    msg.direction === "in"
                      ? "bg-blue-50 dark:bg-blue-950/30"
                      : "bg-green-50 dark:bg-green-950/30"
                  }`}
                >
                  {msg.direction === "in" ? (
                    <ArrowDownLeft className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1 break-all">{msg.data}</span>
                  <span className="text-muted-foreground shrink-0">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Send */}
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='{"type":"ping"}'
            rows={2}
            className="text-sm font-mono resize-none"
            disabled={!connected}
          />
          <Button
            onClick={sendMessage}
            disabled={!connected}
            className="gap-1.5 shrink-0 self-end"
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
