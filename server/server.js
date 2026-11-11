'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const forge = require('node-forge');
const SEO = require('./seo');
const { db, DATA_DIR, allSettings, getSetting, setSetting, freePeriod, DEFAULTS } = require('./db');

const DAY = 86400e3;
const now = () => Date.now();
const PUBLIC = path.join(__dirname, '..', 'public');
const SESSION_DAYS = 30;

/* ---------- passwords ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [, salt, hex] = String(stored).split('$');
  if (!salt || !hex) return false;
  const h = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(h, Buffer.from(hex, 'hex'));
}
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));
const pwProblem = pw => (typeof pw !== 'string' || pw.length < 8) ? 'Use a password of at least 8 characters.' : pw.length > 200 ? 'That password is too long.' : null;
const cleanEmail = e => String(e || '').trim().toLowerCase();
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200;

const SEC = require('./security');
const OTP = require('./otp'); OTP.init(SEC);
const PERSIST = require('./persist');
/* ---------- CLI: switch off 2-step login for an account whose phone was lost ---------- */
if (process.argv[2] === 'reset-2fa') {
  const e = cleanEmail(process.argv[3]); if (!e) { console.log('Usage: npm run reset-2fa -- <email>'); process.exit(1); }
  const r = db.prepare('UPDATE users SET totp_on=0, totp_secret=NULL, backup_codes=NULL WHERE email=?').run(e);
  console.log(r.changes ? `2-step login switched off for ${e}. Log in with the password and set it up again.` : 'No account with that email.');
  return PERSIST.finish(db, 0);
}
/* ---------- CLI: create or promote an admin ---------- */
if (process.argv[2] === 'create-admin') {
  const [email, password, ...nameParts] = process.argv.slice(3);
  if (!email || !password) { console.log('Usage: npm run create-admin -- <email> <password> [name]'); process.exit(1); }
  const e = cleanEmail(email), u = db.prepare('SELECT * FROM users WHERE email=?').get(e);
  if (u) db.prepare("UPDATE users SET role='admin', pass_hash=?, status='active' WHERE id=?").run(hashPassword(password), u.id);
  else db.prepare("INSERT INTO users(email,name,pass_hash,role,created_at) VALUES(?,?,?,'admin',?)").run(e, nameParts.join(' ') || 'Administrator', hashPassword(password), now());
  console.log(`Admin account ready: ${e}`);
  return PERSIST.finish(db, 0);
}

/* ---------- hosts without a command line (e.g. Render's free plan): settings do the same jobs ---------- */
// ADMIN_EMAIL + ADMIN_PASSWORD: creates that admin account on start if it doesn't exist yet (never changes an existing one)
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const e = cleanEmail(process.env.ADMIN_EMAIL);
  if (emailOk(e) && !db.prepare('SELECT 1 FROM users WHERE email=?').get(e)) {
    if (pwProblem(process.env.ADMIN_PASSWORD)) console.warn('ADMIN_PASSWORD must be at least 8 characters; admin not created.');
    else { db.prepare("INSERT INTO users(email,name,pass_hash,role,created_at) VALUES(?,?,?,'admin',?)").run(e, 'Administrator', hashPassword(process.env.ADMIN_PASSWORD), now()); console.log(`Admin account created: ${e}`); }
  }
}
// RESET_2FA=<email>: switches off 2-step login for that account on start (for a lost phone). Remove it again afterwards.
if (process.env.RESET_2FA) {
  const r = db.prepare('UPDATE users SET totp_on=0, totp_secret=NULL, backup_codes=NULL WHERE email=? AND totp_on=1').run(cleanEmail(process.env.RESET_2FA));
  if (r.changes) console.log(`2-step login switched off for ${process.env.RESET_2FA}. Remove the RESET_2FA setting now.`);
}

const { CA, userSigner, guestSigner } = require('./esign-ca');
const Cms = require('./cms')(forge);

/* ---------- licence-token signing key (lets the app keep working offline for a few days) ---------- */
const TOKEN_KEY_FILE = path.join(DATA_DIR, 'license-ed25519.pem');
if (!fs.existsSync(TOKEN_KEY_FILE)) {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(TOKEN_KEY_FILE, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
}
const TOKEN_PRIV = crypto.createPrivateKey(fs.readFileSync(TOKEN_KEY_FILE));
const TOKEN_PUB = Buffer.from(crypto.createPublicKey(TOKEN_PRIV).export({ format: 'jwk' }).x, 'base64url').toString('hex');
const CODE_SECRET_FILE = path.join(DATA_DIR, 'app-code.key');
if (!fs.existsSync(CODE_SECRET_FILE)) fs.writeFileSync(CODE_SECRET_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
// a new key for every build of the app, so old copies stop working after an update
const APP_KEY = (() => { let build = ''; try { build = crypto.createHash('sha256').update(fs.readFileSync(path.join(PUBLIC, 'app.html'))).digest('hex'); } catch (e) {} return crypto.createHmac('sha256', fs.readFileSync(CODE_SECRET_FILE, 'utf8').trim()).update(build).digest(); })();
const APP_KEY_HEX = () => APP_KEY.toString('hex');
function licenseToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), TOKEN_PRIV).toString('base64url');
}

/* ---------- audit ---------- */
const audit = (actor, action, target, detail) =>
  db.prepare('INSERT INTO audit(actor_id,action,target,detail,created_at) VALUES(?,?,?,?,?)').run(actor ?? null, action, target == null ? null : String(target), detail == null ? null : String(detail), now());

