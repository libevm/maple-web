/**
 * AssetClient — API-first loader interface for asset data.
 *
 * Phase 5, Steps 28-32.
 *
 * Features:
 * - Request coalescing (duplicate in-flight requests are deduplicated)
 * - In-memory LRU cache with configurable max entries
 * - Retry with backoff on transient failures
 * - Compatible with both API server and direct file access
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface AssetClientConfig {
  /** Base URL for API server (e.g., "http://localhost:5200") */
  baseUrl: string;
  /** Max in-memory cache entries */
  maxCacheEntries: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Max retries on transient failure */
  maxRetries: number;
  /** Enable request tracing logs */
  tracing: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  evictions: number;
}

export interface ClientDiagnostics {
  cache: CacheStats;
  inFlightRequests: number;
  totalRequests: number;
  totalErrors: number;
  coalescedRequests: number;
}

// ─── LRU Cache ──────────────────────────────────────────────────────

class LRUCache<T> {
  private map = new Map<string, T>();
  private maxSize: number;
  stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, value);
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return undefined;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict least recently used (first entry)
      const first = this.map.keys().next().value;
      if (first !== undefined) {
        this.map.delete(first);
        this.stats.evictions++;
      }
    }
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

// ─── Asset Client ───────────────────────────────────────────────────

export const DEFAULT_ASSET_CLIENT_CONFIG: AssetClientConfig = {
  baseUrl: "http://localhost:5200",
  maxCacheEntries: 2000,
  timeoutMs: 10000,
  maxRetries: 2,
  tracing: false,
};

export class AssetClient {
  private config: AssetClientConfig;
  private cache: LRUCache<unknown>;
  private inFlight = new Map<string, Promise<unknown>>();
  private totalRequests = 0;
  private totalErrors = 0;
  private coalescedRequests = 0;

  constructor(config: Partial<AssetClientConfig> = {}) {
    this.config = { ...DEFAULT_ASSET_CLIENT_CONFIG, ...config };
    this.cache = new LRUCache(this.config.maxCacheEntries);
  }

  /**
   * Fetch an asset entity from the API.
   * Results are cached and coalesced.
   */
  async getAsset<T = unknown>(type: string, id: string): Promise<T | null> {
    const key = `asset:${type}:${id}`;
    return this.fetchCached<T>(key, `/api/v1/asset/${type}/${id}`);
  }

  /**
   * Fetch a specific section of an asset entity.
   */
  async getSection<T = unknown>(type: string, id: string, section: string): Promise<T | null> {
    const key = `section:${type}:${id}:${section}`;
    return this.fetchCached<T>(key, `/api/v1/asset/${type}/${id}/${section}`);
  }

  /**
   * Fetch a blob by hash.
   */
  async getBlob(hash: string): Promise<ArrayBuffer | null> {
    const key = `blob:${hash}`;

    // Check cache
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached as ArrayBuffer;

    try {
      const res = await this.fetchWithRetry(`/api/v1/blob/${hash}`);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      this.cache.set(key, data);
      return data;
    } catch {
      this.totalErrors++;
      return null;
    }
  }

  /**
   * Batch fetch multiple assets/sections in one request.
   */
  async batch<T = unknown>(
    items: Array<{ type: string; id: string; section?: string }>
  ): Promise<Array<{ ok: boolean; data?: T; error?: string }>> {
    this.totalRequests++;

    try {
      const res = await this.fetchWithRetry("/api/v1/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });

      if (!res.ok) {
        return items.map(() => ({ ok: false, error: "Batch request failed" }));
      }

      const body = await res.json() as { results: Array<{ result: { ok: boolean; data?: T; error?: { message: string } } }> };

      return body.results.map((r) => {
        if (r.result.ok) {
          return { ok: true, data: r.result.data };
        }
        return { ok: false, error: r.result.error?.message ?? "Unknown error" };
      });
    } catch {
      this.totalErrors++;
      return items.map(() => ({ ok: false, error: "Network error" }));
    }
  }

  /**
   * Invalidate cached entries matching a prefix.
   */
  invalidate(keyPrefix: string): void {
    // LRU doesn't support prefix iteration efficiently,
    // so we track keys to delete
    // For now, clear all if prefix is broad
    if (keyPrefix === "" || keyPrefix === "*") {
      this.cache.clear();
    }
    // Specific key invalidation
    this.cache.delete(keyPrefix);
  }

  /**
   * Clear all cached data.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get diagnostics for the debug panel.
   */
  diagnostics(): ClientDiagnostics {
    return {
      cache: {
        hits: this.cache.stats.hits,
        misses: this.cache.stats.misses,
        size: this.cache.size,
        maxSize: this.config.maxCacheEntries,
        evictions: this.cache.stats.evictions,
      },
      inFlightRequests: this.inFlight.size,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      coalescedRequests: this.coalescedRequests,
    };
  }

  // ─── Private Methods ────────────────────────────────────────────

  private async fetchCached<T>(cacheKey: string, path: string): Promise<T | null> {
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached as T;

    // Coalesce duplicate in-flight requests
    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      this.coalescedRequests++;
      return existing as Promise<T | null>;
    }

    const promise = this.doFetch<T>(cacheKey, path);
    this.inFlight.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async doFetch<T>(cacheKey: string, path: string): Promise<T | null> {
    this.totalRequests++;

    try {
      const res = await this.fetchWithRetry(path);
      if (!res.ok) return null;

      const body = await res.json() as { ok: boolean; data: T };
      if (!body.ok) return null;

      this.cache.set(cacheKey, body.data);
      return body.data;
    } catch {
      this.totalErrors++;
      return null;
    }
  }

  private async fetchWithRetry(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (this.config.tracing) {
          console.log(`[AssetClient] ${init?.method ?? "GET"} ${path} (attempt ${attempt + 1})`);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
          const res = await fetch(url, { ...init, signal: controller.signal });
          clearTimeout(timeout);
          return res;
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.config.maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms...
          await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError ?? new Error("Fetch failed after retries");
  }
}
