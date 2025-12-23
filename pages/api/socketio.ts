import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import { pemantauServer } from '../../services/pemantauServer';
import { generateResponseFromGemini } from '../../lib/gemini';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // @ts-ignore - attach to the server socket once
  if (!res.socket.server.io) {
    // Create new Socket.IO server and attach
    const io = new IOServer(res.socket.server as any, {
      path: '/socket.io',
      cors: { origin: '*' },
    });

    io.on('connection', (socket) => {
      socket.on('user_message', async (payload: { text: string }) => {
        // Broadcast typing start to the sender
        socket.emit('ai_typing', { typing: true });

        try {
          // Snapshot latest server data
          const snapshot = pemantauServer.ambilStatusTerbaru();
          const systemPrompt = `Anda adalah asisten teknis server. Analisis data berikut: ${JSON.stringify(snapshot)}. Jawab pertanyaan user dengan singkat dan solutif.`;

          // Call Gemini (SDK helper)
          const aiText = await generateResponseFromGemini(systemPrompt, payload.text);

          socket.emit('ai_response', { text: aiText });
        } catch (err) {
          socket.emit('ai_response', { error: 'Gagal memproses pesan AI' });
        } finally {
          socket.emit('ai_typing', { typing: false });
        }
      });
    });

    // @ts-ignore
    res.socket.server.io = io;
  }

  res.end();
}
