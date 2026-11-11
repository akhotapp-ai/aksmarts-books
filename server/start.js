// Entry point: if DATABASE_URL is set, bring the saved data back from Postgres first, then start.
// If the database can't be reached, the site shows a "setting up" page (instead of crashing)
// and keeps trying; the real app starts as soon as the database answers.
const http = require('http');
const persist = require('./persist');

function describeUrl() {
  try {
    const u = new URL(persist.url);
    return { safe: `${u.protocol}//${u.username || '?'}:****@${u.host}${u.pathname}`, host: u.hostname };
  } catch (e) { return { safe: '(not a valid address)', host: '' }; }
}
function hint(e) {
  const { safe, host } = describeUrl();
  const lines = [`Could not reach the database (DATABASE_URL): ${e.message}`, `DATABASE_URL is set to: ${safe}`];
  if (host && !host.includes('.')) lines.push(`"${host}" is not a real database address. In Neon, open your project → Connect, copy the whole connection string (it looks like postgresql://neondb_owner:...@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require) and paste it into Render → Environment → DATABASE_URL.`);
  else if (/password authentication/i.test(e.message)) lines.push('The user name or password in DATABASE_URL is wrong. Copy the connection string from Neon again (with the password shown).');
  else lines.push('Check DATABASE_URL in Render → Environment: it must be the full connection string from Neon, starting with postgresql://');
  return lines;
}

(async () => {
  if (persist.enabled) {
    let waitServer = null, msg = [];
    for (let attempt = 1; ; attempt++) {
      try {
        const n = await persist.restore();
        console.log(n ? `Restored ${n} saved file${n === 1 ? '' : 's'} from the database.` : 'Database connected (empty: starting fresh).');
        break;
      } catch (e) {
        msg = hint(e); msg.forEach(l => console.error(l));
        // answer on the port so the host sees the service, but never start with empty data
        if (!waitServer) {
          waitServer = http.createServer((req, res) => {
            res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '30' });
            res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Starting up</title><body style="font-family:system-ui;max-width:640px;margin:60px auto;padding:0 16px;color:#17262a"><h2>The app is starting up</h2><p>Please try again in a minute.</p><p style="color:#666;font-size:.9rem">Owner: the app can't reach its database. Check DATABASE_URL in your hosting settings. The exact reason is in the server logs.</p></body>`);
          }).listen(+process.env.PORT || 8080);
        }
        await new Promise(r => setTimeout(r, Math.min(60000, 10000 * attempt)));
      }
    }
    if (waitServer) { const c = new Promise(r => waitServer.close(r)); waitServer.closeAllConnections(); await c; }
  }
  require('./server');
})();
