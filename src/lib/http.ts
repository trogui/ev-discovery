import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const RAW_DIR = join(import.meta.dirname, '..', '..', 'data', 'raw');

const USER_AGENT = 'ev-discovery/1.0 (personal VGC damage-calc tool)';

export type CacheOptions = { maxAgeMs?: number; minIntervalMs?: number };

const lastRequestByHost = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function isFresh(path: string, maxAgeMs: number | undefined) {
  try {
    const info = await stat(path);
    return maxAgeMs === undefined || Date.now() - info.mtimeMs < maxAgeMs;
  } catch {
    return false;
  }
}

async function throttle(url: string, minIntervalMs: number) {
  const host = new URL(url).host;
  const last = lastRequestByHost.get(host) ?? 0;
  const wait = last + minIntervalMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestByHost.set(host, Date.now());
}

export async function fetchCached(cacheKey: string, url: string, options: CacheOptions = {}) {
  const path = join(RAW_DIR, cacheKey);
  if (await isFresh(path, options.maxAgeMs)) return readFile(path, 'utf8');
  await throttle(url, options.minIntervalMs ?? 0);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
      const body = await response.text();
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      return body;
    } catch (error) {
      lastError = error;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

export async function fetchJsonCached<T>(cacheKey: string, url: string, options?: CacheOptions): Promise<T> {
  return JSON.parse(await fetchCached(cacheKey, url, options)) as T;
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
