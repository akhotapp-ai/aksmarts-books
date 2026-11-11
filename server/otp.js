// One-time codes by email (for "Forgot password?" and adding an email), plus mobile-number helpers.
// Email codes use the same SMTP settings as the admin alerts. No text messages (SMS) are sent.
const crypto = require('crypto');
const { db } = require('./db');

/* ---------- database columns ---------- */
const cols = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
if (!cols.has('phone')) db.exec('ALTER TABLE users ADD COLUMN phone TEXT');                      // +919876543210, verified
if (!cols.has('otp_login')) db.exec('ALTER TABLE users ADD COLUMN otp_login INTEGER NOT NULL DEFAULT 0'); // ask for a code after the password
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_phone ON users(phone) WHERE phone IS NOT NULL');

const envOn = k => { const v = String(process.env[k] || '').trim(); return v && !/^(none|no|off|false|-|null|n\/a)$/i.test(v) ? v : ''; };

/* ---------- email addresses and mobile numbers ---------- */
// accounts made with only a mobile number get a placeholder email that can never receive mail
const PHONE_DOMAIN = '@phone.invalid';
const isPhoneEmail = e => String(e || '').endsWith(PHONE_DOMAIN);
const phoneEmail = phone => 'p' + phone.replace(/\D/g, '') + PHONE_DOMAIN;
function cleanPhone(v) {
  let s = String(v || '').trim().replace(/[\s().-]/g, '');
  if (/^0\d{10}$/.test(s)) s = s.slice(1);                 // 09876543210
  if (/^[6-9]\d{9}$/.test(s)) s = '+91' + s;                // 9876543210 (India)
  if (/^00\d+$/.test(s)) s = '+' + s.slice(2);
  if (/^91[6-9]\d{9}$/.test(s)) s = '+' + s;
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  if (s.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(s)) return null;
  return s;
}
const cleanEmail = e => String(e || '').trim().toLowerCase();
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200 && !isPhoneEmail(e);
// "someone@example.com" or a mobile number → { kind, value } or null
function target(v) {
  const s = String(v || '').trim();
  if (s.includes('@')) { const e = cleanEmail(s); return emailOk(e) ? { kind: 'email', value: e } : null; }
  const p = cleanPhone(s); return p ? { kind: 'sms', value: p } : null;
}
const mask = t => t.kind === 'email'
  ? t.value.replace(/^(.)(.*)(@.*)$/, (m, a, b, c) => a + '•'.repeat(Math.min(6, Math.max(2, b.length))) + c)
  : t.value.slice(0, 3) + ' •••••• ' + t.value.slice(-4);

/* ---------- sending ---------- */
// Codes are sent by email only (free, uses the SMTP settings). Text messages (SMS) are not used.
const smsReady = () => false;
// for testing only: print codes in the server log instead of sending them (never on a live site)
const devLog = () => envOn('OTP_DEV_LOG') === '1' && process.env.NODE_ENV !== 'production';
let SEC = null; // set by init() to avoid a require loop
const emailReady = () => !!(SEC && SEC.mailReady()) || devLog();

async function sendEmail(to, code, app) {
  const m = SEC && SEC.mailer && SEC.mailer();
  const text = `Your ${app} code is ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email; nobody can log in without the code.\n\n— ${app}`;
  if (!m) { if (devLog()) { console.log(`[OTP test] email to ${to}: ${code}`); return; } throw new Error('Email is not set up on the server.'); }
  await m.sendMail({ from: envOn('SMTP_FROM') || envOn('SMTP_USER'), to, subject: `${code} is your ${app} code`, text });
}

/* ---------- codes ---------- */
// a code lives 10 minutes, allows 5 tries, and is stored only as a keyed hash
const PEPPER = crypto.randomBytes(32);
const hash = (ticket, code) => crypto.createHmac('sha256', PEPPER).update(ticket + ':' + code).digest();
const CODES = new Map();
const TTL = 10 * 60e3, RESEND = 30e3;
setInterval(() => { const t = Date.now(); for (const [k, v] of CODES) if (v.exp < t) CODES.delete(k); }, 60e3).unref();

// data: what the code is for ({ purpose, userId, deviceId, ... }); returns the ticket
async function issue(t, data, app) {
  const ticket = crypto.randomBytes(24).toString('base64url');
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  if (t.kind !== 'email') throw new Error('Codes are sent by email only.');
  await sendEmail(t.value, code, app);
  CODES.set(ticket, { ...data, target: t, h: hash(ticket, code), exp: Date.now() + TTL, sent: Date.now(), tries: 0, resends: 0 });
  return ticket;
}
async function resend(ticket, app) {
  const v = CODES.get(String(ticket || ''));
  if (!v || v.exp < Date.now()) return { error: 'expired' };
  if (Date.now() - v.sent < RESEND) return { error: 'wait', wait: Math.ceil((RESEND - (Date.now() - v.sent)) / 1000) };
  if (v.resends >= 3) return { error: 'too_many' };
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  await sendEmail(v.target.value, code, app);
  Object.assign(v, { h: hash(ticket, code), exp: Date.now() + TTL, sent: Date.now(), tries: 0, resends: v.resends + 1 });
  return { ok: true };
}
// → { ok, data } | { error: 'expired' | 'wrong' | 'too_many' }
function check(ticket, code, purpose) {
  ticket = String(ticket || '');
  const v = CODES.get(ticket);
  if (!v || v.exp < Date.now() || (purpose && v.purpose !== purpose)) { CODES.delete(ticket); return { error: 'expired' }; }
  code = String(code || '').replace(/\D/g, '');
  if (++v.tries > 5) { CODES.delete(ticket); return { error: 'too_many' }; }
  if (code.length !== 6 || !crypto.timingSafeEqual(hash(ticket, code), v.h)) return { error: 'wrong', left: 5 - v.tries };
  return { ok: true, data: v };
}
const peek = ticket => { const v = CODES.get(String(ticket || '')); return v && v.exp > Date.now() ? v : null; };
const done = ticket => CODES.delete(String(ticket || ''));

function init(sec) { SEC = sec; }
const status = () => ({ email: emailReady(), test_mode: devLog() });

module.exports = { init, status, target, mask, cleanPhone, isPhoneEmail, phoneEmail, issue, resend, check, peek, done, emailReady, smsReady };
