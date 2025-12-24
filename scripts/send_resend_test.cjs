// scripts/send_resend_test.cjs
// Standalone test script for sending an email via Resend API.
// USAGE:
// 1) Add your key to .env.local: RESEND_API_KEY=re_...
// 2) (optional) set RESEND_FROM, RESEND_TO, RESEND_SUBJECT
// 3) Run: node scripts/send_resend_test.cjs
// NOTE: Do NOT commit your API key to the repo. Keep it in .env.local or pass via env when running.

require('dotenv').config({ path: '.env.local' });

const key = process.env.RESEND_API_KEY;
if (!key) {
  console.error('ERROR: RESEND_API_KEY not found in environment. Set it in .env.local or pass it via env.');
  process.exitCode = 1;
  process.exit();
}

// Import Resend. The package supports CommonJS require.
let Resend;
try {
  Resend = require('resend').Resend;
} catch (e) {
  console.error('Error importing `resend`. Have you installed it? Run `npm i resend`');
  console.error(e);
  process.exit(1);
}

const resend = new Resend(key);

async function main() {
  console.log('Found RESEND_API_KEY: yes (not printing value)');

  const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const to = process.env.RESEND_TO || 'recipient@example.com';
  const subject = process.env.RESEND_SUBJECT || 'Hello from Resend (test)';
  const htmlBody = process.env.RESEND_HTML || '<p>Congrats on sending your <strong>first email</strong>!</p>';

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html: htmlBody,
    });

    console.log('Email sent. Result id:', result.id || result.messageId || result);
    console.log('Full response:', JSON.stringify(result));
  } catch (err) {
    console.error('Send failed:', err);
    process.exit(1);
  }
}

main();
