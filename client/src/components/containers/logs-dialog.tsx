'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, Pause, Play } from 'lucide-react';
import { containersApi } from '@/lib/api';

interface LogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  containerName: string;
}

export function LogsDialog({ open, onOpenChange, containerId, containerName }: LogsDialogProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && containerId) {
      fetchLogs();
    }
    return () => {
      setLogs([]);
    };
  }, [open, containerId]);

  useEffect(() => {
    if (!paused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, paused]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await containersApi.logs(containerId);
      // Handle both string and array responses
      let logLines: string[];
      if (Array.isArray(response.data)) {
        logLines = response.data.filter((line: string) => line.trim());
      } else if (typeof response.data === 'string') {
        logLines = response.data.split('\n').filter((line: string) => line.trim());
      } else {
        logLines = [];
      }
      setLogs(logLines);
    } catch {
      // Show error message instead of mock data
      setLogs(['Error: Failed to fetch container logs']);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerName}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setLogs([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>Logs: {containerName}</DialogTitle>
              <Badge variant="outline">{logs.length} lines</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaused(!paused)}
              >
                {paused ? (
                  <>
                    <Play className="mr-1 h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="mr-1 h-4 w-4" />
                    Pause
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchLogs}>
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-1 h-4 w-4" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="mr-1 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 rounded-md border bg-black p-4" ref={scrollRef}>
          {loading ? (
            <div className="text-green-400 font-mono text-sm">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-500 font-mono text-sm">No logs available</div>
          ) : (
            <div className="font-mono text-sm space-y-0.5">
              {logs.map((line, index) => (
                <div
                  key={index}
                  className={
                    line.includes('ERROR') || line.includes('error')
                      ? 'text-red-400'
                      : line.includes('WARN') || line.includes('warn')
                      ? 'text-yellow-400'
                      : line.includes('INFO') || line.includes('info')
                      ? 'text-blue-400'
                      : 'text-green-400'
                  }
                >
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
