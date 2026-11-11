// 2-step login (authenticator app codes, RFC 6238) and email alerts for admin activity.
const crypto = require('crypto');
const { db, getSetting } = require('./db');
const { seal, unseal } = require('./esign-ca');

/* ---------- database columns ---------- */
const cols = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
if (!cols.has('totp_secret')) db.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT');      // sealed base32 secret
if (!cols.has('totp_on')) db.exec('ALTER TABLE users ADD COLUMN totp_on INTEGER NOT NULL DEFAULT 0');
if (!cols.has('totp_last')) db.exec('ALTER TABLE users ADD COLUMN totp_last INTEGER NOT NULL DEFAULT 0'); // last used time step (stops a code being used twice)
if (!cols.has('backup_codes')) db.exec('ALTER TABLE users ADD COLUMN backup_codes TEXT');    // JSON list of sha256 hashes

/* ---------- authenticator codes ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32decode(s) {
  s = s.replace(/[\s=-]/g, '').toUpperCase(); let bits = 0, val = 0; const out = [];
  for (const c of s) { const i = B32.indexOf(c); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function hotp(key, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest(), o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
const step = () => Math.floor(Date.now() / 30000);
// returns the matching time step, or 0 (allows one step of clock difference either side)
function checkTotp(secretB32, code, lastStep) {
  code = String(code || '').replace(/\D/g, '');
  if (code.length !== 6) return 0;
  const key = b32decode(secretB32), now = step();
  for (const s of [now, now - 1, now + 1]) {
    if (s <= lastStep) continue;
    if (crypto.timingSafeEqual(Buffer.from(hotp(key, s)), Buffer.from(code))) return s;
  }
  return 0;
}
const newSecret = () => b32encode(crypto.randomBytes(20));
const userSecret = u => u.totp_secret ? unseal(u.totp_secret) : null;
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function newBackupCodes() {
  const codes = Array.from({ length: 10 }, () => { const h = crypto.randomBytes(5).toString('hex'); return h.slice(0, 5) + '-' + h.slice(5); });
  return { codes, hashes: codes.map(c => sha(c)) };
}

// check an authenticator code or a one-time backup code for a user; marks it used
function verifySecondFactor(u, code) {
  const raw = String(code || '').trim().toLowerCase();
  if (/^[0-9a-f]{5}-?[0-9a-f]{5}$/.test(raw)) {
    const norm = raw.replace('-', ''), h = sha(norm.slice(0, 5) + '-' + norm.slice(5));
    const list = JSON.parse(u.backup_codes || '[]'), i = list.indexOf(h);
    if (i < 0) return null;
    list.splice(i, 1);
    db.prepare('UPDATE users SET backup_codes=? WHERE id=?').run(JSON.stringify(list), u.id);
    return { backup: true, left: list.length };
  }
  const s = checkTotp(userSecret(u), raw, u.totp_last || 0);
  if (!s) return null;
  db.prepare('UPDATE users SET totp_last=? WHERE id=?').run(s, u.id);
  return { backup: false };
}

// short-lived tickets between "password correct" and "code correct"
const TICKETS = new Map();
function newTicket(userId, deviceId) {
  const t = crypto.randomBytes(24).toString('base64url');
  TICKETS.set(t, { userId, deviceId, exp: Date.now() + 5 * 60e3, tries: 0 });
  for (const [k, v] of TICKETS) if (v.exp < Date.now()) TICKETS.delete(k);
  return t;
}
function useTicket(t) {
  const v = TICKETS.get(String(t || ''));
  if (!v || v.exp < Date.now()) { TICKETS.delete(t); return null; }
  return v;
}

/* ---------- email alerts ---------- */
let transport = null;
// empty, "none", "-" or "off" means: no email set up
const envOn = k => { const v = String(process.env[k] || '').trim(); return v && !/^(none|no|off|false|-|null|n\/a)$/i.test(v) ? v : ''; };
const mailReady = () => !!(envOn('SMTP_HOST') && envOn('SMTP_USER') && envOn('SMTP_PASS'));
function mailer() {
  if (!mailReady()) return null;
  if (!transport) {
    const nodemailer = require('nodemailer');
    const port = +envOn('SMTP_PORT') || 465;
    transport = nodemailer.createTransport({ host: envOn('SMTP_HOST'), port, secure: port === 465, auth: { user: envOn('SMTP_USER'), pass: envOn('SMTP_PASS') } });
  }
  return transport;
}
const alertTo = () => (getSetting('alert_email') || '').trim() || (db.prepare("SELECT email FROM users WHERE role='admin' ORDER BY id LIMIT 1").get() || {}).email;
// sends without making the request wait; failures are only logged
function alert(subject, lines) {
  if (getSetting('alert_admin') !== '1') return;
  const m = mailer(), to = alertTo();
  if (!m || !to) return;
  const app = getSetting('app_name');
  const text = lines.filter(Boolean).join('\n') + `\n\nTime: ${new Date().toUTCString()}\n\nIf this wasn't you, change your password now and check the Activity tab in the admin console.\n— ${app}`;
  m.sendMail({ from: envOn('SMTP_FROM') || envOn('SMTP_USER'), to, subject: `[${app}] ${subject}`, text })
    .catch(e => console.warn('alert email failed:', e.message));
}
async function sendTest(to) {
  const m = mailer(); if (!m) throw new Error('Email is not set up on the server (SMTP settings missing).');
  await m.sendMail({ from: envOn('SMTP_FROM') || envOn('SMTP_USER'), to, subject: `[${getSetting('app_name')}] Test email`, text: 'Admin alerts are working. You will get an email like this when someone logs in as an administrator.' });
}
const who = req => `IP: ${req.ip}\nBrowser: ${String(req.headers['user-agent'] || '').slice(0, 160)}`;

module.exports = { newSecret, userSecret, checkTotp, verifySecondFactor, newBackupCodes, newTicket, useTicket, TICKETS, seal, alert, sendTest, mailReady, mailer, alertTo, who };
