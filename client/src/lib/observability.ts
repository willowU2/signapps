/**
 * Client-side observability — performance metrics, error tracking, tracing
 */

export interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, string>;
  parentId?: string;
}

class Tracer {
  private spans: TraceSpan[] = [];

  startSpan(name: string, parentId?: string): TraceSpan {
    const span: TraceSpan = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      startTime: performance.now(),
      attributes: {},
      parentId,
    };
    this.spans.push(span);
    return span;
  }

  endSpan(span: TraceSpan) {
    span.endTime = performance.now();
    span.duration = span.endTime - span.startTime;
  }

  getSpans(): TraceSpan[] {
    return [...this.spans];
  }

  clear() {
    this.spans = [];
  }
}

export const tracer = new Tracer();

/**
 * Measure async operation duration
 */
export async function measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const span = tracer.startSpan(name);
  try {
    const result = await fn();
    span.attributes["status"] = "ok";
    return result;
  } catch (e) {
    span.attributes["status"] = "error";
    span.attributes["error"] = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    tracer.endSpan(span);
  }
}

/**
 * Report Web Vitals
 */
export function reportWebVitals() {
  if (typeof window === "undefined") return;
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      console.log(`[Perf] ${entry.name}: ${Math.round(entry.startTime)}ms`);
    });
  });
  observer.observe({ entryTypes: ["largest-contentful-paint", "first-input", "layout-shift"] });
}
