// Keeps the data folder (database + keys) in a free Postgres database (Neon, Supabase…),
// for hosts whose own disk is wiped on every restart, such as Render's free plan.
// Only used when DATABASE_URL is set; otherwise everything stays in the local data folder.
//
// How it works: on start, the files are downloaded from Postgres into the data folder.
// While running, any change is copied back within a few seconds, and once more on shutdown.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');

// accepts the string as copied from Neon/Supabase, even with "psql '...'" around it; "none" = not used
const URL_ = (() => {
  let u = String(process.env.DATABASE_URL || '').trim().replace(/^psql\s+/i, '').replace(/^['"]|['"]$/g, '').trim();
  return /^postgres(ql)?:\/\//i.test(u) ? u : '';
})();
if (process.env.DATABASE_URL && !URL_ && !/^(none|off|-)?$/i.test(process.env.DATABASE_URL.trim())) console.warn('DATABASE_URL doesn\'t look like a Postgres address (it should start with postgresql://). Data will NOT be kept after a restart.');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = 'pdftools.db';
const enabled = !!URL_;
let pool = null;

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(URL_);
    pool = new Pool({ connectionString: URL_, max: 2, connectionTimeoutMillis: 15000, ssl: local || /sslmode=disable/.test(URL_) ? false : { rejectUnauthorized: true } });
    pool.on('error', e => console.warn('database connection:', e.message));
  }
  return pool;
}

async function restore() {
  if (!enabled) return 0;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const p = getPool();
  // a sleeping free database can take a few seconds to wake up: try a few times
  for (let i = 1; ; i++) {
    try { await p.query('SELECT 1'); break; }
    catch (e) { if (i >= 5 || e.code === 'ENOTFOUND' || /password|does not exist/i.test(e.message)) throw e; console.warn(`Database not ready (${e.message}), trying again…`); await new Promise(r => setTimeout(r, 3000 * i)); }
  }
  await p.query('CREATE TABLE IF NOT EXISTS ak_files (name TEXT PRIMARY KEY, data BYTEA NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const { rows } = await p.query('SELECT name, data FROM ak_files');
  for (const r of rows) {
    if (!/^[\w.-]+$/.test(r.name)) continue;
    fs.writeFileSync(path.join(DATA_DIR, r.name), r.data, { mode: 0o600 });
    if (r.name === DB_FILE) for (const x of ['-wal', '-shm']) fs.rmSync(path.join(DATA_DIR, DB_FILE + x), { force: true });
  }
  return rows.length;
}

const put = (name, buf) => getPool().query(
  'INSERT INTO ak_files(name, data, updated_at) VALUES($1, $2, now()) ON CONFLICT(name) DO UPDATE SET data=excluded.data, updated_at=now()', [name, buf]);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let lastChanges = -1, hashes = {}, chain = Promise.resolve(), timer = null;

async function saveOnce(db) {
  // the database: a consistent copy, only when something changed
  const n = db.prepare('SELECT total_changes() AS n').get().n;
  if (n !== lastChanges) {
    const tmp = path.join(os.tmpdir(), `ak-snapshot-${process.pid}.db`);
    fs.rmSync(tmp, { force: true });
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const buf = fs.readFileSync(tmp); fs.rmSync(tmp, { force: true });
    await put(DB_FILE, buf);
    lastChanges = n;
  }
  // the key files (made once, then rarely change)
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (f.startsWith(DB_FILE) || !/^[\w.-]+$/.test(f)) continue;
    const full = path.join(DATA_DIR, f);
    if (!fs.statSync(full).isFile()) continue;
    const buf = fs.readFileSync(full), h = sha(buf);
    if (hashes[f] !== h) { await put(f, buf); hashes[f] = h; }
  }
}
// queued so two saves never run at the same time
function save(db) {
  if (!enabled) return Promise.resolve();
  chain = chain.then(() => saveOnce(db)).catch(e => console.warn('saving to the database failed (will retry):', e.message));
  return chain;
}

function startAutoSave(db) {
  if (!enabled || timer) return;
  save(db);
  timer = setInterval(() => save(db), 3000);
  const stop = sig => { clearInterval(timer); save(db).finally(() => { console.log(`saved, stopping (${sig})`); process.exit(0); }); };
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
}

// for one-off commands (create-admin, reset-2fa): save, then exit
async function finish(db, code = 0) {
  if (enabled) { await save(db); await getPool().end().catch(() => {}); }
  process.exit(code);
}

module.exports = { enabled, url: URL_, restore, startAutoSave, save, finish, DATA_DIR };
