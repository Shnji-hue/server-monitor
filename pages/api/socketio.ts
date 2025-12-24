import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import { PemantauServerSingleton } from '../../services/pemantauServer';
import { GenerateResponseDariGemini } from '../../lib/gemini';

// Augment response type to include the Node socket server with optional `io`
type NextApiResponseWithSocket = NextApiResponse & {
  socket: any & { server?: any & { io?: IOServer } };
};

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  // Ensure socket server exists; if not, end early
  if (!res.socket || !res.socket.server) {
    res.status(500).end('No socket server available');
    return;
  }

  const server = res.socket.server as any & { io?: IOServer };

  if (!server.io) {
    // Create new Socket.IO server and attach
    const io = new IOServer(server, {
      path: '/socket.io',
      cors: { origin: '*' },
    });

    io.on('connection', (socket) => {
      socket.on('user_message', async (payload: { text: string }) => {
        // Broadcast typing start to the sender
        socket.emit('ai_typing', { typing: true });

        try {
          // Snapshot latest server data
          const snapshot = PemantauServerSingleton.ambilStatusTerbaru();
          const systemPrompt = `Anda adalah asisten teknis server. Analisis data berikut: ${JSON.stringify(snapshot)}. Jawab pertanyaan user dengan singkat dan solutif.`;

          // Call Gemini (SDK helper)
          const aiText = await GenerateResponseDariGemini(systemPrompt, payload.text);

          socket.emit('ai_response', { text: aiText });
        } catch (err) {
          socket.emit('ai_response', { error: 'Gagal memproses pesan AI' });
        } finally {
          socket.emit('ai_typing', { typing: false });
        }
      });
    });

    server.io = io;
  }

  res.end();
}
