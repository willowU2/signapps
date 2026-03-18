/**
 * Office Performance Utilities
 *
 * Optimizations for large document handling, exports, and rendering.
 */

// ============================================================================
// Types
// ============================================================================

interface ChunkOptions {
  chunkSize: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
}

interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  size?: number;
  throughput?: number;
}

// ============================================================================
// Document Chunking
// ============================================================================

/**
 * Process large documents in chunks to avoid blocking the main thread
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (chunk: T[], index: number) => Promise<R[]>,
  options: Partial<ChunkOptions> = {}
): Promise<R[]> {
  const { chunkSize = 100, onProgress, signal } = options;
  const results: R[] = [];
  const totalChunks = Math.ceil(items.length / chunkSize);

  for (let i = 0; i < items.length; i += chunkSize) {
    if (signal?.aborted) {
      throw new Error('Operation cancelled');
    }

    const chunk = items.slice(i, i + chunkSize);
    const chunkIndex = Math.floor(i / chunkSize);

    // Process chunk
    const chunkResults = await processor(chunk, chunkIndex);
    results.push(...chunkResults);

    // Report progress
    if (onProgress) {
      onProgress((chunkIndex + 1) / totalChunks);
    }

    // Yield to main thread
    await yieldToMain();
  }

  return results;
}

/**
 * Yield to main thread to keep UI responsive
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if ('scheduler' in globalThis && 'yield' in (globalThis as any).scheduler) {
      (globalThis as any).scheduler.yield().then(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

// ============================================================================
// Memory-Efficient Streaming
// ============================================================================

/**
 * Stream large content for export without loading everything into memory
 */
export async function* streamContent<T>(
  items: T[],
  chunkSize = 1000
): AsyncGenerator<T[], void, unknown> {
  for (let i = 0; i < items.length; i += chunkSize) {
    yield items.slice(i, i + chunkSize);
    await yieldToMain();
  }
}

/**
 * Create a readable stream from async generator
 */
export function createReadableStream<T>(
  generator: AsyncGenerator<T[], void, unknown>,
  serializer: (items: T[]) => string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await generator.next();

      if (done) {
        controller.close();
        return;
      }

      const text = serializer(value);
      controller.enqueue(encoder.encode(text));
    },
  });
}

// ============================================================================
// Document Size Estimation
// ============================================================================

/**
 * Estimate document size in bytes for progress calculation
 */
export function estimateDocumentSize(content: unknown): number {
  if (typeof content === 'string') {
    return new Blob([content]).size;
  }

  if (typeof content === 'object' && content !== null) {
    return new Blob([JSON.stringify(content)]).size;
  }

  return 0;
}

/**
 * Check if document is considered "large" and needs optimization
 */
export function isLargeDocument(content: unknown, thresholdKB = 500): boolean {
  const sizeBytes = estimateDocumentSize(content);
  return sizeBytes > thresholdKB * 1024;
}

// ============================================================================
// Conversion Cache
// ============================================================================

const CACHE_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

class ConversionCache {
  private cache = new Map<string, CacheEntry<ArrayBuffer>>();
  private totalSize = 0;

  /**
   * Generate cache key from conversion parameters
   */
  private generateKey(
    documentId: string,
    format: string,
    options?: Record<string, unknown>
  ): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    return `${documentId}:${format}:${optionsStr}`;
  }

  /**
   * Get cached conversion result
   */
  get(
    documentId: string,
    format: string,
    options?: Record<string, unknown>
  ): ArrayBuffer | null {
    const key = this.generateKey(documentId, format, options);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.delete(documentId, format, options);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache conversion result
   */
  set(
    documentId: string,
    format: string,
    data: ArrayBuffer,
    options?: Record<string, unknown>
  ): void {
    const key = this.generateKey(documentId, format, options);
    const size = data.byteLength;

    // Evict old entries if needed
    while (this.totalSize + size > CACHE_MAX_SIZE && this.cache.size > 0) {
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        const entry = this.cache.get(oldestKey);
        if (entry) {
          this.totalSize -= entry.size;
          this.cache.delete(oldestKey);
        }
      }
    }

    // Don't cache if single entry exceeds limit
    if (size > CACHE_MAX_SIZE) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size,
    });
    this.totalSize += size;
  }

  /**
   * Delete cached entry
   */
  delete(
    documentId: string,
    format: string,
    options?: Record<string, unknown>
  ): void {
    const key = this.generateKey(documentId, format, options);
    const entry = this.cache.get(key);

    if (entry) {
      this.totalSize -= entry.size;
      this.cache.delete(key);
    }
  }

  /**
   * Find oldest cache entry
   */
  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): { entries: number; totalSize: number; maxSize: number } {
    return {
      entries: this.cache.size,
      totalSize: this.totalSize,
      maxSize: CACHE_MAX_SIZE,
    };
  }
}

export const conversionCache = new ConversionCache();

// ============================================================================
// Performance Monitoring
// ============================================================================

const metrics: PerformanceMetrics[] = [];
const MAX_METRICS = 100;

/**
 * Start timing an operation
 */
export function startMetric(operation: string): PerformanceMetrics {
  const metric: PerformanceMetrics = {
    operation,
    startTime: performance.now(),
  };

  metrics.push(metric);

  // Keep only recent metrics
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }

  return metric;
}

/**
 * End timing an operation
 */
export function endMetric(
  metric: PerformanceMetrics,
  size?: number
): PerformanceMetrics {
  metric.endTime = performance.now();
  metric.duration = metric.endTime - metric.startTime;
  metric.size = size;

  if (size && metric.duration) {
    // Throughput in KB/s
    metric.throughput = (size / 1024) / (metric.duration / 1000);
  }

  return metric;
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(operation?: string): {
  count: number;
  avgDuration: number;
  avgThroughput: number;
  p95Duration: number;
} {
  const filtered = operation
    ? metrics.filter((m) => m.operation === operation && m.duration)
    : metrics.filter((m) => m.duration);

  if (filtered.length === 0) {
    return { count: 0, avgDuration: 0, avgThroughput: 0, p95Duration: 0 };
  }

  const durations = filtered.map((m) => m.duration!).sort((a, b) => a - b);
  const throughputs = filtered
    .filter((m) => m.throughput)
    .map((m) => m.throughput!);

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const avgThroughput =
    throughputs.length > 0
      ? throughputs.reduce((a, b) => a + b, 0) / throughputs.length
      : 0;
  const p95Index = Math.floor(durations.length * 0.95);
  const p95Duration = durations[p95Index] || durations[durations.length - 1];

  return {
    count: filtered.length,
    avgDuration,
    avgThroughput,
    p95Duration,
  };
}

// ============================================================================
// Debounce & Throttle
// ============================================================================

/**
 * Debounce function for expensive operations
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function for rate-limiting
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}

// ============================================================================
// Image Optimization
// ============================================================================

/**
 * Compress image for document embedding
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Scale down if needed
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          quality
        );
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// ============================================================================
// Lazy Loading
// ============================================================================

/**
 * Create intersection observer for lazy loading
 */
export function createLazyLoader(
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): IntersectionObserver {
  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback(entry);
      }
    });
  }, options);
}

/**
 * Preload resources in idle time
 */
export function preloadInIdle(urls: string[]): void {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      urls.forEach((url) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
      });
    });
  }
}
