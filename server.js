import 'dotenv/config';
import http from 'http';
import next from 'next';
import { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT ?? '3000', 10);

function GetSocketSecret() {
  return process.env.SOCKET_AUTH_SECRET || 'please_set_SOCKET_AUTH_SECRET_in_env';
}
// Note: do not read the secret at import time, Next may load .env later in dev mode


// Simple in-memory rate limiter per socket id
class RateLimiter {
  constructor(maxMessages = 10, perMillis = 60_000) {
    this.maxMessages = maxMessages;
    this.perMillis = perMillis;
    this.map = new Map();
  }

  allow(key) {
    const now = Date.now();
    const state = this.map.get(key) || { timestamps: [] };
    // remove old timestamps
    state.timestamps = state.timestamps.filter((t) => t > now - this.perMillis);
    if (state.timestamps.length >= this.maxMessages) {
      this.map.set(key, state);
      return false;
    }
    state.timestamps.push(now);
    this.map.set(key, state);
    return true;
  }
}

const limiter = new RateLimiter(12, 60_000); // 12 messages per minute

async function PanggilGeminiProxy(systemPrompt, userMessage) {
  // call internal Next API (gemini-proxy) so server-only API key logic is used
  const url = `http://localhost:${port}/api/gemini-proxy`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userMessage }),
  });
  if (!res.ok) throw new Error(`Gemini proxy error: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Unknown');
  return json.text;
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => handle(req, res));
  const io = new IOServer(server, { path: '/socket.io', cors: { origin: '*' } });

  io.use((socket, next) => {
    // accept token from auth or query for broader compatibility
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    console.info('[socket] handshake received. auth:', JSON.stringify(socket.handshake.auth), 'query:', JSON.stringify(socket.handshake.query));
    if (!token) {
      console.warn('[socket] auth failed: no token');
      return next(new Error('Authentication token required'));
    }
    console.info('[socket] verifying token (prefix):', String(token).slice(0, 8), '...');
    try {
      const secret = GetSocketSecret();
      const payload = jwt.verify(token, secret);
      // optionally attach payload to socket
      socket.data.payload = payload;
      console.info('[socket] token valid, payload:', payload, 'using secret prefix:', String(secret).slice(0, 8));
      return next();
    } catch (err) {
      // attempt to decode the token to aid debugging
      try {
        const decoded = jwt.decode(token);
        console.error('[socket] JWT verify failed:', err?.message ?? err, 'decoded:', decoded, 'current secret prefix:', String(GetSocketSecret()).slice(0, 8));
      } catch (decErr) {
        console.error('[socket] JWT verify failed and decode failed:', err?.message ?? err, decErr);
      }
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('[socket] connected', socket.id);

    socket.on('message', async (payload) => {
      // payload: { text }
      if (!limiter.allow(socket.id)) {
        socket.emit('ai_response', { error: 'Rate limit exceeded. Please wait a moment.' });
        return;
      }

      const text = String(payload?.text ?? '').trim();
      if (!text) return;

      socket.emit('ai_typing', { typing: true });

      try {
        // get latest snapshot from server-status
        const statusRes = await fetch(`http://localhost:${port}/api/server-status`);
        const statusJson = await statusRes.json();
        const snapshot = statusJson?.data?.terbaru ?? null;

        const systemPrompt = `Anda adalah asisten teknis server. Analisis data berikut: ${JSON.stringify(
          snapshot
        )}. Jawab pertanyaan user dengan singkat dan solutif.`;

        const aiText = await PanggilGeminiProxy(systemPrompt, text);
        socket.emit('ai_response', { text: aiText });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[socket] AI call error:', err);
        const msg = err?.message ? String(err.message).slice(0, 200) : 'Gagal memproses permintaan AI';
        socket.emit('ai_response', { error: `Gagal memproses permintaan AI: ${msg}` });
      } finally {
        socket.emit('ai_typing', { typing: false });
      }
    });

    socket.on('disconnect', () => {
      console.log('[socket] disconnect', socket.id);
    });
  });

  server.listen(port, () => {
    console.log(`> Custom server ready - http://localhost:${port}`);
  });
});
