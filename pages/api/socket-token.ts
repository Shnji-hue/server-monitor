import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const SECRET = process.env.SOCKET_AUTH_SECRET || 'please_set_SOCKET_AUTH_SECRET_in_env';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Simple endpoint that issues a short-lived token for socket auth
  // No user auth here (demo). In real apps, require user authentication (session)
  try {
    const payload = { role: 'client' };
    // token expires in 15 minutes (more tolerant for dev)
    const token = jwt.sign(payload, SECRET, { expiresIn: '15m' });
    // log partial token and secret prefix for debugging (dev only)
    // eslint-disable-next-line no-console
    console.info('[socket-token] issued token:', token.slice(0, 8), '...', 'secret prefix:', String(SECRET).slice(0, 8));
    res.status(200).json({ success: true, token });
  } catch (err: any) {
    res.status(500).json({ success: false, error: String(err?.message ?? err) });
  }
}
