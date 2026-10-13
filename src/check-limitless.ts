import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { RAW_DIR } from './lib/http.js';
import { ingestLimitless } from './sources/limitless.js';

const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${detail}`);
  if (!ok) failures.push(name);
};

const now = new Date().toISOString();
const tournaments = [
  { id: 'check-ok', name: 'Check Alpha', date: now, format: 'M-C', players: 2 },
  { id: 'check-bad', name: 'Check Beta', date: now, format: 'M-C', players: 2 },
];
const standings = [{ player: 'A', decklist: [{ name: 'Rillaboom', attacks: ['Wood Hammer'] }] }];

const listPath = join(RAW_DIR, 'limitless', 'list-M-C-p1.json');
const standingsDir = join(RAW_DIR, 'limitless', 'standings');
const originalFetch = globalThis.fetch;
let failOk = false;
try {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/tournaments?')) return Response.json(tournaments);
    if (url.includes('/tournaments/check-ok/standings')) {
      return failOk ? new Response('gone', { status: 404 }) : Response.json(standings);
    }
    if (url.includes('/tournaments/check-bad/standings')) return new Response('gone', { status: 404 });
    return new Response('unexpected', { status: 500 });
  }) as typeof fetch;

  const partial = await ingestLimitless('M-C');
  check('partial failure', partial.sets.length === 1 && partial.failed.join() === 'check-bad', `sets ${partial.sets.length}, failed ${partial.failed.join(', ')}`);

  failOk = true;
  await rm(join(standingsDir, 'check-ok.json'), { force: true });
  let threw = false;
  try {
    await ingestLimitless('M-C');
  } catch {
    threw = true;
  }
  check('total failure', threw, 'all standings failing still aborts the ingest');
} finally {
  globalThis.fetch = originalFetch;
  await rm(listPath, { force: true });
  await rm(join(standingsDir, 'check-ok.json'), { force: true });
  await rm(join(standingsDir, 'check-bad.json'), { force: true });
}

if (failures.length) process.exitCode = 1;
