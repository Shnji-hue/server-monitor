import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM = process.env.EMAIL_FROM ?? "no-reply@example.com";

// Number of seconds to enforce cooldown between Resend sends per recipient (default 1 hour)
const RESEND_COOLDOWN_SECONDS = Number(process.env.RESEND_COOLDOWN_SECONDS ?? 3600);
// In-memory map tracking last Resend send timestamp (ms) per recipient.
// NOTE: This is per-process only. For multi-instance deployments, use a shared store (Redis, DB) to coordinate.
const lastResendSentAt: Map<string, number> = new Map();

let transporter: nodemailer.Transporter | null = null;

// Log environment detection for email transport selection
const RESEND_KEY_PRESENT = Boolean(process.env.RESEND_API_KEY);
const SMTP_CONFIGURED = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
// eslint-disable-next-line no-console
console.info(`[email] NODE_ENV=${process.env.NODE_ENV ?? 'undefined'} RESEND_API_KEY=${RESEND_KEY_PRESENT ? 'set' : 'missing'} SMTP_CONFIGURED=${SMTP_CONFIGURED}`);

function DapatkanTransporter() {
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

function IsTransientError(err: any) {
  const transientCodes = ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ECONNREFUSED'];
  if (!err) return false;
  if (typeof err.code === 'string' && transientCodes.includes(err.code)) return true;
  return false;
}

async function KirimDenganCobaUlang(mailOptions: nodemailer.SendMailOptions, retries = 3, baseDelay = 500) {
  const t = DapatkanTransporter();

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

      const isTransient = IsTransientError(err);
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

export async function KirimEmail(to: string, subject: string, text: string, html?: string) {
  const mailOptions: nodemailer.SendMailOptions = { from: FROM, to, subject, text, html };

  const useResend = process.env.NODE_ENV === 'production' && Boolean(process.env.RESEND_API_KEY);
  // eslint-disable-next-line no-console
  console.info(`[email] send request: to=${to} subject="${subject}" useResend=${useResend ? 'yes' : 'no'} NODE_ENV=${process.env.NODE_ENV ?? 'undefined'} RESEND_API_KEY=${process.env.RESEND_API_KEY ? 'set' : 'missing'}`);

  if (!useResend && process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[email] production environment detected but RESEND_API_KEY is not set; falling back to SMTP');
  }

  // Use Resend in production when configured; otherwise use SMTP (development or fallback)
  if (useResend) {
    try {
      // dynamic import so dev environments without the package won't fail
      const mod = await import('resend');
      const ResendClass = (mod as any).Resend ?? (mod as any).default ?? mod;
      const resendClient = new ResendClass(process.env.RESEND_API_KEY);

      // When using Resend for production, prefer a configured static recipient (RESEND_TO)
      const target = process.env.RESEND_TO ?? to;
      const from = process.env.RESEND_FROM ?? FROM;
      const payload = {
        from,
        to: target,
        subject,
        html: html ?? `<pre>${text}</pre>`,
      } as any;

      // Before sending with Resend, check per-recipient cooldown
      const now = Date.now();
      const last = lastResendSentAt.get(target);
      if (last && (now - last) < RESEND_COOLDOWN_SECONDS * 1000) {
        const until = new Date(last + RESEND_COOLDOWN_SECONDS * 1000).toISOString();
        // eslint-disable-next-line no-console
        console.info(`[email] Resend suppressed for ${target}; last sent at ${new Date(last).toISOString()}, next allowed at ${until}`);
        // Do not send via Resend due to cooldown
        return false;
      }

      // eslint-disable-next-line no-console
      console.info('[email] sending via Resend to', target);
      const res = await resendClient.emails.send(payload);
      // on success, record timestamp
      lastResendSentAt.set(target, now);
      // eslint-disable-next-line no-console
      console.info('[email] Resend success id=', res?.id ?? res?.messageId ?? 'unknown');
      return true;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[email] Resend send failed:', err?.message ?? err);
      // Fall back to SMTP if available
      const fallback = await KirimDenganCobaUlang(mailOptions, 3, 500);
      if (fallback.ok) return true;
      // eslint-disable-next-line no-console
      console.error('[email] fallback SMTP failed:', fallback.error ?? 'unknown');
      return false;
    }
  }

  // default: use SMTP with retry logic
  const result = await KirimDenganCobaUlang(mailOptions, 3, 500);
  if (result.ok) return true;

  // eslint-disable-next-line no-console
  console.error('[email] gagal mengirim email setelah retries:', result.error ?? 'unknown');
  return false;
}
