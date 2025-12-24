import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM = process.env.EMAIL_FROM ?? "no-reply@example.com";

let transporter: nodemailer.Transporter | null = null;

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

  // Use Resend in production when configured; otherwise use SMTP (development or fallback)
  if (process.env.NODE_ENV === 'production' && process.env.RESEND_API_KEY) {
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

      // eslint-disable-next-line no-console
      console.info('[email] sending via Resend to', target);
      const res = await resendClient.emails.send(payload);
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
