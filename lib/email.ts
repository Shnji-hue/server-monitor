import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM = process.env.EMAIL_FROM ?? "no-reply@example.com";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // eslint-disable-next-line no-console
    console.warn("[email] SMTP not configured - emails will be skipped");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });

  // verify transporter and log status
  transporter.verify().then(() => {
    // eslint-disable-next-line no-console
    console.info('[email] SMTP transporter verified');
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[email] SMTP transporter verification failed:', err?.code ?? err?.message ?? err);
  });

  return transporter;
}

function isTransientError(err: any) {
  const transientCodes = ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ECONNREFUSED'];
  if (!err) return false;
  if (typeof err.code === 'string' && transientCodes.includes(err.code)) return true;
  return false;
}

async function sendWithRetry(mailOptions: nodemailer.SendMailOptions, retries = 3, baseDelay = 500) {
  const t = getTransporter();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const attemptNum = attempt + 1;
    try {
      if (!t) throw new Error('SMTP not configured');

      // eslint-disable-next-line no-console
      console.info(`[email] sending attempt ${attemptNum} via SMTP to ${mailOptions.to}`);
      const info = await t.sendMail(mailOptions);
      // eslint-disable-next-line no-console
      console.info(`[email] SMTP success to ${mailOptions.to} id=${(info && (info as any).messageId) ?? 'unknown'}`);
      return { ok: true, via: 'smtp', info };
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(`[email] send attempt ${attemptNum} failed:`, err?.code ?? err?.message ?? err);

      const isTransient = isTransientError(err);
      if (attempt === retries || !isTransient) {
        return { ok: false, error: err };
      }

      // exponential backoff before retrying
      const delay = baseDelay * Math.pow(2, attempt);
      // eslint-disable-next-line no-console
      console.info(`[email] transient error - retrying in ${delay}ms`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  return { ok: false, error: new Error('Retries exhausted') };
}

export async function kirimEmail(to: string, subject: string, text: string, html?: string) {
  const mailOptions: nodemailer.SendMailOptions = { from: FROM, to, subject, text, html };

  // attempt send with retries
  const result = await sendWithRetry(mailOptions, 3, 500);
  if (result.ok) return true;

  // eslint-disable-next-line no-console
  console.error('[email] gagal mengirim email setelah retries:', result.error ?? 'unknown');
  return false;
}
