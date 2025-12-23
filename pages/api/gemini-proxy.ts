import type { NextApiRequest, NextApiResponse } from 'next';
import { generateResponseFromGemini } from '../../lib/gemini';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { userMessage } = req.body ?? {};
    if (!userMessage) return res.status(400).json({ success: false, error: 'userMessage required' });

    // Build system prompt server-side by fetching latest snapshot
    try {
      const statusRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/server-status`);
      const statusJson = await statusRes.json();
      const snapshot = statusJson?.data?.terbaru ?? null;
      const systemPrompt = `Anda adalah asisten teknis server. Analisis data berikut: ${JSON.stringify(
        snapshot
      )}. Jawab pertanyaan user dengan singkat dan solutif.`;

      const text = await generateResponseFromGemini(systemPrompt, userMessage);
      res.status(200).json({ success: true, text });
    } catch (innerErr: any) {
      console.error('[gemini-proxy] Failed to build system prompt:', innerErr);
      // Still attempt to call Gemini with generic prompt
      const systemPrompt = 'Anda adalah asisten teknis server. Jawab pertanyaan user dengan singkat dan solutif.';
      const text = await generateResponseFromGemini(systemPrompt, userMessage);
      res.status(200).json({ success: true, text });
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[gemini-proxy] Error:', err);
    res.status(500).json({ success: false, error: String(err?.message ?? err) });
  }
}