/* ---------- licences ---------- */
function licenseState(user) {
  const s = allSettings();
  const rows = db.prepare('SELECT * FROM licenses WHERE user_id=? ORDER BY id DESC').all(user.id);
  const t = now();
  const live = rows.filter(r => r.status === 'active' && (r.expires_at == null || r.expires_at > t));
  const best = live.find(r => r.kind === 'paid') || live.find(r => r.kind === 'trial');
  if (user.role === 'admin') return { plan: 'admin', active: true, expires_at: null, days_left: null, label: 'Owner' };
  if (best && best.kind === 'paid') return paidState(best, t);
  // free period for everyone: accounts without a paid licence get the full app too
  const fp = freePeriod();
  if (fp) return { plan: 'promo', active: true, expires_at: fp.end, days_left: fp.days_left, until: fp.until || null, label: fp.until ? `Free until ${niceDate(fp.until)}` : 'Free for everyone' };
  if (best) {
    const days = best.expires_at == null ? null : Math.max(0, Math.ceil((best.expires_at - t) / DAY));
    return {
      plan: best.kind, active: true, expires_at: best.expires_at, days_left: days,
      label: best.kind === 'trial' ? `Free trial · ${days} day${days === 1 ? '' : 's'} left` : best.expires_at == null ? 'Pro · lifetime' : `Pro · until ${new Date(best.expires_at).toISOString().slice(0, 10)}`
    };
  }
  const last = rows[0];
  let reason = 'none', label = 'No licence';
  if (last) {
    if (last.status === 'cancelled') { reason = last.kind === 'trial' ? 'trial_cancelled' : 'cancelled'; label = last.kind === 'trial' ? 'Trial cancelled' : 'Licence cancelled'; }
    else if (last.status === 'revoked') { reason = 'revoked'; label = 'Licence revoked'; }
    else { reason = last.kind === 'trial' ? 'trial_expired' : 'expired'; label = last.kind === 'trial' ? 'Trial ended' : 'Licence expired'; }
  }
  return { plan: 'free', active: false, reason, label, mode: s.expired_mode };
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
function paidState(best, t) {
  return { plan: 'paid', active: true, expires_at: best.expires_at, days_left: best.expires_at == null ? null : Math.max(0, Math.ceil((best.expires_at - t) / DAY)),
    label: best.expires_at == null ? 'Pro · lifetime' : `Pro · until ${new Date(best.expires_at).toISOString().slice(0, 10)}` };
}
// accounts created during the free period get their trial once it ends (on their next visit)
function lateTrial(u, deviceId) {
  if (u.role === 'admin' || freePeriod()) return;
  if (db.prepare('SELECT 1 FROM licenses WHERE user_id=?').get(u.id)) return;
  if (db.prepare("SELECT 1 FROM audit WHERE target=? AND action='late_trial'").get(String(u.id))) return;
  const note = maybeStartTrial(u.id, deviceId || u.signup_device);
  audit(u.id, 'late_trial', u.id, note || 'trial started after the free period');
}

function maybeStartTrial(userId, deviceId) {
  const s = allSettings();
  if (s.trial_enabled !== '1') return 'Free trials are switched off right now.';
  const max = parseInt(s.trial_max_users, 10) || 0;
  if (max > 0) {
    const given = db.prepare("SELECT COUNT(DISTINCT user_id) n FROM licenses WHERE kind='trial'").get().n;
    if (given >= max) return 'All free trial places have been taken.';
  }
  if (s.trial_one_per_device === '1' && deviceId) {
    if (db.prepare('SELECT 1 FROM trial_devices WHERE device_id=?').get(deviceId)) return 'This computer has already used a free trial.';
    db.prepare('INSERT OR IGNORE INTO trial_devices(device_id,user_id,created_at) VALUES(?,?,?)').run(deviceId, userId, now());
  }
  const days = Math.max(1, parseInt(s.trial_days, 10) || 14);
  db.prepare("INSERT INTO licenses(user_id,kind,status,starts_at,expires_at,created_at) VALUES(?,'trial','active',?,?,?)").run(userId, now(), now() + days * DAY, now());
  return null;
}

/* ---------- sessions ---------- */
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function parseCookies(req) {
  const o = {};
  for (const p of String(req.headers.cookie || '').split(';')) { const i = p.indexOf('='); if (i > 0) { try { o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (e) {} } }
  return o;
}
function setSessionCookie(req, res, token, maxAgeSec) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === '1';
  res.setHeader('Set-Cookie', `pt_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`);
}
function newSession(req, res, user, deviceId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions(token_hash,user_id,device_id,user_agent,created_at,last_seen,expires_at) VALUES(?,?,?,?,?,?,?)')
    .run(sha(token), user.id, deviceId || null, String(req.headers['user-agent'] || '').slice(0, 200), now(), now(), now() + SESSION_DAYS * DAY);
  db.prepare('UPDATE users SET last_login=? WHERE id=?').run(now(), user.id);
  setSessionCookie(req, res, token, SESSION_DAYS * 86400);
  return sha(token);
}
function deviceLimitProblem(user, deviceId) {
  if (user.role === 'admin') return null;
  const max = parseInt(getSetting('max_devices'), 10) || 0;
  if (!max) return null;
  const devs = db.prepare('SELECT DISTINCT device_id d FROM sessions WHERE user_id=? AND expires_at>? AND device_id IS NOT NULL').all(user.id, now()).map(r => r.d);
  if (devs.includes(deviceId) || devs.length < max) return null;
  return `This account is already signed in on ${devs.length} device${devs.length === 1 ? '' : 's'}, the most your licence allows. Sign out on another device, or ask the administrator to reset your devices.`;
}

/* ---------- app ---------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(express.json({ limit: '200kb' }));
// One address for Google: visitors to www., the onrender.com address or http:// are sent (301) to PUBLIC_URL.
// API calls, the health check and the desktop app keep working on any address. CANONICAL_REDIRECT=0 turns this off.
const CANON = (() => { try { const u = new URL(process.env.PUBLIC_URL || ''); return /^https?:$/.test(u.protocol) ? u : null; } catch (e) { return null; } })();
app.use((req, res, next) => {
  // /app, /open and /share stay where they are: an installed app opening a PDF must not be moved to another address
  if (!CANON || process.env.CANONICAL_REDIRECT === '0' || (req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/') || /^\/(app|open|share)$/.test(req.path)) return next();
  const host = String(req.get('host') || '').toLowerCase(), proto = process.env.TRUST_PROXY === '1' ? String(req.headers['x-forwarded-proto'] || req.protocol) : req.protocol;
  if (/^(localhost|127\.|\[::1\])/.test(host)) return next();
  if (host !== CANON.host || (CANON.protocol === 'https:' && proto === 'http')) return res.redirect(301, CANON.origin + req.originalUrl);
  next();
});
// tidy addresses: /Compress-PDF/ → /compress-pdf (one address per page)
app.use((req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path === '/' || req.path.startsWith('/api/') || /\.[a-z0-9]{2,5}$/i.test(req.path)) return next();
  const clean = req.path.replace(/\/+$/, '').toLowerCase();
  if (clean !== req.path && clean && /^\/[a-z0-9/-]+$/.test(clean)) { const q = req.originalUrl.slice(req.path.length); return res.redirect(301, clean + q); }
  next();
});
const isHttps = req => req.secure || (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'https');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// who is calling
app.use('/api', (req, res, next) => {
  const tok = parseCookies(req).pt_session;
  if (tok) {
    const s = db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(sha(tok), now());
    if (s) {
      const u = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id);
      if (u && u.status === 'active') { req.user = u; req.session = s; // stay logged in while the app is used: each visit pushes the end back to 30 days from now
        if (now() - s.last_seen > 300e3) { db.prepare('UPDATE sessions SET last_seen=?, expires_at=? WHERE token_hash=?').run(now(), now() + SESSION_DAYS * DAY, s.token_hash); setSessionCookie(req, res, tok, SESSION_DAYS * 86400); } }
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // CSRF guard: changes must come from our own pages (a custom header other sites can't send,
  // and, when the browser says where the request comes from, it must be this site)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.headers['x-pt'] !== '1') return res.status(403).json({ error: 'Request blocked.' });
    const o = req.headers.origin;
    if (o) { let ok = false; try { ok = new URL(o).host === req.get('host'); } catch (e) {} if (!ok) return res.status(403).json({ error: 'Request blocked.' }); }
  }
  next();
});
const needUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Please log in.' });
const needAdmin = (req, res, next) => req.user && req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only.' });

// tiny in-memory rate limit for auth endpoints
const HITS = new Map();
function limited(key, max, windowMs) {
  const t = now(), a = (HITS.get(key) || []).filter(x => t - x < windowMs);
  a.push(t); HITS.set(key, a);
  return a.length > max;
}
setInterval(() => { const t = now(); for (const [k, a] of HITS) if (!a.some(x => t - x < 3600e3)) HITS.delete(k); }, 600e3).unref();

const publicUser = u => ({ id: u.id, email: OTP.isPhoneEmail(u.email) ? '' : u.email, phone: u.phone || null, name: u.name, role: u.role, created_at: u.created_at });
const publicSettings = () => { const s = allSettings(); return { app_name: s.app_name, buy_url: s.buy_url, price_text: s.show_price === '1' ? s.price_text : '', support_email: s.support_email, signup_open: s.signup_open === '1', trial_enabled: s.trial_enabled === '1', trial_days: +s.trial_days, offline_days: +s.offline_days, expired_mode: s.expired_mode, guest_mode: !!freePeriod(), free_until: freePeriod()?.until || null, guest_banner: s.guest_banner, otp_email: OTP.emailReady(), otp_sms: false, ads_client: adsActive() ? ADS_CLIENT : null, ads_slot: adsActive() ? ADS_SLOT || null : null }; };
const canRun = lic => lic.active || lic.mode !== 'block';
/* ---------- Google AdSense (only when ADSENSE_CLIENT is set and the admin switch is on) ---------- */
const ADS_CLIENT = (() => { const v = String(process.env.ADSENSE_CLIENT || '').trim().replace(/^pub-/, 'ca-pub-'); return /^ca-pub-\d{10,20}$/.test(v) ? v : ''; })();
const ADS_SLOT = (() => { const v = String(process.env.ADSENSE_SLOT || '').trim(); return /^\d{6,20}$/.test(v) ? v : ''; })();
if (process.env.ADSENSE_CLIENT && !ADS_CLIENT) console.warn('ADSENSE_CLIENT should look like ca-pub-1234567890123456. Ads are off.');
const adsActive = () => !!ADS_CLIENT && getSetting('ads_on') === '1';
const QUICK_DAYS = 7;
function mePayload(u, deviceId) {
  lateTrial(u, deviceId);
  const lic = licenseState(u);
  const offline = Math.max(0, parseInt(getSetting('offline_days'), 10) || 0);
  const exp = Math.min(now() + offline * DAY, lic.expires_at || Infinity);
  if (deviceId) touchDevice(deviceId, null, u.id);
  // quick start: lets this device open the app at once while the server is slow to answer (waking up);
  // the server is still asked, and the app closes again if it never answers (unless offline use is allowed)
  const qexp = Math.min(now() + QUICK_DAYS * DAY, lic.expires_at || Infinity);
  return { user: publicUser(u), license: lic, settings: publicSettings(), token: licenseToken({ uid: u.id, email: OTP.isPhoneEmail(u.email) ? '' : u.email, name: u.name, role: u.role, lic, dev: deviceId || null, iat: now(), exp }), quick: canRun(lic) ? licenseToken({ uid: u.id, email: OTP.isPhoneEmail(u.email) ? '' : u.email, name: u.name, role: u.role, lic, dev: deviceId || null, iat: now(), exp: qexp, qs: 1 }) : null, tokenKey: TOKEN_PUB, appKey: canRun(lic) ? APP_KEY_HEX() : null };
}

/* ---------- devices and usage (counts visitors with or without an account) ---------- */
const cleanDev = d => { d = String(d || '').slice(0, 64); return /^[\w-]{8,64}$/.test(d) ? d : null; };
const BOT = /bot|crawl|spider|slurp|lighthouse|preview|facebookexternalhit|bingpreview/i;
function touchDevice(deviceId, req, userId) {
  if (req && !userId && BOT.test(String(req.headers['user-agent'] || ''))) return { device_id: deviceId, first_seen: now(), last_seen: now(), visits: 0, blocked: 0, guest_ended: 0 };
  const t = now(), row = db.prepare('SELECT * FROM devices WHERE device_id=?').get(deviceId);
  const ua = req ? String(req.headers['user-agent'] || '').slice(0, 200) : null;
  if (!row) {
    db.prepare('INSERT INTO devices(device_id,first_seen,last_seen,visits,user_id,user_agent) VALUES(?,?,?,1,?,?)').run(deviceId, t, t, userId || null, ua);
    db.prepare("INSERT INTO events(device_id,user_id,kind,created_at) VALUES(?,?,'visit',?)").run(deviceId, userId || null, t);
    return db.prepare('SELECT * FROM devices WHERE device_id=?').get(deviceId);
  }
  const newVisit = t - row.last_seen > 30 * 60e3;
  db.prepare('UPDATE devices SET last_seen=?, visits=visits+?, user_id=COALESCE(?,user_id), user_agent=COALESCE(?,user_agent) WHERE device_id=?').run(t, newVisit ? 1 : 0, userId || null, ua, deviceId);
  if (newVisit) db.prepare("INSERT INTO events(device_id,user_id,kind,created_at) VALUES(?,?,'visit',?)").run(deviceId, userId || row.user_id || null, t);
  return { ...row, last_seen: t };
}
function guestState(dev) {
  const s = allSettings();
  if (s.guest_mode !== '1') return { ok: false, reason: 'guest_off' };
  const fp = freePeriod(); if (!fp) return { ok: false, reason: 'guest_off' };
  if (dev.blocked) return { ok: false, reason: 'blocked' };
  if (dev.guest_ended) return { ok: false, reason: 'guest_ended' };
  const days = parseInt(s.guest_days, 10) || 0;
  let left = fp.days_left;
  if (days) { const l = Math.ceil((dev.first_seen + days * DAY - now()) / DAY); if (l <= 0) return { ok: false, reason: 'guest_expired' }; left = left == null ? l : Math.min(left, l); }
  const full = s.guest_features !== 'reader';
  const perDevice = days && left !== fp.days_left;
  const label = perDevice ? `Free access · ${left} day${left === 1 ? '' : 's'} left` : fp.until ? `Free until ${niceDate(fp.until)}` : 'Free access';
  return { ok: true, lic: { plan: 'guest', active: full, mode: 'reader', reason: full ? null : 'guest_reader', days_left: left, until: fp.until || null, label } };
}

app.get('/api/config', (req, res) => res.json({ settings: publicSettings(), tokenKey: TOKEN_PUB, support: String(process.env.SUPPORT_CONTACT || '').slice(0, 200) })); // SUPPORT_CONTACT: an email or web address for the ribbon's Contact support button

app.post('/api/auth/signup', (req, res) => {
  const ip = req.ip;
  if (limited('su:' + ip, 10, 3600e3) || limited('su-day:' + ip, 30, DAY)) return res.status(429).json({ error: 'Too many sign-ups from this network. Try again later.' });
  // spam protection: a hidden field people never fill in, and a cap on sign-ups per hour for the whole site
  if (req.body.website) return res.status(400).json({ error: 'Sign-up failed. Please try again.' });
  if (limited('su-all', Math.max(10, parseInt(process.env.SIGNUP_MAX_PER_HOUR, 10) || 100), 3600e3)) { console.warn('sign-up limit per hour reached'); return res.status(429).json({ error: 'Too many new accounts right now. Please try again in an hour.' }); }
  if (getSetting('signup_open') !== '1') return res.status(403).json({ error: 'New sign-ups are closed. Please contact the administrator.' });
  const name = String(req.body.name || '').trim().slice(0, 100), email = cleanEmail(req.body.email), pw = req.body.password, device = String(req.body.device || '').slice(0, 64) || null;
  if (req.body.agree !== true) return res.status(400).json({ error: 'Please accept the Terms & Conditions and Privacy Policy.', field: 'agree' });
  if (!name) return res.status(400).json({ error: 'Enter your name.', field: 'name' });
  if (/https?:|www\.|[<>{}]|\.(com|net|org|ru|xyz|top|info|io|in)\b/i.test(name)) return res.status(400).json({ error: 'Enter your name only (no links).', field: 'name' });
  const rawId = String(req.body.email || '').trim();
  const phone = rawId && !rawId.includes('@') ? OTP.cleanPhone(rawId) : null;
  if (!phone && (!emailOk(email) || OTP.isPhoneEmail(email))) return res.status(400).json({ error: 'Enter a valid email address or a 10-digit mobile number.', field: 'email' });
  const p = pwProblem(pw); if (p) return res.status(400).json({ error: p, field: 'password' });
  if (phone) return signupByPhone(req, res, { name, phone, pw, device });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.', field: 'email' });
  const adminEmail = cleanEmail(process.env.ADMIN_EMAIL);
  // the owner's email (ADMIN_EMAIL) becomes admin only while the site has no admin yet
  const role = adminEmail && adminEmail === email && !db.prepare("SELECT 1 FROM users WHERE role='admin'").get() ? 'admin' : 'user';
  const r = db.prepare('INSERT INTO users(email,name,pass_hash,role,created_at,signup_device) VALUES(?,?,?,?,?,?)').run(email, name, hashPassword(pw), role, now(), device);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
  const fp = freePeriod();
  const trialNote = role === 'admin' || fp ? null : maybeStartTrial(u.id, device);
  audit(u.id, 'signup', u.id, trialNote || (role === 'admin' ? 'admin account' : fp ? 'free period (trial starts when it ends)' : 'trial started'));
  audit(u.id, 'accepted_terms', u.id, `Terms & Privacy of ${LEGAL.UPDATED} · ${req.ip}`);
  newSession(req, res, u, device);
  res.json({ ...mePayload(u, device), notice: trialNote });
});

// sign-up with a mobile number and a password (no text message is sent)
function signupByPhone(req, res, { name, phone, pw, device }) {
  if (db.prepare('SELECT 1 FROM users WHERE phone=?').get(phone)) return res.status(409).json({ error: 'An account with this mobile number already exists. Log in instead.', field: 'email' });
  const ins = db.prepare("INSERT INTO users(email,name,pass_hash,role,created_at,signup_device,phone) VALUES(?,?,?,'user',?,?,?)").run(OTP.phoneEmail(phone), name, hashPassword(pw), now(), device, phone);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(ins.lastInsertRowid);
  const fp = freePeriod();
  const notice = fp ? null : maybeStartTrial(u.id, device);
  audit(u.id, 'signup', u.id, 'with mobile number' + (notice ? ' · ' + notice : fp ? ' · free period' : ' · trial started'));
  audit(u.id, 'accepted_terms', u.id, `Terms & Privacy of ${LEGAL.UPDATED} · ${req.ip}`);
  newSession(req, res, u, device);
  res.json({ ...mePayload(u, device), notice });
}

app.post('/api/auth/login', (req, res) => {
  const email = cleanEmail(req.body.email), pw = String(req.body.password || ''), device = String(req.body.device || '').slice(0, 64) || null;
  if (limited('li:' + req.ip, 30, 900e3) || limited('le:' + email, 10, 900e3)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes and try again.' });
  // the email box also takes a verified mobile number
  const ph = email.includes('@') ? null : OTP.cleanPhone(email);
  const u = ph ? db.prepare('SELECT * FROM users WHERE phone=?').get(ph) : db.prepare('SELECT * FROM users WHERE email=?').get(email);
  // check a password even when there is no such account, so the answer time doesn't reveal which emails exist
  const pwOk = checkPassword(pw.slice(0, 200), u ? u.pass_hash : DUMMY_HASH) && !!u;
  if (!pwOk) {
    if (u && u.role === 'admin' && limited('adminfail:' + u.id, 4, 3600e3)) {
      if (!limited('adminfail-alert:' + u.id, 1, 3600e3)) SEC.alert('Wrong admin passwords', [`Someone typed a wrong password 5 times for the admin account ${u.email}.`, SEC.who(req)]);
    }
    return res.status(401).json({ error: u && u.pass_hash === '!' ? 'This account has no password yet. Tap “Forgot password?” to set one.' : 'That email or mobile number and password don’t match an account.' });
  }
  if (u.status !== 'active') return res.status(403).json({ error: 'This account has been disabled. Please contact the administrator.' });
  const dl = deviceLimitProblem(u, device); if (dl) return res.status(403).json({ error: dl });
  if (device && u.role !== 'admin' && db.prepare('SELECT blocked FROM devices WHERE device_id=?').get(device)?.blocked) return res.status(403).json({ error: 'This device has been blocked. Please contact the administrator.' });
  // 2-step login: ask for the code from the authenticator app before signing in
  if (u.totp_on) return res.json({ need2fa: true, ticket: SEC.newTicket(u.id, device) });
  finishLogin(req, res, u, device, 'password');
});
function finishLogin(req, res, u, device, how) {
  const th = newSession(req, res, u, device);
  audit(u.id, 'login', u.id, `${req.ip}${how !== 'password' ? ' · ' + how : ''}`);
  if (u.role === 'admin') SEC.alert('Admin login', [`${u.name} <${u.email}> logged in as administrator (${how === 'password' ? 'password only, 2-step login is off' : how}).`, SEC.who(req)]);
  res.json(mePayload(u, device));
  return th;
}
app.post('/api/auth/2fa', (req, res) => {
  if (limited('2fa:' + req.ip, 30, 900e3)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes and try again.' });
  const t = SEC.useTicket(req.body.ticket);
  if (!t) return res.status(401).json({ error: 'That took too long. Log in again.', restart: true });
  if (++t.tries > 5) { SEC.TICKETS.delete(req.body.ticket); return res.status(401).json({ error: 'Too many wrong codes. Log in again.', restart: true }); }
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(t.userId);
  if (!u || u.status !== 'active' || !u.totp_on) return res.status(401).json({ error: 'Log in again.', restart: true });
  const ok = SEC.verifySecondFactor(u, req.body.code);
  if (!ok) return res.status(401).json({ error: 'That code isn’t right. Use the 6-digit code shown in your authenticator app now.', field: 'code' });
  SEC.TICKETS.delete(req.body.ticket);
  if (ok.backup) SEC.alert('Backup code used', [`A backup code was used to log in to ${u.email}. ${ok.left} backup codes are left.`, SEC.who(req)]);
  finishLogin(req, res, u, t.deviceId, ok.backup ? `backup code (${ok.left} left)` : '2-step login');
});

/* ---------- log in or sign up with a one-time code (email or mobile number) ---------- */
const otpErr = { expired: 'That code has expired. Ask for a new one.', too_many: 'Too many wrong codes. Ask for a new code.' };
function otpProblem(r) { return r.error === 'wrong' ? `That code isn’t right.${r.left > 0 ? ` ${r.left} tr${r.left === 1 ? 'y' : 'ies'} left.` : ''}` : otpErr[r.error] || 'Please try again.'; }
function loginBlocked(u, device) {
  if (u.status !== 'active') return 'This account has been disabled. Please contact the administrator.';
  const dl = deviceLimitProblem(u, device); if (dl) return dl;
  if (device && u.role !== 'admin' && db.prepare('SELECT blocked FROM devices WHERE device_id=?').get(device)?.blocked) return 'This device has been blocked. Please contact the administrator.';
  return null;
}
const userByTarget = t => t.kind === 'email' ? db.prepare('SELECT * FROM users WHERE email=?').get(t.value) : db.prepare('SELECT * FROM users WHERE phone=?').get(t.value);
function targetProblem(t) {
  if (!t) return 'Enter a valid email address, or a 10-digit mobile number.';
  if (t.kind === 'email' && !OTP.emailReady()) return 'Codes by email aren’t available yet. Log in with your password.';
  return null;
}
function otpLimited(req, t) {
  return limited('os:' + req.ip, 10, 900e3) || limited('osd:' + req.ip, 40, DAY) || limited('ot:' + t.value, 5, 3600e3) || limited('otd:' + t.value, 15, DAY);
}
app.post('/api/auth/otp/send', async (req, res) => {
  const purpose = req.body.purpose === 'reset' ? 'reset' : 'login';
  // logging in with only a code (no password) is no longer offered: codes are for sign-up, 2-step login and forgotten passwords
  if (purpose === 'login') return res.status(403).json({ error: 'Log in with your email or mobile number and your password.' });
  if (req.body.website) return res.status(400).json({ error: 'Please try again.' });
  let t = OTP.target(req.body.to); const device = String(req.body.device || '').slice(0, 64) || null;
  if (!t) return res.status(400).json({ error: 'Enter your email address or 10-digit mobile number.', field: 'to' });
  if (!OTP.emailReady()) return res.status(400).json({ error: 'Password reset by email isn’t set up yet. Please contact support.', field: 'to' });
  if (otpLimited(req, t)) return res.status(429).json({ error: 'Too many codes asked for. Wait a while and try again.' });
  const u = userByTarget(t);
  // the code always goes by email: a mobile number is only used to find the account
  if (u && t.kind === 'sms') {
    if (OTP.isPhoneEmail(u.email)) return res.status(400).json({ error: 'This account has no email address, so we can’t send a code. Please contact support to reset your password.', field: 'to' });
    t = { kind: 'email', value: u.email };
  }
  // administrators always use their password (and 2-step login)
  if (u && u.role === 'admin' && !u.totp_on) return res.status(400).json({ error: purpose === 'reset' ? 'The administrator password is reset on the server (see the README).' : 'For this account, log in with your password.' });
  if (purpose === 'reset' && !u) return res.status(404).json({ error: 'No account uses this email or mobile number.', field: 'to' });
  if (!u && getSetting('signup_open') !== '1') return res.status(403).json({ error: 'No account uses this. New sign-ups are closed; please contact the administrator.' });
  if (u && u.status !== 'active') return res.status(403).json({ error: 'This account has been disabled. Please contact the administrator.' });
  try {
    const ticket = await OTP.issue(t, { purpose, userId: u ? u.id : null, deviceId: device }, getSetting('app_name'));
    res.json({ ticket, sentTo: OTP.mask(t), channel: t.kind, isNew: !u });
  } catch (e) { console.warn('code not sent:', e.message); res.status(502).json({ error: 'We couldn’t send the code just now. Try again in a minute.' }); }
});
app.post('/api/auth/otp/resend', async (req, res) => {
  if (limited('or:' + req.ip, 10, 900e3)) return res.status(429).json({ error: 'Too many codes asked for. Wait a while and try again.' });
  const v = OTP.peek(req.body.ticket);
  if (!v || !['login', 'login2', 'reset', 'signup'].includes(v.purpose)) return res.status(401).json({ error: 'That took too long. Start again.', restart: true });
  try {
    const r = await OTP.resend(req.body.ticket, getSetting('app_name'));
    if (r.error === 'wait') return res.status(429).json({ error: `Wait ${r.wait} seconds before asking for a new code.` });
    if (r.error) return res.status(401).json({ error: r.error === 'too_many' ? 'Too many new codes. Start again.' : 'That took too long. Start again.', restart: true });
    res.json({ ok: true });
  } catch (e) { console.warn('code not re-sent:', e.message); res.status(502).json({ error: 'We couldn’t send the code just now. Try again in a minute.' }); }
});
app.post('/api/auth/otp/verify', (req, res) => {
  if (limited('ov:' + req.ip, 30, 900e3)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes and try again.' });
  const v = OTP.peek(req.body.ticket);
  if (!v || !['login', 'login2', 'reset', 'signup'].includes(v.purpose)) return res.status(401).json({ error: 'That took too long. Start again.', restart: true });
  const device = v.deviceId || String(req.body.device || '').slice(0, 64) || null;
  // a new account needs a name and the terms accepted (checked before the code is used up)
  const isNew = v.purpose === 'login' && !v.userId;
  let name = '';
  if (isNew) {
    name = String(req.body.name || '').trim().slice(0, 100);
    if (!name) return res.status(400).json({ error: 'Enter your name.', field: 'name' });
    if (/https?:|www\.|[<>{}]|\.(com|net|org|ru|xyz|top|info|io|in)\b/i.test(name)) return res.status(400).json({ error: 'Enter your name only (no links).', field: 'name' });
    if (req.body.agree !== true) return res.status(400).json({ error: 'Please accept the Terms & Conditions and Privacy Policy.', field: 'agree' });
  }
  // forgotten password: the new password is checked before the code is used up
  const newPw = v.purpose === 'reset' ? String(req.body.password || '') : '';
  if (v.purpose === 'reset') { const p = pwProblem(newPw); if (p) return res.status(400).json({ error: p, field: 'password' }); }
  const r = OTP.check(req.body.ticket, req.body.code, v.purpose);
  if (!r.ok) return res.status(r.error === 'wrong' ? 400 : 401).json({ error: otpProblem(r), field: 'code', restart: r.error !== 'wrong' });
  OTP.done(req.body.ticket);
  const t = v.target;
  if (v.purpose === 'signup') return finishPhoneSignup(req, res, v, device);
  if (v.purpose === 'reset') {
    const ru = db.prepare('SELECT * FROM users WHERE id=?').get(v.userId);
    if (!ru) return res.status(401).json({ error: 'Start again.', restart: true });
    db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPassword(newPw), ru.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(ru.id);
    audit(ru.id, 'password_reset', ru.id, 'with code by ' + (t.kind === 'sms' ? 'text message' : 'email') + ' · ' + req.ip);
    const bad = loginBlocked(ru, device); if (bad) return res.status(403).json({ error: bad });
    if (ru.totp_on) return res.json({ need2fa: true, ticket: SEC.newTicket(ru.id, device) });
    return finishLogin(req, res, ru, device, 'new password set with a code');
  }
  let u = v.userId ? db.prepare('SELECT * FROM users WHERE id=?').get(v.userId) : userByTarget(t);
  if (v.purpose === 'login2') {
    if (!u) return res.status(401).json({ error: 'Log in again.', restart: true });
    const bad = loginBlocked(u, device); if (bad) return res.status(403).json({ error: bad });
    return finishLogin(req, res, u, device, 'password + code by ' + (t.kind === 'sms' ? 'text message' : 'email'));
  }
  let notice = null, created = false;
  if (!u) {
    if (getSetting('signup_open') !== '1') return res.status(403).json({ error: 'New sign-ups are closed. Please contact the administrator.' });
    if (limited('su:' + req.ip, 10, 3600e3) || limited('su-day:' + req.ip, 30, DAY)) return res.status(429).json({ error: 'Too many sign-ups from this network. Try again later.' });
    if (limited('su-all', Math.max(10, parseInt(process.env.SIGNUP_MAX_PER_HOUR, 10) || 100), 3600e3)) return res.status(429).json({ error: 'Too many new accounts right now. Please try again in an hour.' });
    const email = t.kind === 'email' ? t.value : OTP.phoneEmail(t.value);
    // no password yet ('!' never matches one); the user can add one later under Your account
    const ins = db.prepare("INSERT INTO users(email,name,pass_hash,role,created_at,signup_device,phone) VALUES(?,?,'!','user',?,?,?)").run(email, name, now(), device, t.kind === 'sms' ? t.value : null);
    u = db.prepare('SELECT * FROM users WHERE id=?').get(ins.lastInsertRowid);
    const fp = freePeriod();
    notice = fp ? null : maybeStartTrial(u.id, device);
    audit(u.id, 'signup', u.id, (t.kind === 'sms' ? 'with mobile code' : 'with email code') + (notice ? ' · ' + notice : fp ? ' · free period' : ' · trial started'));
    audit(u.id, 'accepted_terms', u.id, `Terms & Privacy of ${LEGAL.UPDATED} · ${req.ip}`);
    created = true;
  }
  const bad = loginBlocked(u, device); if (bad) return res.status(403).json({ error: bad });
  if (u.role === 'admin' && !u.totp_on) return res.status(400).json({ error: 'For this account, log in with your password.' });
  if (u.totp_on) return res.json({ need2fa: true, ticket: SEC.newTicket(u.id, device) });
  if (created) { CODE_LOGIN.set(newSession(req, res, u, device), now()); return res.json({ ...mePayload(u, device), notice, created: true }); }
  CODE_LOGIN.set(finishLogin(req, res, u, device, 'code by ' + (t.kind === 'sms' ? 'text message' : 'email')), now());
});

function finishPhoneSignup(req, res, v, device) {
  if (getSetting('signup_open') !== '1') return res.status(403).json({ error: 'New sign-ups are closed. Please contact the administrator.' });
  const phone = v.target.value;
  if (db.prepare('SELECT 1 FROM users WHERE phone=?').get(phone)) return res.status(409).json({ error: 'An account with this mobile number already exists. Log in instead.', restart: true });
  const ins = db.prepare("INSERT INTO users(email,name,pass_hash,role,created_at,signup_device,phone) VALUES(?,?,?,'user',?,?,?)").run(OTP.phoneEmail(phone), v.name, v.passHash, now(), device, phone);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(ins.lastInsertRowid);
  const fp = freePeriod();
  const notice = fp ? null : maybeStartTrial(u.id, device);
  audit(u.id, 'signup', u.id, 'with mobile number' + (notice ? ' · ' + notice : fp ? ' · free period' : ' · trial started'));
  audit(u.id, 'accepted_terms', u.id, `Terms & Privacy of ${LEGAL.UPDATED} · ${req.ip}`);
  newSession(req, res, u, device);
  res.json({ ...mePayload(u, device), notice, created: true });
}

/* ---------- your account: mobile number, email, login codes ---------- */
// sessions that just logged in with a code may set a new password without the old one (forgotten password)
const CODE_LOGIN = new Map(), CODE_RESET_MS = 15 * 60e3;
const codeLoginRecent = req => !!req.session && (CODE_LOGIN.get(req.session.token_hash) || 0) > now() - CODE_RESET_MS;
setInterval(() => { for (const [k, t] of CODE_LOGIN) if (t < now() - CODE_RESET_MS) CODE_LOGIN.delete(k); }, 300e3).unref();
const accountSecurity = (u, req) => ({ reset_ok: !!req && codeLoginRecent(req), phone: u.phone || null, email: OTP.isPhoneEmail(u.email) ? '' : u.email, has_password: u.pass_hash !== '!', totp_on: !!u.totp_on, backup_left: JSON.parse(u.backup_codes || '[]').length, can_email: OTP.emailReady() });
const meFull = req => db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
app.get('/api/account/security', needUser, (req, res) => res.json(accountSecurity(meFull(req), req)));
// add or change the mobile number, or add an email (an existing email is changed only by the admin)
app.post('/api/account/contact', needUser, (req, res) => {
  if (limited('oc:' + req.user.id, 10, 3600e3)) return res.status(429).json({ error: 'Too many changes. Try again later.' });
  const u = meFull(req), t = OTP.target(req.body.to);
  if (!t) return res.status(400).json({ error: 'Enter a 10-digit mobile number or an email address.', field: 'to' });
  if (u.pass_hash === '!') return res.status(400).json({ error: 'Set a password first (below).' });
  if (!checkPassword(String(req.body.password || '').slice(0, 200), u.pass_hash)) return res.status(400).json({ error: 'Type your account password to save this.', field: 'password' });
  if (t.kind === 'email' && !OTP.isPhoneEmail(u.email)) return res.status(400).json({ error: 'Your account already has an email. To change it, contact the administrator.', field: 'to' });
  const other = userByTarget(t);
  if (other && other.id !== u.id) return res.status(409).json({ error: `Another account already uses this ${t.kind === 'sms' ? 'mobile number' : 'email'}.`, field: 'to' });
  if (other) return res.status(400).json({ error: 'That’s already on your account.', field: 'to' });
  try {
    if (t.kind === 'sms') db.prepare('UPDATE users SET phone=? WHERE id=?').run(t.value, u.id);
    else db.prepare('UPDATE users SET email=? WHERE id=?').run(t.value, u.id);
  } catch (e) { return res.status(409).json({ error: 'Another account already uses this.' }); }
  audit(u.id, t.kind === 'sms' ? 'mobile_changed' : 'email_added', u.id, OTP.mask(t));
  const n = meFull(req);
  res.json({ ...mePayload(n, req.session.device_id), security: accountSecurity(n, req) });
});

/* ---------- 2-step login with an authenticator app (Google or Microsoft Authenticator) ---------- */
// shared by Your account (everyone) and the admin console
async function tfaSetup(req, res) {
  const u = meFull(req);
  if (u.totp_on) return res.status(400).json({ error: '2-step login is already on.' });
  if (u.pass_hash === '!') return res.status(400).json({ error: 'Set a password first.' });
  const secret = SEC.newSecret();
  db.prepare('UPDATE users SET totp_secret=?, totp_last=0 WHERE id=?').run(SEC.seal(secret), u.id);
  const who = OTP.isPhoneEmail(u.email) ? (u.phone || u.name) : u.email;
  const label = encodeURIComponent(`${getSetting('app_name')}:${who}`), issuer = encodeURIComponent(getSetting('app_name'));
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const svg = await require('qrcode').toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  res.json({ secret: secret.match(/.{1,4}/g).join(' '), qr: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), uri });
}
function tfaEnable(req, res) {
  if (limited('2faon:' + req.user.id, 20, 3600e3)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const u = meFull(req), secret = SEC.userSecret(u);
  if (u.totp_on) return res.status(400).json({ error: '2-step login is already on.' });
  if (!secret) return res.status(400).json({ error: 'Start the set-up again.' });
  const st = SEC.checkTotp(secret, req.body.code, 0);
  if (!st) return res.status(400).json({ error: 'That code isn’t right. Check that your phone’s time is set automatically, and type the code shown now.', field: 'code' });
  const b = SEC.newBackupCodes();
  db.prepare('UPDATE users SET totp_on=1, totp_last=?, backup_codes=? WHERE id=?').run(st, JSON.stringify(b.hashes), u.id);
  // sign out this account's other devices, so only logins with a code remain
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(u.id, req.session.token_hash);
  audit(u.id, (u.role === 'admin' ? 'admin:' : '') + '2fa_on', u.id, null);
  if (u.role === 'admin') SEC.alert('2-step login turned on', [`2-step login was turned on for ${u.email}.`, SEC.who(req)]);
  res.json({ ok: true, codes: b.codes, security: accountSecurity(meFull(req), req) });
}
function tfaDisable(req, res) {
  if (limited('2faoff:' + req.user.id, 10, 3600e3)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const u = meFull(req);
  if (!checkPassword(String(req.body.password || ''), u.pass_hash)) return res.status(400).json({ error: 'Your password isn’t right.', field: 'password' });
  if (u.totp_on && !SEC.verifySecondFactor(u, req.body.code)) return res.status(400).json({ error: 'That code isn’t right.', field: 'code' });
  db.prepare('UPDATE users SET totp_on=0, totp_secret=NULL, backup_codes=NULL WHERE id=?').run(u.id);
  audit(u.id, (u.role === 'admin' ? 'admin:' : '') + '2fa_off', u.id, null);
  if (u.role === 'admin') SEC.alert('2-step login turned OFF', [`2-step login was turned off for ${u.email}.`, SEC.who(req)]);
  res.json({ ok: true, security: accountSecurity(meFull(req), req) });
}
function tfaBackup(req, res) {
  if (limited('2fabk:' + req.user.id, 10, 3600e3)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const u = meFull(req);
  if (!u.totp_on) return res.status(400).json({ error: 'Turn on 2-step login first.' });
  if (!SEC.verifySecondFactor(u, req.body.code)) return res.status(400).json({ error: 'That code isn’t right.', field: 'code' });
  const b = SEC.newBackupCodes();
  db.prepare('UPDATE users SET backup_codes=? WHERE id=?').run(JSON.stringify(b.hashes), u.id);
  audit(u.id, (u.role === 'admin' ? 'admin:' : '') + '2fa_new_backup_codes', u.id, null);
  res.json({ ok: true, codes: b.codes, security: accountSecurity(meFull(req), req) });
}
app.post('/api/account/2fa/setup', needUser, tfaSetup);
app.post('/api/account/2fa/enable', needUser, tfaEnable);
app.post('/api/account/2fa/disable', needUser, tfaDisable);
app.post('/api/account/2fa/backup-codes', needUser, tfaBackup);

app.post('/api/auth/logout', (req, res) => {
  if (req.session) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.session.token_hash);
  setSessionCookie(req, res, '', 0);
  res.json({ ok: true });
});

app.get('/api/me', needUser, (req, res) => res.json(mePayload(req.user, req.session.device_id)));

// first call of the app: logged-in users get their account; others get guest access while free mode is on
app.post('/api/hello', (req, res) => {
  const dev = cleanDev(req.body.device);
  if (!dev) return res.status(400).json({ error: 'Bad device.' });
  if (limited('hello:' + req.ip, 120, 3600e3)) return res.status(429).json({ error: 'Too many requests.' });
  if (req.user) { touchDevice(dev, req, req.user.id); return res.json(mePayload(req.user, dev)); }
  const d = touchDevice(dev, req, null);
  const g = guestState(d);
  if (!g.ok) return res.status(401).json({ error: 'Please log in.', guest: false, reason: g.reason, settings: publicSettings() });
  const offline = Math.max(0, parseInt(getSetting('offline_days'), 10) || 0);
  res.json({ guest: true, user: { id: null, name: 'Guest', email: '', role: 'guest', guest: true }, license: g.lic, settings: publicSettings(), appKey: APP_KEY_HEX(),
    token: licenseToken({ uid: null, email: '', name: 'Guest', role: 'guest', lic: g.lic, dev, iat: now(), exp: now() + offline * DAY }),
    quick: licenseToken({ uid: null, email: '', name: 'Guest', role: 'guest', lic: g.lic, dev, iat: now(), exp: now() + QUICK_DAYS * DAY, qs: 1 }), tokenKey: TOKEN_PUB });
});
app.post('/api/track', (req, res) => {
  const dev = cleanDev(req.body.device), kind = String(req.body.kind || '');
  if (!dev || !['open', 'tool', 'sign'].includes(kind)) return res.status(400).json({ error: 'Bad event.' });
  if (limited('tr:' + dev, 400, 3600e3)) return res.json({ ok: true });
  const row = db.prepare('SELECT user_id FROM devices WHERE device_id=?').get(dev);
  if (!row) return res.json({ ok: true });
  db.prepare('INSERT INTO events(device_id,user_id,kind,tool,created_at) VALUES(?,?,?,?,?)').run(dev, req.user ? req.user.id : row.user_id, kind, String(req.body.tool || '').slice(0, 40) || null, now());
  if (kind === 'open') db.prepare('UPDATE devices SET opens=opens+1 WHERE device_id=?').run(dev);
  res.json({ ok: true });
});

app.post('/api/account/password', needUser, (req, res) => {
  if (limited('pw:' + req.user.id, 10, 3600e3)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  if (req.user.pass_hash !== '!' && !codeLoginRecent(req) && !checkPassword(String(req.body.old || ''), req.user.pass_hash)) return res.status(400).json({ error: 'Your current password is wrong.', field: 'old' });
  const p = pwProblem(req.body.password); if (p) return res.status(400).json({ error: p, field: 'password' });
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPassword(req.body.password), req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(req.user.id, req.session.token_hash);
  CODE_LOGIN.delete(req.session.token_hash);
  audit(req.user.id, 'password_changed', req.user.id);
  res.json({ ok: true });
});

app.post('/api/license/activate', needUser, (req, res) => {
  if (limited('key:' + req.user.id, 10, 3600e3)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const key = String(req.body.key || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');
  const k = db.prepare('SELECT * FROM license_keys WHERE key=?').get(key);
  if (!k || k.revoked) return res.status(400).json({ error: 'That licence key isn’t valid.' });
  if (k.uses >= k.max_uses) return res.status(400).json({ error: 'That licence key has already been used.' });
  if (db.prepare('SELECT 1 FROM licenses WHERE user_id=? AND key_id=?').get(req.user.id, k.id)) return res.status(400).json({ error: 'You have already activated this key.' });
  // add on top of any time left on an existing paid licence
  const cur = db.prepare("SELECT * FROM licenses WHERE user_id=? AND kind='paid' AND status='active' AND (expires_at IS NULL OR expires_at>?) ORDER BY id DESC").get(req.user.id, now());
  if (cur && cur.expires_at == null) return res.status(400).json({ error: 'You already have a lifetime licence.' });
  const start = cur ? cur.expires_at : now();
  const exp = k.days === 0 ? null : start + k.days * DAY;
  db.prepare("INSERT INTO licenses(user_id,kind,status,starts_at,expires_at,key_id,created_at) VALUES(?,'paid','active',?,?,?,?)").run(req.user.id, now(), exp, k.id, now());
  if (cur) db.prepare("UPDATE licenses SET status='cancelled', ended_at=?, note='replaced by key' WHERE id=?").run(now(), cur.id);
  db.prepare('UPDATE license_keys SET uses=uses+1 WHERE id=?').run(k.id);
  audit(req.user.id, 'key_activated', req.user.id, key);
  res.json(mePayload(req.user, req.session.device_id));
});

/* ---------- e-Sign: the server signs the document fingerprint with the user's certificate ---------- */
app.get('/api/esign/ca', (req, res) => res.type('application/x-pem-file').send(CA.pem));
app.post('/api/esign/sign', needUser, (req, res) => {
  const lic = licenseState(req.user);
  if (!lic.active) return res.status(402).json({ error: 'e-Sign needs an active trial or licence.' });
  if (limited('sign:' + req.user.id, 60, 3600e3)) return res.status(429).json({ error: 'Too many signatures in a short time. Try again later.' });
  if (req.user.pass_hash === '!') return res.status(401).json({ error: 'e-Sign asks for your password. You logged in with a code, so set a password first: Your account → Password.', field: 'password' });
  if (!checkPassword(String(req.body.password || '').slice(0, 200), req.user.pass_hash)) return res.status(401).json({ error: 'Password is wrong. Type your account password to confirm it’s you.', field: 'password' });
  const digest = String(req.body.digest || '');
  if (!/^[0-9a-f]{64}$/.test(digest)) return res.status(400).json({ error: 'Bad document fingerprint.' });
  const { cert, key } = userSigner(req.user);
  const cms = Cms.buildSignedData({ digest: Buffer.from(digest, 'hex').toString('binary'), certs: [cert, CA.cert], key });
  const fileName = String(req.body.file_name || '').slice(0, 200);
  db.prepare("INSERT INTO sign_log(user_id,kind,file_name,digest,signer,ip,created_at) VALUES(?,'esign',?,?,?,?,?)").run(req.user.id, fileName, digest, req.user.name, req.ip, now());
  res.json({ cms: Buffer.from(cms, 'binary').toString('base64'), signer: req.user.name, email: OTP.isPhoneEmail(req.user.email) ? '' : req.user.email });
});
// e-Sign without an account (like free PDF signing apps): the signer types their name, which is not verified.
// Only for visitors whose free access is on; limited per computer, per network and site-wide.
const cleanSignerName = v => { const n = String(v || '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim(); return n.length >= 2 && n.length <= 80 && /\p{L}/u.test(n) && !/https?:|www\.|@|\.(com|net|org|in|xyz|ru)\b/i.test(n) ? n : null; };
app.post('/api/esign/guest-sign', (req, res) => {
  if (req.user) return res.status(400).json({ error: 'You are logged in. Use e-Sign with your account.' });
  const dev = cleanDev(req.body.device);
  if (!dev) return res.status(400).json({ error: 'Bad device.' });
  const row = db.prepare('SELECT * FROM devices WHERE device_id=?').get(dev);
  if (!row) return res.status(401).json({ error: 'Please reload the page and try again.' });
  const g = guestState(row);
  if (!g.ok) return res.status(401).json({ error: g.reason === 'blocked' ? 'This computer has been blocked.' : 'Free signing has ended. Sign in to e-Sign.', reason: g.reason });
  if (!g.lic.active) return res.status(402).json({ error: 'e-Sign needs a free account right now. Please sign in.' });
  if (limited('gsign:' + dev, 20, 3600e3) || limited('gsign-ip:' + req.ip, 30, 3600e3) || limited('gsign-ipd:' + req.ip, 100, DAY) || limited('gsign-all', 600, 3600e3))
    return res.status(429).json({ error: 'Too many signatures in a short time. Try again later, or sign in.' });
  const name = cleanSignerName(req.body.name);
  if (!name) return res.status(400).json({ error: 'Type your full name as it should appear on the signature.', field: 'name' });
  if (req.body.agree !== true) return res.status(400).json({ error: 'Please confirm that you are the person named and agree to sign electronically.', field: 'agree' });
  const digest = String(req.body.digest || '');
  if (!/^[0-9a-f]{64}$/.test(digest)) return res.status(400).json({ error: 'Bad document fingerprint.' });
  const { cert, key } = guestSigner(name);
  const cms = Cms.buildSignedData({ digest: Buffer.from(digest, 'hex').toString('binary'), certs: [cert, CA.cert], key });
  const fileName = String(req.body.file_name || '').slice(0, 200);
  db.prepare("INSERT INTO sign_log(user_id,kind,file_name,digest,signer,ip,created_at) VALUES(NULL,'esign-guest',?,?,?,?,?)").run(fileName, digest, name + ' (no account · ' + dev.slice(0, 12) + ')', req.ip, now());
  res.json({ cms: Buffer.from(cms, 'binary').toString('base64'), signer: name });
});
// DSC signing happens on the user's computer; the app just records that it happened (no file, no key)
app.post('/api/esign/log', needUser, (req, res) => {
  const digest = String(req.body.digest || '');
  if (!/^[0-9a-f]{64}$/.test(digest)) return res.status(400).json({ error: 'Bad fingerprint.' });
  db.prepare("INSERT INTO sign_log(user_id,kind,file_name,digest,signer,ip,created_at) VALUES(?,'dsc',?,?,?,?,?)").run(req.user.id, String(req.body.file_name || '').slice(0, 200), digest, String(req.body.signer || '').slice(0, 200), req.ip, now());
  res.json({ ok: true });
});

/* ---------- admin ---------- */
const admin = express.Router();
admin.use(needAdmin);

admin.get('/stats', (req, res) => {
  const t = now();
  const n = q => db.prepare(q).get(t).n;
  res.json({
    users: db.prepare('SELECT COUNT(*) n FROM users').get().n,
    trials_active: n("SELECT COUNT(DISTINCT user_id) n FROM licenses WHERE kind='trial' AND status='active' AND expires_at>?"),
    paid_active: n("SELECT COUNT(DISTINCT user_id) n FROM licenses WHERE kind='paid' AND status='active' AND (expires_at IS NULL OR expires_at>?)"),
    trials_given: db.prepare("SELECT COUNT(DISTINCT user_id) n FROM licenses WHERE kind='trial'").get().n,
    signups_7d: db.prepare('SELECT COUNT(*) n FROM users WHERE created_at>?').get(t - 7 * DAY).n,
    signatures_30d: db.prepare('SELECT COUNT(*) n FROM sign_log WHERE created_at>?').get(t - 30 * DAY).n,
    keys_unused: db.prepare('SELECT COUNT(*) n FROM license_keys WHERE revoked=0 AND uses<max_uses').get().n
  });
});

admin.get('/users', (req, res) => {
  const q = '%' + String(req.query.q || '').trim() + '%';
  const rows = db.prepare('SELECT * FROM users WHERE email LIKE ? OR name LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT 500').all(q, q, q.replace(/[\s-]/g, ''));
  res.json(rows.map(u => ({
    ...publicUser(u), status: u.status, last_login: u.last_login,
    license: licenseState(u),
    devices: db.prepare('SELECT COUNT(DISTINCT device_id) n FROM sessions WHERE user_id=? AND expires_at>?').get(u.id, now()).n
  })));
});

admin.get('/users/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(+req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({
    user: { ...publicUser(u), status: u.status, last_login: u.last_login, totp_on: !!u.totp_on }, license: licenseState(u),
    licenses: db.prepare('SELECT l.*, k.key FROM licenses l LEFT JOIN license_keys k ON k.id=l.key_id WHERE user_id=? ORDER BY l.id DESC').all(u.id),
    sessions: db.prepare('SELECT device_id,user_agent,created_at,last_seen FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen DESC').all(u.id, now()),
    signatures: db.prepare('SELECT * FROM sign_log WHERE user_id=? ORDER BY id DESC LIMIT 50').all(u.id)
  });
});

admin.post('/users/:id/action', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(+req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const a = req.body.action, days = Math.max(0, Math.min(36500, parseInt(req.body.days, 10) || 0)), t = now();
  const self = u.id === req.user.id;
  const endActive = (kind, status, note) => db.prepare(`UPDATE licenses SET status=?, ended_at=?, note=? WHERE user_id=? AND status='active' ${kind ? 'AND kind=?' : ''}`).run(...[status, t, note || null, u.id].concat(kind ? [kind] : []));
  switch (a) {
    case 'start_trial': case 'extend_trial': {
      if (!days) return res.status(400).json({ error: 'Enter a number of days.' });
      const cur = db.prepare("SELECT * FROM licenses WHERE user_id=? AND kind='trial' AND status='active' AND expires_at>? ORDER BY id DESC").get(u.id, t);
      if (cur) db.prepare('UPDATE licenses SET expires_at=? WHERE id=?').run(cur.expires_at + days * DAY, cur.id);
      else db.prepare("INSERT INTO licenses(user_id,kind,status,starts_at,expires_at,note,created_at) VALUES(?,'trial','active',?,?,'given by admin',?)").run(u.id, t, t + days * DAY, t);
      break;
    }
    case 'cancel_trial': endActive('trial', 'cancelled', 'cancelled by admin'); break;
    case 'grant': {
      endActive('paid', 'cancelled', 'replaced by admin');
      db.prepare("INSERT INTO licenses(user_id,kind,status,starts_at,expires_at,note,created_at) VALUES(?,'paid','active',?,?,?,?)").run(u.id, t, days ? t + days * DAY : null, String(req.body.note || 'given by admin').slice(0, 200), t);
      break;
    }
    case 'revoke': endActive(null, 'revoked', 'revoked by admin'); break;
    case 'disable': if (self) return res.status(400).json({ error: 'You can’t disable your own account.' }); db.prepare("UPDATE users SET status='disabled' WHERE id=?").run(u.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id); break;
    case 'enable': db.prepare("UPDATE users SET status='active' WHERE id=?").run(u.id); break;
    case 'reset_devices': db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id); break;
    case 'reset_password': {
      const p = pwProblem(req.body.password); if (p) return res.status(400).json({ error: p });
      db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPassword(req.body.password), u.id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
      break;
    }
    case 'make_admin': db.prepare("UPDATE users SET role='admin' WHERE id=?").run(u.id); SEC.alert('New administrator', [`${req.user.email} made ${u.email} an administrator.`, SEC.who(req)]); break;
    case 'reset_2fa': db.prepare('UPDATE users SET totp_on=0, totp_secret=NULL, backup_codes=NULL WHERE id=?').run(u.id); SEC.alert('2-step login reset', [`${req.user.email} switched off 2-step login for ${u.email}.`, SEC.who(req)]); break;
    case 'remove_admin': if (self) return res.status(400).json({ error: 'You can’t remove your own admin rights.' }); db.prepare("UPDATE users SET role='user' WHERE id=?").run(u.id); break;
    case 'delete': if (self) return res.status(400).json({ error: 'You can’t delete your own account.' }); db.prepare('DELETE FROM users WHERE id=?').run(u.id); break;
    default: return res.status(400).json({ error: 'Unknown action.' });
  }
  audit(req.user.id, 'admin:' + a, u.email, days ? days + ' days' : null);
  res.json({ ok: true });
});

admin.post('/trials/cancel-all', (req, res) => {
  const r = db.prepare("UPDATE licenses SET status='cancelled', ended_at=?, note='all trials cancelled by admin' WHERE kind='trial' AND status='active'").run(now());
  if (req.body.stopNew) setSetting('trial_enabled', '0');
  audit(req.user.id, 'admin:cancel_all_trials', null, `${r.changes} trials${req.body.stopNew ? ', new trials switched off' : ''}`);
  res.json({ ok: true, cancelled: r.changes });
});

const adminSettings = () => { const fp = freePeriod(); return { ...allSettings(), free_active: !!fp, free_days_left: fp ? fp.days_left : null, ads_client: ADS_CLIENT || null, ads_slot: ADS_SLOT || null, otp: OTP.status() }; };
admin.get('/settings', (req, res) => res.json(adminSettings()));

/* ---------- admin security: 2-step login and alerts ---------- */
const meRow = req => db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
admin.get('/security', (req, res) => {
  const u = meRow(req);
  res.json({
    totp_on: !!u.totp_on, backup_left: JSON.parse(u.backup_codes || '[]').length,
    mail_ready: SEC.mailReady(), alert_to: SEC.alertTo(), alert_admin: getSetting('alert_admin') === '1', alert_email: getSetting('alert_email'),
    admins: db.prepare("SELECT id, name, email, totp_on, last_login FROM users WHERE role='admin' ORDER BY id").all(),
    logins: db.prepare("SELECT a.created_at, a.detail, u.email FROM audit a JOIN users u ON u.id=a.actor_id WHERE a.action='login' AND u.role='admin' ORDER BY a.id DESC LIMIT 15").all()
  });
});
admin.post('/2fa/setup', tfaSetup);
admin.post('/2fa/enable', tfaEnable);
admin.post('/2fa/disable', tfaDisable);
admin.post('/2fa/backup-codes', tfaBackup);
admin.post('/alerts/test', async (req, res) => {
  try { await SEC.sendTest(SEC.alertTo()); res.json({ ok: true, to: SEC.alertTo() }); }
  catch (e) { console.warn('test email failed:', e.message); res.status(400).json({ error: SEC.mailReady() ? 'Couldn’t send the email. Check the SMTP settings; the exact reason is in the server logs.' : e.message }); }
});
admin.put('/settings', (req, res) => {
  const b = req.body || {}, bad = [];
  const ints = { guest_days: [0, 3650], trial_days: [1, 3650], trial_max_users: [0, 1e7], max_devices: [0, 100], offline_days: [0, 60], legal_refund_days: [0, 90] };
  for (const k of Object.keys(DEFAULTS)) {
    if (!(k in b)) continue;
    let v = b[k];
    if (k in ints) { v = parseInt(v, 10); if (!Number.isFinite(v) || v < ints[k][0] || v > ints[k][1]) { bad.push(k); continue; } }
    else if (['signup_open', 'trial_enabled', 'trial_one_per_device', 'guest_mode', 'alert_admin', 'ads_on', 'otp_login_on', 'otp_required', 'show_price'].includes(k)) v = v === true || v === '1' || v === 1 ? '1' : '0';
    else if (k === 'guest_features') v = v === 'reader' ? 'reader' : 'full';
    else if (k === 'free_until') { v = String(v || '').trim(); if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { bad.push(k); continue; } }
    else if (k === 'expired_mode') v = v === 'block' ? 'block' : 'reader';
    else if (k === 'alert_email' || k === 'legal_email') { v = cleanEmail(v); if (v && !emailOk(v)) { bad.push(k); continue; } }
    else if (k === 'legal_address') v = String(v).replace(/\r/g, '').slice(0, 400);
    else if (k === 'buy_url') { v = String(v).trim(); if (v && !/^https:\/\/\S+$/i.test(v)) { bad.push(k); continue; } }
    else v = String(v).slice(0, 200);
    setSetting(k, v);
  }
  if (bad.length) return res.status(400).json({ error: 'Some values are out of range: ' + bad.join(', '), fields: bad });
  audit(req.user.id, 'admin:settings', null, JSON.stringify(b).slice(0, 500));
  res.json(adminSettings());
});

const keyStr = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = crypto.randomBytes(16); let s = ''; for (let i = 0; i < 16; i++) s += A[b[i] % A.length]; return s.match(/.{4}/g).join('-'); };
admin.get('/keys', (req, res) => res.json(db.prepare('SELECT k.*, (SELECT GROUP_CONCAT(u.email, \', \') FROM licenses l JOIN users u ON u.id=l.user_id WHERE l.key_id=k.id) used_by FROM license_keys k ORDER BY id DESC LIMIT 1000').all()));
admin.post('/keys', (req, res) => {
  const count = Math.max(1, Math.min(500, parseInt(req.body.count, 10) || 1));
  const days = Math.max(0, Math.min(36500, parseInt(req.body.days, 10) || 0));
  const maxUses = Math.max(1, Math.min(100000, parseInt(req.body.max_uses, 10) || 1));
  const note = String(req.body.note || '').slice(0, 200);
  const out = [];
  for (let i = 0; i < count; i++) { const k = keyStr(); db.prepare('INSERT INTO license_keys(key,days,max_uses,note,created_at) VALUES(?,?,?,?,?)').run(k, days, maxUses, note, now()); out.push(k); }
  audit(req.user.id, 'admin:keys_created', null, `${count} × ${days || 'lifetime'} days`);
  res.json({ keys: out });
});
admin.post('/keys/:id/revoke', (req, res) => {
  db.prepare('UPDATE license_keys SET revoked=1 WHERE id=?').run(+req.params.id);
  if (req.body.andLicences) db.prepare("UPDATE licenses SET status='revoked', ended_at=?, note='key revoked' WHERE key_id=? AND status='active'").run(now(), +req.params.id);
  audit(req.user.id, 'admin:key_revoked', req.params.id, req.body.andLicences ? 'and licences' : null);
  res.json({ ok: true });
});
admin.get('/signlog', (req, res) => res.json(db.prepare('SELECT s.*, u.email FROM sign_log s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.id DESC LIMIT 500').all()));
admin.get('/audit', (req, res) => res.json(db.prepare('SELECT a.*, u.email actor FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 500').all()));
admin.get('/visitors', (req, res) => {
  const t = now(), q = (sql, ...a) => db.prepare(sql).get(...a).n;
  const dayKey = "date(created_at/1000,'unixepoch','localtime')";
  const daily = db.prepare(`SELECT ${dayKey} day, COUNT(DISTINCT device_id) active, SUM(kind='open') opens FROM events WHERE created_at>? GROUP BY day ORDER BY day`).all(t - 30 * DAY);
  const fresh = db.prepare("SELECT date(first_seen/1000,'unixepoch','localtime') day, COUNT(*) n FROM devices WHERE first_seen>? GROUP BY day").all(t - 30 * DAY);
  const nmap = Object.fromEntries(fresh.map(r => [r.day, r.n]));
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(t - i * DAY), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const r = daily.find(x => x.day === k) || {};
    days.push({ day: k, active: r.active || 0, opens: r.opens || 0, new: nmap[k] || 0 });
  }
  res.json({
    totals: {
      devices: q('SELECT COUNT(*) n FROM devices'),
      guests: q('SELECT COUNT(*) n FROM devices WHERE user_id IS NULL'),
      with_account: q('SELECT COUNT(*) n FROM devices WHERE user_id IS NOT NULL'),
      today: q('SELECT COUNT(*) n FROM devices WHERE last_seen>?', t - DAY),
      d7: q('SELECT COUNT(*) n FROM devices WHERE last_seen>?', t - 7 * DAY),
      d30: q('SELECT COUNT(*) n FROM devices WHERE last_seen>?', t - 30 * DAY),
      new7: q('SELECT COUNT(*) n FROM devices WHERE first_seen>?', t - 7 * DAY),
      opens30: q("SELECT COUNT(*) n FROM events WHERE kind='open' AND created_at>?", t - 30 * DAY),
      signs30: q("SELECT COUNT(*) n FROM events WHERE kind='sign' AND created_at>?", t - 30 * DAY)
    },
    days,
    tools: db.prepare("SELECT tool, COUNT(*) n FROM events WHERE kind IN ('tool','sign') AND tool IS NOT NULL AND created_at>? GROUP BY tool ORDER BY n DESC LIMIT 15").all(t - 30 * DAY),
    devices: db.prepare('SELECT d.*, u.email FROM devices d LEFT JOIN users u ON u.id=d.user_id ORDER BY d.last_seen DESC LIMIT 300').all()
  });
});
admin.post('/devices/:id/action', (req, res) => {
  const id = String(req.params.id), a = req.body.action;
  const col = { block: ['blocked', 1], unblock: ['blocked', 0], end_guest: ['guest_ended', 1], restore_guest: ['guest_ended', 0] }[a];
  if (!col) return res.status(400).json({ error: 'Unknown action.' });
  if (a === 'restore_guest') db.prepare('UPDATE devices SET guest_ended=0, first_seen=? WHERE device_id=?').run(now(), id);
  else db.prepare(`UPDATE devices SET ${col[0]}=? WHERE device_id=?`).run(col[1], id);
  if (a === 'block') { const d = db.prepare('SELECT user_id FROM devices WHERE device_id=?').get(id); db.prepare('DELETE FROM sessions WHERE device_id=?').run(id); }
  audit(req.user.id, 'admin:device_' + a, id.slice(0, 8));
  res.json({ ok: true });
});
app.use('/api/admin', admin);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

/* ---------- pages ---------- */
const send = (file, csp) => (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  if (csp) res.setHeader('Content-Security-Policy', csp);
  res.sendFile(path.join(PUBLIC, file));
};
const APP_HEADER_CSP = "frame-ancestors 'none'";
// the app page carries the public key that lets it check its licence offline
// The main app code is encrypted before it is sent. The key is only handed out by /api/hello and
// /api/me to people who are allowed in, so a saved or copied page can't run without the server.
let APP_HTML = null;
function appHtml() {
  if (APP_HTML) return APP_HTML;
  let html = fs.readFileSync(path.join(PUBLIC, 'app.html'), 'utf8').replace('__PT_TOKEN_KEY__', TOKEN_PUB);
  const open = '<script id="pt-main">', a = html.indexOf(open), b = html.indexOf('</script>', a);
  if (a < 0 || b < 0) throw new Error('app.html has no main script marker. Run "npm run build".');
  const code = html.slice(a + open.length, b);
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', APP_KEY, iv);
  const enc = Buffer.concat([iv, c.update(code, 'utf8'), c.final(), c.getAuthTag()]).toString('base64');
  html = html.slice(0, a) + `<script type="application/octet-stream" id="pt-main-enc">${enc}</script>` + html.slice(b + 9);
  APP_HTML = Buffer.from(html);
  return APP_HTML;
}
app.post('/share', (req, res) => res.redirect(303, '/'));  // normally handled by the service worker
// the app, with a title, description and help text for the page asked for (home or one tool)
// Google Search Console "HTML tag" check: GOOGLE_SITE_VERIFICATION = the code, or the whole <meta …> tag Google shows
const GOOGLE_META = (() => {
  const raw = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim();
  const code = (raw.match(/content\s*=\s*["']([^"']+)["']/i) || [, raw])[1].trim();
  return /^[\w-]{10,100}$/.test(code) ? `\n<meta name="google-site-verification" content="${code}">` : '';
})();
// the site's own address (PUBLIC_URL if set); a made-up Host header can't put a strange address into the pages
const siteOrigin = req => {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const host = String(req.get('host') || '');
  return `${req.protocol === 'https' ? 'https' : 'http'}://${/^[a-z0-9.-]{1,253}(:\d{1,5})?$/i.test(host) ? host.toLowerCase() : 'localhost'}`;
};
// lets Google's ad code run, only when ads are switched on; everything else stays as strict as before
const G = 'https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.adtrafficquality.google https://*.gstatic.com https://*.googleadservices.com';
function adsCsp(csp) {
  return csp
    .replace(/script-src ([^;]+)/, (m, v) => `script-src ${v} https://pagead2.googlesyndication.com ${G}`)
    .replace("frame-src 'none'", `frame-src ${G}`)
    .replace(/img-src ([^;]+)/, (m, v) => `img-src ${v} https:`)
    .replace(/connect-src ([^;]+)/, (m, v) => `connect-src ${v} ${G}`)
    .replace(/style-src ([^;]+)/, (m, v) => `style-src ${v} https://fonts.googleapis.com`)
    .replace(/font-src ([^;]+)/, (m, v) => `font-src ${v} https://fonts.gstatic.com`) + `; fenced-frame-src ${G}`;
}
function buildPage(req, slug) {
  const opt = { appName: getSetting('app_name'), origin: siteOrigin(req), free: !!freePeriod() };
  let html = appHtml().toString('utf8');
  const { head, section } = SEO.appHead(opt);
  html = html.replace(/<meta name="description"[^>]*>\n?/, '');
  html = html.replace(/<title>[^<]*<\/title>/, () => head + GOOGLE_META + (ADS_CLIENT ? `\n<meta name="google-adsense-account" content="${ADS_CLIENT}">` : ''));
  if (adsActive()) html = html.replace(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/, (m, csp) => `<meta http-equiv="Content-Security-Policy" content="${adsCsp(csp)}">`);
  const f = html.indexOf('<footer><div class="in">');
  if (f > 0) html = html.slice(0, f) + section + '\n' + html.slice(f);
  return Buffer.from(html);
}
// the page is large (about 14 MB): a few recent versions are kept ready-compressed (most-used first),
// with a tag so browsers can reuse their own copy (answer 304). Kept small so memory stays low.
const PAGE_CACHE = new Map(), PAGE_CACHE_MAX = 4;
const zlib = require('zlib');
function pageEntry(req, slug) {
  const key = [slug, getSetting('app_name'), siteOrigin(req), !!freePeriod(), adsActive()].join('|');
  let e = PAGE_CACHE.get(key);
  if (e) { PAGE_CACHE.delete(key); PAGE_CACHE.set(key, e); return e; }
  const raw = buildPage(req, slug);
  e = { raw, etag: '"' + crypto.createHash('sha256').update(raw).digest('base64url').slice(0, 27) + '"' };
  PAGE_CACHE.set(key, e);
  while (PAGE_CACHE.size > PAGE_CACHE_MAX) PAGE_CACHE.delete(PAGE_CACHE.keys().next().value);
  return e;
}
function packed(e, enc, req, slug) {
  if (!e[enc]) {
    const raw = e.raw || buildPage(req, slug);
    e[enc] = enc === 'br'
      ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
      : zlib.gzipSync(raw, { level: 5 });
    e.raw = null; // the compressed copy is enough; the plain one is rebuilt for the rare browser that needs it
  }
  return e[enc];
}
function sendApp(req, res, slug) {
  if (!fs.existsSync(path.join(PUBLIC, 'app.html'))) return res.status(500).send('Run "npm run build" first.');
  const e = pageEntry(req, slug);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('ETag', e.etag);
  res.setHeader('Content-Security-Policy', APP_HEADER_CSP);
  res.type('html');
  if (String(req.headers['if-none-match'] || '').split(/\s*,\s*/).includes(e.etag)) return res.status(304).end();
  const ae = String(req.headers['accept-encoding'] || ''), enc = /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : '';
  if (!enc) return res.send(e.raw || buildPage(req, slug));
  res.setHeader('Content-Encoding', enc);
  const buf = packed(e, enc, req, slug); res.setHeader('Content-Length', buf.length); res.end(buf);
}
// the full app (not shown in Google; the light pages below are)
app.get(['/app', '/open'], (req, res) => { res.setHeader('X-Robots-Tag', 'noindex'); sendApp(req, res, null); });
// light, fast search pages: home, all tools, one page per tool (English, Hindi, Kannada)
function pageUser(req) {
  const tok = parseCookies(req).pt_session; if (!tok) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(sha(tok), now());
  const u = s && db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id);
  return u && u.status === 'active' ? u : null;
}
function lightOpt(req, res) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const u = pageUser(req), plan = u ? licenseState(u).plan : null;
  const ads = adsActive() && !['paid', 'admin'].includes(plan) ? { client: ADS_CLIENT, slot: ADS_SLOT || null } : null;
  const G2 = ads ? ` ${G}` : '';
  res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'nonce-${nonce}'${ads ? ` https://pagead2.googlesyndication.com${G2}` : ''}; style-src 'unsafe-inline'; img-src 'self' data:${ads ? ' https:' : ''}; connect-src 'self'${G2}; frame-src ${ads ? G : "'none'"}; ${ads ? `fenced-frame-src ${G}; ` : ''}object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html');
  return { appName: getSetting('app_name'), origin: siteOrigin(req), free: !!freePeriod(), nonce, ads };
}
// small pages are sent compressed (brotli or gzip)
function sendHtml(req, res, html, status = 200) {
  const buf = Buffer.from(html), ae = String(req.headers['accept-encoding'] || '');
  res.status(status); res.setHeader('Vary', 'Accept-Encoding');
  if (/\bbr\b/.test(ae)) { res.setHeader('Content-Encoding', 'br'); return res.end(zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } })); }
  if (/\bgzip\b/.test(ae)) { res.setHeader('Content-Encoding', 'gzip'); return res.end(zlib.gzipSync(buf, { level: 6 })); }
  res.end(buf);
}
const withMeta = html => GOOGLE_META || ADS_CLIENT ? html.replace('</head>', `${GOOGLE_META}${ADS_CLIENT ? `\n<meta name="google-adsense-account" content="${ADS_CLIENT}">` : ''}\n</head>`) : html;
// pdf.aksmarts.com and /tools open the full app; the one-page-per-tool search pages below stay for Google
app.get('/', (req, res) => res.redirect(302, '/app' + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '')));
app.get('/tools', (req, res) => res.redirect(302, '/app#tools'));
app.get('/:slug', (req, res, next) => SEO.BY_SLUG.has(req.params.slug) ? sendHtml(req, res, withMeta(SEO.landing(req.params.slug, 'en', lightOpt(req, res)))) : next());
app.get('/:lang/:slug', (req, res, next) => SEO.LANGS.includes(req.params.lang) && SEO.hasLang(req.params.lang, req.params.slug) ? sendHtml(req, res, withMeta(SEO.landing(req.params.slug, req.params.lang, lightOpt(req, res)))) : next());
// legal pages: privacy, terms, licence, refunds, cookies, disclaimer, contact (text in server/legal.js)
const LEGAL = require('./legal');
const legalGet = k => k === '__ads' ? adsActive() : getSetting(k);
for (const [key, pg] of Object.entries(LEGAL.PAGES)) app.get(pg.path, (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.type('html').send(LEGAL.render(key, legalGet));
});
for (const [from, to] of Object.entries(LEGAL.ALIASES)) app.get(from, (req, res) => res.redirect(301, to));
app.get('/ads.txt', (req, res) => ADS_CLIENT ? res.type('text/plain').send(`google.com, ${ADS_CLIENT.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`) : res.status(404).type('text/plain').send('No ads on this site.\n'));
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /share\n\nSitemap: ${siteOrigin(req)}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(SEO.sitemap(siteOrigin(req), Object.values(LEGAL.PAGES).map(p => p.path))));
app.get('/admin', send('admin.html', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'"));
app.get('/sw.js', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Service-Worker-Allowed', '/'); res.sendFile(path.join(PUBLIC, 'sw.js')); });
// never serve the page files directly: /app.html would skip the code lock, /admin.html its security header
app.get(/^\/(app|admin)\.html$/i, (req, res) => res.redirect(301, req.params[0].toLowerCase() === 'admin' ? '/admin' : '/'));
app.use(express.static(PUBLIC, { index: false, maxAge: '1h', setHeaders: (res, p) => { if (/app\.html$/.test(p)) res.setHeader('Cache-Control', 'no-store'); } }));
// anything else: a friendly "page not found" with status 404 (so Google drops it)
app.use((req, res) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && /html/.test(String(req.headers.accept || 'text/html'))) return sendHtml(req, res, SEO.notFound(lightOpt(req, res)), 404);
  res.status(404).type('text').send('Not found.');
});

// errors: a short message, never the internal details
app.use((err, req, res, next) => {
  const status = err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  const msg = status === 413 ? 'That request is too large.' : status < 500 ? 'Bad request.' : 'Something went wrong. Please try again.';
  if (res.headersSent) return;
  if (req.path.startsWith('/api/')) res.status(status).json({ error: msg }); else res.status(status).type('text').send(msg);
});
process.on('unhandledRejection', e => console.error('unhandled:', e));

const PORT = +process.env.PORT || 8080;
if (!fs.existsSync(path.join(PUBLIC, 'app.html'))) console.warn('public/app.html is missing. Run "npm run build" first.');
PERSIST.startAutoSave(db);
app.listen(PORT, () => {
  console.log(`${getSetting('app_name')} running on http://localhost:${PORT}`);
  if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) console.log('No admin yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in your hosting settings, or run: npm run create-admin -- you@example.com YourPassword "Your Name"');
});
