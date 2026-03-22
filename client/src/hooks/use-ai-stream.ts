import { useState, useCallback, useRef } from 'react';

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';

interface UseAiStreamOptions {
  onToken?: (token: string) => void;
  onDone?: (fullResponse: string) => void;
  onError?: (error: string) => void;
  onSources?: (sources: { document_id: string; filename: string; score: number; excerpt: string }[]) => void;
}

interface StreamConfig {
  systemPrompt?: string;
  language?: string;
  includeSources?: boolean;
  enableTools?: boolean;
  provider?: string;
  model?: string;
}

export function useAiStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const stream = useCallback(async (
    prompt: string,
    options: UseAiStreamOptions = {},
    config: StreamConfig = {}
  ) => {
    stop();
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let fullResponse = '';

    const body = {
      question: prompt,
      language: config.language || 'fr',
      include_sources: config.includeSources ?? false,
      enable_tools: config.enableTools ?? false,
      system_prompt: config.systemPrompt,
      provider: config.provider,
      model: config.model,
    };

    try {
      // Try true SSE streaming first
      const res = await fetch(`${AI_URL}/ai/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Fallback to non-streaming endpoint
        const fallbackRes = await fetch(`${AI_URL}/ai/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          fullResponse = data.answer || '';
          options.onToken?.(fullResponse);
          if (data.sources) options.onSources?.(data.sources);
          options.onDone?.(fullResponse);
        } else {
          options.onError?.('AI service unavailable');
        }
        setIsStreaming(false);
        abortControllerRef.current = null;
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        options.onError?.('No readable stream');
        setIsStreaming(false);
        abortControllerRef.current = null;
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'token') {
              fullResponse += event.content;
              options.onToken?.(event.content);
            } else if (event.type === 'sources') {
              options.onSources?.(event.sources);
            } else if (event.type === 'done') {
              break;
            } else if (event.type === 'error') {
              options.onError?.(event.message || 'Stream error');
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      options.onDone?.(fullResponse);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        options.onError?.((err as Error).message || 'Connection error');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [stop]);

  return { stream, stop, isStreaming };
}
