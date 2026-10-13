import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { RAW_DIR, fetchCached } from './lib/http.js';

const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${detail}`);
  if (!ok) failures.push(name);
};

const originalFetch = globalThis.fetch;
const cacheDir = join(RAW_DIR, 'check-http');
try {
  const stamps: number[] = [];
  globalThis.fetch = (async () => {
    stamps.push(Date.now());
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  await Promise.all(
    [0, 1, 2, 3].map((i) => fetchCached(`check-http/burst-${i}.json`, 'https://check-http.test/data', { maxAgeMs: 0, minIntervalMs: 120 })),
  );
  const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
  check('throttle', gaps.every((g) => g >= 100), `gaps ${gaps.join(', ')}ms`);

  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1
      ? new Response('slow down', { status: 429, headers: { 'retry-after': '2' } })
      : new Response('{"ok":true}', { status: 200 });
  }) as typeof fetch;
  const started = Date.now();
  const body = await fetchCached('check-http/retry.json', 'https://check-http.test/limited', { maxAgeMs: 0 });
  const elapsed = Date.now() - started;
  check('retry-after', body === '{"ok":true}' && calls === 2 && elapsed >= 1900, `${calls} calls in ${elapsed}ms`);
} finally {
  globalThis.fetch = originalFetch;
  await rm(cacheDir, { recursive: true, force: true });
}

if (failures.length) process.exitCode = 1;
