import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const RAW_DIR = join(import.meta.dirname, '..', '..', 'data', 'raw');

const USER_AGENT = 'ev-discovery/1.0 (personal VGC damage-calc tool)';

export type CacheOptions = { maxAgeMs?: number; minIntervalMs?: number };

const lastRequestByHost = new Map<string, number>();
const throttleChainByHost = new Map<string, Promise<void>>();

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
  if (minIntervalMs <= 0) return;
  const host = new URL(url).host;
  const previous = throttleChainByHost.get(host) ?? Promise.resolve();
  const current = previous.then(async () => {
    const wait = (lastRequestByHost.get(host) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestByHost.set(host, Date.now());
  });
  throttleChainByHost.set(host, current.catch(() => {}));
  await current;
}

export function retryAfterMs(headers: Headers, now = Date.now()) {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 300_000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.min(Math.max(0, at - now), 300_000) : undefined;
}

export async function fetchCached(cacheKey: string, url: string, options: CacheOptions = {}) {
  const path = join(RAW_DIR, cacheKey);
  if (await isFresh(path, options.maxAgeMs)) return readFile(path, 'utf8');
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    await throttle(url, options.minIntervalMs ?? 0);
    try {
      const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
      if (response.ok) {
        const body = await response.text();
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, body);
        return body;
      }
      lastError = new Error(`${response.status} ${response.statusText} for ${url}`);
      if (response.status !== 429 && response.status !== 503) break;
      if (attempt < 3) await sleep(retryAfterMs(response.headers) ?? Math.min(30_000 * 2 ** attempt, 300_000));
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(1000 * 2 ** attempt);
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
