/**
 * Minimal local backend for testing the pipeline before ITS is connected.
 *
 *   npm run server        (reads INGEST_KEY, PORT, DB_PATH from .env.local)
 *
 * POST /ingest     ITS (or scripts/simulator.ts) posts zone counts. Needs the x-ingest-key header.
 * GET  /occupancy  The app's Snapshot. Optional ?at=<ISO time> to see the map as of another time.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

import { handleIngest, type HttpResult } from './ingest';
import { buildSnapshot } from './snapshot';
import { SqliteStore } from './sqliteStore';

// --- Settings, from environment variables (.env.local via the npm script) -------------------
const INGEST_KEY = process.env.INGEST_KEY;
const PORT = Number(process.env.PORT ?? 4000);
const DB_PATH = process.env.DB_PATH ?? join(__dirname, 'data', 'occupied.db');
/** Reject request bodies over 1 MB (a real reading is a few KB). */
const MAX_BODY = 1024 * 1024;

// Refuse to start without a key, rather than accepting data from anyone.
if (!INGEST_KEY) {
  console.error('INGEST_KEY is not set. Add it to .env.local (see TESTING.md).');
  process.exit(1);
}
const ingestKey = INGEST_KEY;
const store = new SqliteStore(DB_PATH);

// --- The HTTP server: look at the method + path and hand off to the right function --------
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    // Browsers send OPTIONS first to ask "may I call this?" (CORS). Just say yes.
    if (req.method === 'OPTIONS') return send(res, { status: 204, body: {} });
    if (req.method === 'POST' && url.pathname === '/ingest') {
      const body = await readBody(req);
      if (body === null) return send(res, { status: 413, body: { error: 'Body too large' } });
      const key = req.headers['x-ingest-key'];
      const result = handleIngest(store, ingestKey, Array.isArray(key) ? key[0] : key, body);
      if (result.status !== 200) console.warn(`POST /ingest ${result.status}: ${String(result.body.error)}`);
      return send(res, result);
    }
    if (req.method === 'GET' && url.pathname === '/occupancy') {
      const atParam = url.searchParams.get('at');
      const at = atParam ? Date.parse(atParam) : Date.now();
      if (Number.isNaN(at)) return send(res, { status: 400, body: { error: 'at must be an ISO time' } });
      return send(res, { status: 200, body: buildSnapshot(store, at) });
    }
    send(res, { status: 404, body: { error: 'Not found' } });
  } catch (e) {
    console.error(e);
    send(res, { status: 500, body: { error: 'Server error' } });
  }
});

/** Read the request body as text, in chunks. Returns null if it's bigger than MAX_BODY. */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Send a JSON response. */
function send(res: ServerResponse, { status, body }: HttpResult) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    // The app on web runs on another port, so allow cross-origin reads. /ingest still needs the key.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-ingest-key',
  });
  res.end(status === 204 ? undefined : JSON.stringify(body));
}

// Listen on every network interface ('0.0.0.0') so phones on the same Wi-Fi can connect,
// then print the addresses to use.
server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => `http://${a!.address}:${PORT}`);
  console.log(`Occupied server on http://localhost:${PORT}${lan.length ? ` (LAN: ${lan.join(', ')})` : ''}`);
  console.log(`Database: ${DB_PATH}`);
});
