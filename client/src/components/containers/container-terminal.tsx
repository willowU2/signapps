'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Maximize2, Minimize2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

import { CONTAINERS_URL } from '@/lib/api/core';
interface ContainerTerminalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  containerName: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function ContainerTerminal({
  open,
  onOpenChange,
  containerId,
  containerName,
}: ContainerTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Get WebSocket URL from environment
  const getWsUrl = useCallback(() => {
    const containersUrl = CONTAINERS_URL;
    // Convert HTTP to WS
    const wsUrl = containersUrl.replace(/^http/, 'ws');
    return `${wsUrl}/containers/${containerId}/exec`;
  }, [containerId]);

  // Initialize terminal
  const initTerminal = useCallback(async () => {
    if (!terminalRef.current || terminalInstanceRef.current) return;

    // Dynamically import xterm to avoid SSR issues
    const { Terminal } = await import('xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');

    // Import xterm CSS - using require to avoid TypeScript module resolution issues
    // @ts-ignore -- xterm CSS import has no type declaration; safe to ignore at runtime
    await import('xterm/css/xterm.css').catch(() => {});

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, Monaco, monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        cursorAccent: '#1a1b26',
        selectionBackground: '#33467c',
        selectionForeground: '#a9b1d6',
        black: '#32344a',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#444b6a',
        brightRed: '#ff7a93',
        brightGreen: '#b9f27c',
        brightYellow: '#ff9e64',
        brightBlue: '#7da6ff',
        brightMagenta: '#c0a6ff',
        brightCyan: '#0db9d7',
        brightWhite: '#c0caf5',
      },
      allowTransparency: false,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Welcome message
    terminal.writeln('\x1b[1;34m=== SignApps Container Terminal ===\x1b[0m');
    terminal.writeln(`\x1b[90mConnecting to container: ${containerName}...\x1b[0m`);
    terminal.writeln('');
  }, [containerName]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!terminalInstanceRef.current) return;

    const terminal = terminalInstanceRef.current;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');
    terminal.writeln('\x1b[33mConnecting...\x1b[0m');

    const wsUrl = getWsUrl();

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        terminal.writeln('\x1b[32mConnecté!\x1b[0m');
        terminal.writeln('');
        terminal.focus();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          terminal.write(event.data);
        } else if (event.data instanceof Blob) {
          event.data.text().then((text) => {
            terminal.write(text);
          });
        }
      };

      ws.onclose = (event) => {
        setStatus('disconnected');
        terminal.writeln('');
        terminal.writeln(`\x1b[33mDéconnecté (code: ${event.code})\x1b[0m`);
        if (event.reason) {
          terminal.writeln(`\x1b[90mReason: ${event.reason}\x1b[0m`);
        }
      };

      ws.onerror = () => {
        setStatus('error');
        terminal.writeln('\x1b[31mConnection error\x1b[0m');
      };

      // Send terminal input to WebSocket
      terminal.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

    } catch (error) {
      setStatus('error');
      terminal.writeln(`\x1b[31mFailed to connect: ${error}\x1b[0m`);
    }
  }, [getWsUrl]);

  // Send resize event to server
  const sendResize = useCallback(() => {
    if (!terminalInstanceRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const terminal = terminalInstanceRef.current;
    const resizeMessage = JSON.stringify({
      type: 'resize',
      cols: terminal.cols,
      rows: terminal.rows,
    });
    wsRef.current.send(resizeMessage);
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && terminalInstanceRef.current) {
        fitAddonRef.current.fit();
        sendResize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sendResize]);

  // Initialize when dialog opens
  useEffect(() => {
    if (open && containerId) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(async () => {
        await initTerminal();
        connect();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, containerId, initTerminal, connect]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
        terminalInstanceRef.current = null;
      }
      fitAddonRef.current = null;
      setStatus('disconnected');
    }
  }, [open]);

  // Fit terminal when fullscreen changes
  useEffect(() => {
    if (fitAddonRef.current && terminalInstanceRef.current) {
      setTimeout(() => {
        fitAddonRef.current.fit();
        sendResize();
      }, 100);
    }
  }, [isFullscreen, sendResize]);

  const handleReconnect = () => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear();
      terminalInstanceRef.current.writeln('\x1b[1;34m=== SignApps Container Terminal ===\x1b[0m');
      terminalInstanceRef.current.writeln(`\x1b[90mReconnecting to container: ${containerName}...\x1b[0m`);
      terminalInstanceRef.current.writeln('');
    }
    connect();
  };

  const getStatusColor = (s: ConnectionStatus) => {
    switch (s) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (s: ConnectionStatus) => {
    switch (s) {
      case 'connected':
        return 'Connecté';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Déconnecté';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col p-0 gap-0 bg-[#1a1b26] border-gray-700',
          isFullscreen
            ? 'max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none'
            : 'max-w-4xl w-[90vw] h-[70vh] max-h-[70vh]'
        )}
        showCloseButton={false}
      >
        <DialogHeader className="flex-shrink-0 px-4 py-3 border-b border-gray-700 bg-[#24283b]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-gray-100">
                Terminal: {containerName}
              </DialogTitle>
              <Badge
                variant="outline"
                className={cn(
                  'flex items-center gap-1.5 text-xs border-gray-600',
                  status === 'connected' && 'border-green-500/50 text-green-400',
                  status === 'connecting' && 'border-yellow-500/50 text-yellow-400',
                  status === 'error' && 'border-red-500/50 text-red-400',
                  status === 'disconnected' && 'border-gray-500/50 text-gray-400'
                )}
              >
                <Circle className={cn('h-2 w-2 fill-current', getStatusColor(status))} />
                {getStatusText(status)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {status !== 'connected' && status !== 'connecting' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReconnect}
                  className="text-gray-300 hover:text-white hover:bg-gray-700"
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Reconnect
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={terminalRef}
          className="flex-1 min-h-0 p-2"
          style={{
            backgroundColor: '#1a1b26',
            overflow: 'hidden',
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
