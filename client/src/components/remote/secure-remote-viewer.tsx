"use client"

/**
 * SecureRemoteViewer — Canvas-based remote screen viewer for SignApps RM5.
 *
 * Protocol: custom JSON-over-WSS (no VNC, no Guacamole).
 * - Receives `frame` messages → decodes base64 WebP → draws on <canvas>.
 * - Sends `mouse_event` and `keyboard_event` messages to the server,
 *   which relays them to the agent.
 * - Agent side shows a notification banner when mode is "share" or "control".
 *
 * Modes:
 *   observe  — view only, no banner on remote, no input forwarding
 *   share    — view only, banner shown to remote user
 *   control  — full input forwarding, banner shown to remote user
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { Monitor, MousePointer, Eye, EyeOff, Loader2, AlertCircle, StopCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Types ────────────────────────────────────────────────────────────────────

type RemoteMode = "observe" | "share" | "control"

type ConnectionState = "idle" | "connecting" | "connected" | "error" | "ended"

interface RemoteFrame {
  type: "frame"
  session_id: string
  width: number
  height: number
  data: string        // base64 WebP
  frame_type: string  // "full" | "delta"
}

interface SessionStarted {
  type: "session_started"
  session_id: string
  screen_width: number
  screen_height: number
}

type AgentMessage = RemoteFrame | SessionStarted

// ─── Props ────────────────────────────────────────────────────────────────────

interface SecureRemoteViewerProps {
  /** Hardware ID (UUID) of the target machine */
  hardwareId: string
  /** Display name of the remote machine */
  machineName?: string
  /** Admin display name shown to remote user in share/control mode */
  adminName?: string
  /** Base URL of the IT assets API (defaults to /api/v1/it-assets) */
  apiBase?: string
  /** Called when the session ends */
  onSessionEnd?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SecureRemoteViewer({
  hardwareId,
  machineName = "Remote Machine",
  adminName = "Admin",
  apiBase = "/api/v1/it-assets",
  onSessionEnd,
}: SecureRemoteViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<RemoteMode>("observe")
  const [connState, setConnState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [screenSize, setScreenSize] = useState<{ w: number; h: number } | null>(null)
  const [frameCount, setFrameCount] = useState(0)

  // ─── Session timer ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (connState !== "connected") return
    const t = setInterval(() => setSessionDuration((d) => d + 1), 1000)
    return () => clearInterval(t)
  }, [connState])

  // ─── Start session ──────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    setError(null)
    setConnState("connecting")
    setSessionDuration(0)
    setFrameCount(0)

    try {
      // 1. Create session on server
      const resp = await fetch(`${apiBase}/${hardwareId}/remote-session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode, admin_name: adminName }),
      })
      if (!resp.ok) {
        const msg = await resp.text()
        throw new Error(`Failed to start session: ${msg}`)
      }
      const session = await resp.json()
      sessionIdRef.current = session.session_id

      // 2. Open WebSocket to receive frames
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const wsHost = window.location.host
      const wsUrl = `${wsProtocol}//${wsHost}${apiBase}/${hardwareId}/remote-session`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnState("connected")
      }

      ws.onmessage = (event) => {
        try {
          const msg: AgentMessage = JSON.parse(event.data)
          handleAgentMessage(msg)
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        setError("WebSocket error — check network or server")
        setConnState("error")
      }

      ws.onclose = () => {
        if (connState !== "ended") {
          setConnState("ended")
        }
        onSessionEnd?.()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConnState("error")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardwareId, mode, adminName, apiBase])

  // ─── Handle incoming agent messages ─────────────────────────────────────────

  const handleAgentMessage = useCallback((msg: AgentMessage) => {
    if (msg.type === "session_started") {
      setScreenSize({ w: msg.screen_width, h: msg.screen_height })
    } else if (msg.type === "frame") {
      renderFrame(msg)
    }
  }, [])

  const renderFrame = useCallback((frame: RemoteFrame) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Decode base64 WebP and draw on canvas
    const img = new Image()
    img.onload = () => {
      if (frame.frame_type === "full") {
        canvas.width = frame.width
        canvas.height = frame.height
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0)
      setFrameCount((c) => c + 1)
    }
    img.src = `data:image/webp;base64,${frame.data}`
  }, [])

  // ─── Stop session ────────────────────────────────────────────────────────────

  const stopSession = useCallback(async () => {
    setConnState("ended")
    wsRef.current?.close()
    wsRef.current = null

    try {
      await fetch(`${apiBase}/${hardwareId}/remote-session/stop`, {
        method: "POST",
        credentials: "include",
      })
    } catch {
      // best effort
    }

    onSessionEnd?.()
  }, [hardwareId, apiBase, onSessionEnd])

  // ─── Mouse events ─────────────────────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (mode !== "control" || connState !== "connected") return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = (screenSize?.w ?? canvas.width) / rect.width
      const scaleY = (screenSize?.h ?? canvas.height) / rect.height
      const x = Math.round((e.clientX - rect.left) * scaleX)
      const y = Math.round((e.clientY - rect.top) * scaleY)
      wsRef.current?.send(
        JSON.stringify({ type: "mouse_event", x, y, button: 0, action: "move" })
      )
    },
    [mode, connState, screenSize]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (mode !== "control" || connState !== "connected") return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = (screenSize?.w ?? canvas.width) / rect.width
      const scaleY = (screenSize?.h ?? canvas.height) / rect.height
      const x = Math.round((e.clientX - rect.left) * scaleX)
      const y = Math.round((e.clientY - rect.top) * scaleY)
      wsRef.current?.send(
        JSON.stringify({
          type: "mouse_event",
          x,
          y,
          button: e.button,
          action: "down",
        })
      )
    },
    [mode, connState, screenSize]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (mode !== "control" || connState !== "connected") return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = (screenSize?.w ?? canvas.width) / rect.width
      const scaleY = (screenSize?.h ?? canvas.height) / rect.height
      const x = Math.round((e.clientX - rect.left) * scaleX)
      const y = Math.round((e.clientY - rect.top) * scaleY)
      wsRef.current?.send(
        JSON.stringify({
          type: "mouse_event",
          x,
          y,
          button: e.button,
          action: "up",
        })
      )
    },
    [mode, connState, screenSize]
  )

  // ─── Keyboard events ──────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (mode !== "control" || connState !== "connected") return
      e.preventDefault()
      const modifiers: string[] = []
      if (e.ctrlKey) modifiers.push("ctrl")
      if (e.altKey) modifiers.push("alt")
      if (e.shiftKey) modifiers.push("shift")
      if (e.metaKey) modifiers.push("meta")
      wsRef.current?.send(
        JSON.stringify({
          type: "keyboard_event",
          key: e.key,
          action: "down",
          modifiers,
        })
      )
    },
    [mode, connState]
  )

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (mode !== "control" || connState !== "connected") return
      e.preventDefault()
      wsRef.current?.send(
        JSON.stringify({ type: "keyboard_event", key: e.key, action: "up", modifiers: [] })
      )
    },
    [mode, connState]
  )

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const modeLabel: Record<RemoteMode, string> = {
    observe: "Observe",
    share: "Share",
    control: "Control",
  }

  const modeBadgeVariant: Record<RemoteMode, "secondary" | "default" | "destructive"> = {
    observe: "secondary",
    share: "default",
    control: "destructive",
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-3 w-full"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      tabIndex={0}
      aria-label={`Remote viewer: ${machineName}`}
    >
      {/* ── Info bar ── */}
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{machineName}</span>
          {screenSize && (
            <span className="text-xs text-muted-foreground">
              {screenSize.w}×{screenSize.h}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {connState === "connected" && (
            <>
              <Badge variant={modeBadgeVariant[mode]}>{modeLabel[mode]}</Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {formatDuration(sessionDuration)}
              </span>
              <span className="text-xs text-muted-foreground">{frameCount} frames</span>
            </>
          )}

          {connState === "connecting" && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Connecting…
            </div>
          )}

          {connState === "error" && (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              Error
            </div>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      {connState === "idle" || connState === "error" || connState === "ended" ? (
        <div className="flex items-center gap-3">
          <Select
            value={mode}
            onValueChange={(v) => setMode(v as RemoteMode)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="observe">
                <span className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" />
                  Observe
                </span>
              </SelectItem>
              <SelectItem value="share">
                <span className="flex items-center gap-2">
                  <EyeOff className="h-3.5 w-3.5" />
                  Share
                </span>
              </SelectItem>
              <SelectItem value="control">
                <span className="flex items-center gap-2">
                  <MousePointer className="h-3.5 w-3.5" />
                  Control
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={startSession}>
            Start Session
          </Button>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Badge variant={modeBadgeVariant[mode]} className="text-sm px-3 py-1">
            {modeLabel[mode]} — {machineName}
          </Badge>

          {mode === "control" && (
            <span className="text-xs text-muted-foreground">
              Click the canvas to focus, then type
            </span>
          )}

          <Button variant="destructive" size="sm" onClick={stopSession} className="ml-auto">
            <StopCircle className="mr-2 h-4 w-4" />
            End Session
          </Button>
        </div>
      )}

      {/* ── Canvas ── */}
      <div className="relative rounded-lg border bg-black overflow-hidden" style={{ minHeight: 400 }}>
        {(connState === "idle" || connState === "ended") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Monitor className="h-12 w-12 opacity-30" />
            <p className="text-sm">No active session</p>
          </div>
        )}

        {connState === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Connecting to {machineName}…</p>
          </div>
        )}

        {connState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{
            cursor: mode === "control" ? "crosshair" : "default",
            display: connState === "connected" ? "block" : "none",
          }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          // Prevent context menu on right-click in control mode
          onContextMenu={(e) => mode === "control" && e.preventDefault()}
        />
      </div>

      {/* ── Mode description ── */}
      {connState === "connected" && (
        <p className="text-xs text-muted-foreground">
          {mode === "observe" && "Silent observation — the remote user is not notified."}
          {mode === "share" &&
            "The remote user sees a banner: \u00ab" + adminName + " is viewing your screen\u00bb"}
          {mode === "control" &&
            "Full control — the remote user sees a banner and you can type and click."}
        </p>
      )}
    </div>
  )
}
