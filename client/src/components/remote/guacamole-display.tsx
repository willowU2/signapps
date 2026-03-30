"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Terminal, MonitorSmartphone, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// ─── Guacamole protocol parser ────────────────────────────────────────────────

function parseGuacamoleInstruction(raw: string): { opcode: string; args: string[] } | null {
    // Guacamole instructions have the form: LENGTH.VALUE,LENGTH.VALUE,...;
    // e.g. "4.sync,5.12345;"
    try {
        const trimmed = raw.trim().replace(/;$/, "")
        const elements: string[] = []
        let rest = trimmed
        while (rest.length > 0) {
            const dotIdx = rest.indexOf(".")
            if (dotIdx === -1) break
            const len = parseInt(rest.slice(0, dotIdx), 10)
            if (isNaN(len)) break
            const val = rest.slice(dotIdx + 1, dotIdx + 1 + len)
            elements.push(val)
            rest = rest.slice(dotIdx + 1 + len)
            if (rest.startsWith(",")) rest = rest.slice(1)
        }
        if (elements.length === 0) return null
        const [opcode, ...args] = elements
        return { opcode, args }
    } catch {
        return null
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error"

interface GuacamoleDisplayProps {
    wsUrl: string
    protocol: "rdp" | "vnc" | "ssh" | "telnet"
    onStatusChange?: (status: ConnectionStatus) => void
    onDisconnect?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GuacamoleDisplay({ wsUrl, protocol, onStatusChange, onDisconnect }: GuacamoleDisplayProps) {
    const wsRef = useRef<WebSocket | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const terminalRef = useRef<HTMLPreElement | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [status, setStatus] = useState<ConnectionStatus>("connecting")
    const [terminalLines, setTerminalLines] = useState<string[]>([
        "Connexion au serveur distant...",
    ])
    const inputBufferRef = useRef<string>("")

    const isTerminal = protocol === "ssh" || protocol === "telnet"

    const updateStatus = useCallback((s: ConnectionStatus) => {
        setStatus(s)
        onStatusChange?.(s)
    }, [onStatusChange])

    const appendLine = useCallback((text: string) => {
        setTerminalLines(prev => {
            const lines = [...prev, text]
            // Keep last 500 lines
            return lines.length > 500 ? lines.slice(-500) : lines
        })
    }, [])

    // Send key instruction over WebSocket
    const sendKey = useCallback((keysym: number, pressed: boolean) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const pressedNum = pressed ? 1 : 0
        const keysymStr = keysym.toString()
        const instruction = `3.key,${keysymStr.length}.${keysymStr},1.${pressedNum};`
        wsRef.current.send(instruction)
    }, [])

    // Send mouse instruction
    const sendMouse = useCallback((x: number, y: number, buttonMask: number) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const xs = x.toString()
        const ys = y.toString()
        const ms = buttonMask.toString()
        const instruction = `5.mouse,${xs.length}.${xs},${ys.length}.${ys},${ms.length}.${ms};`
        wsRef.current.send(instruction)
    }, [])

    useEffect(() => {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            updateStatus("connected")
            if (isTerminal) {
                appendLine("Terminal connecte. Entrez vos commandes ci-dessous.")
            }
        }

        ws.onmessage = (event: MessageEvent) => {
            const data = typeof event.data === "string" ? event.data : ""
            // Split on ";" to process multiple instructions
            const rawInstructions = data.split(";").filter(Boolean)
            for (const raw of rawInstructions) {
                const instruction = parseGuacamoleInstruction(raw + ";")
                if (!instruction) continue
                handleInstruction(instruction.opcode, instruction.args)
            }
        }

        ws.onerror = () => {
            updateStatus("error")
            if (isTerminal) appendLine("[Erreur de connexion WebSocket]")
        }

        ws.onclose = () => {
            updateStatus("disconnected")
            if (isTerminal) appendLine("[Connexion fermee]")
            onDisconnect?.()
        }

        return () => {
            ws.close()
            wsRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wsUrl])

    // Canvas drawing from Guacamole instructions
    function handleInstruction(opcode: string, args: string[]) {
        switch (opcode) {
            case "size": {
                // size,layer,width,height
                if (!canvasRef.current) return
                const w = parseInt(args[1] ?? "800", 10)
                const h = parseInt(args[2] ?? "600", 10)
                if (!isNaN(w) && !isNaN(h)) {
                    canvasRef.current.width = w
                    canvasRef.current.height = h
                }
                break
            }
            case "png":
            case "img": {
                // img,channelMask,layer,mimetupe,x,y,data (base64)
                if (!canvasRef.current) return
                const ctx = canvasRef.current.getContext("2d")
                if (!ctx) return
                const x = parseInt(args[3] ?? "0", 10)
                const y = parseInt(args[4] ?? "0", 10)
                const b64 = args[5] ?? ""
                if (!b64) return
                const img = new Image()
                img.onload = () => ctx.drawImage(img, x, y)
                img.src = `data:image/png;base64,${b64}`
                break
            }
            case "blob": {
                // blob,stream,data — used for image streaming
                // For MVP we just receive and ignore blob chunking
                break
            }
            case "sync": {
                // sync,timestamp — acknowledgment
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    const ts = args[0] ?? "0"
                    wsRef.current.send(`4.sync,${ts.length}.${ts};`)
                }
                break
            }
            case "error": {
                // error,message,status
                const msg = args[0] ?? "Erreur inconnue"
                appendLine(`[ERREUR] ${msg}`)
                updateStatus("error")
                break
            }
            case "clipboard": {
                // clipboard,stream,mimetype
                // Future: write to navigator.clipboard
                break
            }
            default:
                // Ignore unknown opcodes
                break
        }
    }

    // ── SSH terminal keyboard handling ─────────────────────────────────────────

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isTerminal) return
        e.preventDefault()

        if (e.key === "Enter") {
            const line = inputBufferRef.current
            inputBufferRef.current = ""
            if (inputRef.current) inputRef.current.value = ""
            appendLine(`> ${line}`)
            // Send each char as key press
            for (const ch of line) {
                sendKey(ch.charCodeAt(0), true)
                sendKey(ch.charCodeAt(0), false)
            }
            // Send Enter (keysym 0xFF0D)
            sendKey(0xFF0D, true)
            sendKey(0xFF0D, false)
        } else if (e.key === "Backspace") {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1)
            if (inputRef.current) inputRef.current.value = inputBufferRef.current
            sendKey(0xFF08, true)
            sendKey(0xFF08, false)
        } else if (e.key.length === 1) {
            inputBufferRef.current += e.key
            sendKey(e.key.charCodeAt(0), true)
            sendKey(e.key.charCodeAt(0), false)
        }
    }, [isTerminal, appendLine, sendKey])

    // ── Canvas mouse handling ──────────────────────────────────────────────────

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const x = Math.round(e.clientX - rect.left)
        const y = Math.round(e.clientY - rect.top)
        sendMouse(x, y, 0)
    }, [sendMouse])

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const x = Math.round(e.clientX - rect.left)
        const y = Math.round(e.clientY - rect.top)
        const mask = e.button === 0 ? 1 : e.button === 1 ? 4 : 2
        sendMouse(x, y, mask)
    }, [sendMouse])

    const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const x = Math.round(e.clientX - rect.left)
        const y = Math.round(e.clientY - rect.top)
        sendMouse(x, y, 0)
        void e
    }, [sendMouse])

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight
        }
    }, [terminalLines])

    // ── Status badge ──────────────────────────────────────────────────────────

    const statusColor =
        status === "connected" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
        status === "connecting" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
        status === "error" ? "bg-red-500/10 text-red-600 border-red-500/20" :
        "bg-muted text-muted-foreground border-border"

    const statusLabel =
        status === "connected" ? "Connecte" :
        status === "connecting" ? "Connexion..." :
        status === "error" ? "Erreur" :
        "Deconnecte"

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-black text-white">
            {/* Status bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs">
                {isTerminal ? (
                    <Terminal className="h-3.5 w-3.5 text-zinc-400" />
                ) : (
                    <MonitorSmartphone className="h-3.5 w-3.5 text-zinc-400" />
                )}
                <span className="text-zinc-400 capitalize">{protocol.toUpperCase()}</span>
                <Badge className={`text-xs px-1.5 py-0 border ${statusColor}`}>
                    {statusLabel}
                </Badge>
                {!isTerminal && status !== "connected" && (
                    <span className="ml-auto text-zinc-500 text-xs">
                        RDP/VNC: bibliotheque Guacamole client requise pour le rendu complet
                    </span>
                )}
            </div>

            {/* Content area */}
            {isTerminal ? (
                // SSH / Telnet: terminal emulator
                <div className="flex flex-col flex-1 overflow-hidden">
                    <pre
                        ref={terminalRef}
                        className="flex-1 p-3 overflow-y-auto font-mono text-sm text-green-400 bg-black whitespace-pre-wrap break-words"
                        style={{ minHeight: 0 }}
                    >
                        {terminalLines.join("\n")}
                    </pre>
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-zinc-800 bg-zinc-950">
                        <span className="text-green-500 font-mono text-sm">$</span>
                        <input
                            ref={inputRef}
                            type="text"
                            className="flex-1 bg-transparent font-mono text-sm text-green-300 outline-none placeholder:text-zinc-600"
                            placeholder="Entrer une commande..."
                            onKeyDown={handleKeyDown}
                            onChange={(e) => { inputBufferRef.current = e.target.value }}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                        />
                    </div>
                </div>
            ) : (
                // RDP / VNC: canvas rendering
                <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                    <canvas
                        ref={canvasRef}
                        className="max-w-full max-h-full object-contain cursor-crosshair"
                        style={{ imageRendering: "pixelated" }}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseUp={handleCanvasMouseUp}
                        onContextMenu={(e) => e.preventDefault()}
                    />
                    {status === "connecting" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center space-y-3">
                                <MonitorSmartphone className="h-16 w-16 mx-auto opacity-30" />
                                <p className="text-zinc-400">Connexion au serveur distant...</p>
                                <p className="text-xs text-zinc-600">
                                    Le rendu RDP/VNC complet requiert la bibliotheque guacamole-common-js
                                </p>
                            </div>
                        </div>
                    )}
                    {status === "error" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center space-y-3">
                                <AlertCircle className="h-16 w-16 mx-auto text-red-500/50" />
                                <p className="text-red-400">Erreur de connexion</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
