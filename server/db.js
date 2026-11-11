'use strict';
// SQLite storage using Node's built-in driver (Node 22.13+), so there is nothing native to compile.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'pdftools.db'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_login INTEGER,
  signup_device TEXT
);
CREATE TABLE IF NOT EXISTS licenses(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,              -- trial | paid
  status TEXT NOT NULL DEFAULT 'active', -- active | cancelled | revoked
  starts_at INTEGER NOT NULL,
  expires_at INTEGER,              -- NULL = never expires (lifetime)
  key_id INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS lic_user ON licenses(user_id);
CREATE TABLE IF NOT EXISTS license_keys(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  days INTEGER NOT NULL,           -- 0 = lifetime
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trial_devices(
  device_id TEXT PRIMARY KEY,
  user_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS esign_certs(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cert_pem TEXT NOT NULL,
  key_enc TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sign_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  kind TEXT NOT NULL,
  file_name TEXT,
  digest TEXT,
  signer TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS devices(
  device_id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  visits INTEGER NOT NULL DEFAULT 1,
  opens INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER,
  user_agent TEXT,
  blocked INTEGER NOT NULL DEFAULT 0,
  guest_ended INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,
  user_id INTEGER,
  kind TEXT NOT NULL,      -- visit | open | tool | sign
  tool TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ev_time ON events(created_at);
CREATE TABLE IF NOT EXISTS audit(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL
);
`);

const DEFAULTS = {
  app_name: 'AK Smarts PDF',
  signup_open: '1',          // allow new accounts
  trial_enabled: '1',        // new accounts get a free trial
  trial_days: '14',          // trial length
  trial_max_users: '0',      // how many trials may ever be given (0 = no limit)
  trial_one_per_device: '1', // stop people making new accounts on the same computer for another trial
  otp_login_on: '0',        // no longer used (code-only login was removed in 1.1); kept so old settings files still load
  otp_required: '0',        // ask everyone for a code by email/SMS after their password
  max_devices: '2',          // computers/browsers one account can be signed in on at once
  expired_mode: 'reader',    // reader = free reader after trial ends, block = app locked
  offline_days: '0',         // how long the app works without reaching the server (0 = must be online)
  guest_mode: '1',           // 1 = free for everyone, no account needed (promotion period)
  free_until: '',            // last day of the free period (YYYY-MM-DD); '' = until switched off. Set to 3 months on first start.
  guest_days: '0',           // free days per device in guest mode (0 = until you switch guest mode off)
  guest_features: 'full',    // full = every tool, reader = read and print only
  guest_banner: 'Create a free account to keep your access and use e-Sign.',
  buy_url: '',               // payment page (e.g. a Razorpay or Stripe payment link)
  price_text: '₹999 per year',
  show_price: '0',           // 1 = show the price in the app and legal pages (hidden for now)
  support_email: '',
  alert_admin: '1',         // email the owner when someone logs in as admin (needs SMTP settings)
  alert_email: '',          // where alerts go ('' = the first admin's email)
  ads_on: '1',              // show Google AdSense ads (only when ADSENSE_CLIENT is set on the server)
  legal_owner: 'AK Smarts',            // business name shown in the legal pages
  legal_email: 'akhotapp@gmail.com',   // contact and grievance email
  legal_address: '',                   // business address (fill in)
  legal_jurisdiction: '',              // courts for disputes, e.g. "Bengaluru, Karnataka" (fill in)
  legal_grievance: '',                 // Grievance Officer name ('' = the business name)
  legal_refund_days: '7'               // refund window in days
};
const getSetting = k => {
  const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k);
  return r ? r.value : DEFAULTS[k];
};
const allSettings = () => {
  const o = { ...DEFAULTS };
  for (const r of db.prepare('SELECT key,value FROM settings').all()) o[r.key] = r.value;
  return o;
};
const setSetting = (k, v) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
// first start: the free period runs for 3 months from today (change or remove it in the admin console)
if (!db.prepare("SELECT 1 FROM settings WHERE key='free_until'").get()) {
  const d = new Date(); d.setMonth(d.getMonth() + 3);
  setSetting('free_until', d.toISOString().slice(0, 10));
}
// is the free-for-everyone period running right now?
const freePeriod = () => {
  const s = allSettings();
  if (s.guest_mode !== '1') return null;
  const until = /^\d{4}-\d{2}-\d{2}$/.test(s.free_until) ? s.free_until : '';
  const end = until ? Date.parse(until + 'T23:59:59Z') : null;
  if (end && end < Date.now()) return null;
  return { until, end, days_left: end ? Math.max(1, Math.ceil((end - Date.now()) / 864e5)) : null };
};

module.exports = { db, DATA_DIR, DEFAULTS, getSetting, allSettings, setSetting, freePeriod };
