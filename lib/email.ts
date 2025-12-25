import nodemailer from "nodemailer";

// Ambil pengaturan SMTP dari environment untuk koneksi SMTP (host, port, user, pass).
// `FROM` adalah alamat pengirim default yang dipakai saat mengirim email jika tidak di-set lainnya.
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM = process.env.EMAIL_FROM ?? "no-reply@example.com";

// Jeda (detik) minimal antara pengiriman via Resend untuk satu penerima agar tidak spam.
// `lastResendSentAt` menyimpan waktu kirim terakhir per penerima di memori proses ini saja.
const RESEND_COOLDOWN_SECONDS = Number(process.env.RESEND_COOLDOWN_SECONDS ?? 3600);
const lastResendSentAt: Map<string, number> = new Map();

// `transporter` adalah singleton untuk koneksi SMTP yang dipakai berulang kali.
// Variabel deteksi environment dipakai untuk memutuskan apakah akan pakai Resend atau SMTP.
let transporter: nodemailer.Transporter | null = null;

const RESEND_KEY_PRESENT = Boolean(process.env.RESEND_API_KEY);
const SMTP_CONFIGURED = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
console.info(`[email] NODE_ENV=${process.env.NODE_ENV ?? 'undefined'} RESEND_API_KEY=${RESEND_KEY_PRESENT ? 'set' : 'missing'} SMTP_CONFIGURED=${SMTP_CONFIGURED}`);

// Buat atau kembalikan transporter SMTP yang dikonfigurasi, atau `null` jika tidak ada konfigurasi.
// Transporter dibuat sekali dan disimpan agar koneksi dapat dipakai ulang dan lebih efisien.
function DapatkanTransporter() {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
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
    console.info('[email] SMTP transporter verified');
  }).catch((err) => {
    console.warn('[email] SMTP transporter verification failed:', err?.code ?? err?.message ?? err);
  });

  return transporter;
}

// Cek apakah error bersifat sementara (contoh: timeout atau koneksi ditolak).
// Error sementara akan memicu retry dengan strategi backoff di fungsi pengirim.
function IsTransientError(err: any) {
  const transientCodes = ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ECONNREFUSED'];
  if (!err) return false;
  if (typeof err.code === 'string' && transientCodes.includes(err.code)) return true;
  return false;
}

// Kirim email via SMTP dengan mekanisme retry bila terjadi error sementara.
// Fungsi ini mencoba beberapa kali dengan exponential backoff, dan mengembalikan hasil sukses/gagal.
async function KirimDenganCobaUlang(mailOptions: nodemailer.SendMailOptions, retries = 3, baseDelay = 500) {
  const t = DapatkanTransporter();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const attemptNum = attempt + 1;
    try {
      if (!t) throw new Error('SMTP not configured');

      console.info(`[email] sending attempt ${attemptNum} via SMTP to ${mailOptions.to}`);
      const info = await t.sendMail(mailOptions);
      console.info(`[email] SMTP success to ${mailOptions.to} id=${(info && (info as any).messageId) ?? 'unknown'}`);
      return { ok: true, via: 'smtp', info };
    } catch (err: any) {
      console.error(`[email] send attempt ${attemptNum} failed:`, err?.code ?? err?.message ?? err);

      const isTransient = IsTransientError(err);
      if (attempt === retries || !isTransient) {
        return { ok: false, error: err };
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.info(`[email] transient error - retrying in ${delay}ms`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  return { ok: false, error: new Error('Retries exhausted') };
}

// Fungsi utama untuk mengirim email. Fungsi ini memilih antara Resend (production) atau SMTP (default/fallback) dan menyiapkan opsi pengiriman.
export async function KirimEmail(to: string, subject: string, text: string, html?: string) {
  const mailOptions: nodemailer.SendMailOptions = { from: FROM, to, subject, text, html };

  const useResend = process.env.NODE_ENV === 'production' && Boolean(process.env.RESEND_API_KEY);
  console.info(`[email] send request: to=${to} subject="${subject}" useResend=${useResend ? 'yes' : 'no'} NODE_ENV=${process.env.NODE_ENV ?? 'undefined'} RESEND_API_KEY=${process.env.RESEND_API_KEY ? 'set' : 'missing'}`);

  if (!useResend && process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
    console.warn('[email] production environment detected but RESEND_API_KEY is not set; falling back to SMTP');
  }

  // Jika environment production dan API key Resend tersedia, kirim melalui Resend.
  // Sebelum mengirim, fungsi ini memeriksa cooldown per-penerima dan merekam waktu kirim jika berhasil.
  if(useResend) {
    try {
      const mod = await import('resend');
      const ResendClass = (mod as any).Resend ?? (mod as any).default ?? mod;
      const resendClient = new ResendClass(process.env.RESEND_API_KEY);

      const target = process.env.RESEND_TO ?? to;
      const from = process.env.RESEND_FROM ?? FROM;
      const payload = {
        from,
        to: target,
        subject,
        html: html ?? `<pre>${text}</pre>`,
      } as any;

      const now = Date.now();
      const last = lastResendSentAt.get(target);
      if (last && (now - last) < RESEND_COOLDOWN_SECONDS * 1000) {
        const until = new Date(last + RESEND_COOLDOWN_SECONDS * 1000).toISOString();
        console.info(`[email] Resend suppressed for ${target}; last sent at ${new Date(last).toISOString()}, next allowed at ${until}`);
        return false;
      }

      console.info('[email] sending via Resend to', target);
      const res = await resendClient.emails.send(payload);
      lastResendSentAt.set(target, now);
      console.info('[email] Resend success id=', res?.id ?? res?.messageId ?? 'unknown');
      return true;
    } catch (err: any) {
      console.error('[email] Resend send failed:', err?.message ?? err);
      const fallback = await KirimDenganCobaUlang(mailOptions, 3, 500);
      if (fallback.ok) return true;
      console.error('[email] fallback SMTP failed:', fallback.error ?? 'unknown');
      return false;
    }
  }

  // Jika tidak menggunakan Resend atau Resend gagal, gunakan SMTP dengan mekanisme retry.
  // Fungsi KirimDenganCobaUlang akan mencoba beberapa kali dan mengembalikan status sukses/gagal.
  const result = await KirimDenganCobaUlang(mailOptions, 3, 500);
  if (result.ok) return true;

  console.error('[email] gagal mengirim email setelah retries:', result.error ?? 'unknown');
  return false;
}
