'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = t => t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
const when = t => t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '–';
let toastT;
function toast(t, bad) { const e = $('toast'); e.textContent = t; e.className = 'on' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => e.className = '', 3200); }
async function api(path, body, method) {
  const r = await fetch('/api/admin' + path, { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin', headers: Object.assign({ 'x-pt': '1' }, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const e = new Error(j.error || 'Server error ' + r.status); e.status = r.status; throw e; }
  return j;
}
function planPill(l) {
  if (!l) return '';
  const cls = l.plan === 'admin' ? 'ok' : l.plan === 'paid' ? 'ok' : l.plan === 'trial' || l.plan === 'promo' ? 'trial' : 'bad';
  return `<span class="pill ${cls}">${esc(l.label)}</span>`;
}

/* ---------- tabs ---------- */
let TAB = 'overview';
function show(tab) {
  TAB = tab;
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach(s => s.hidden = s.id !== 'tab-' + tab);
  history.replaceState(null, '', '#' + tab);
  ({ overview: loadOverview, visitors: loadVisitors, users: loadUsers, settings: loadSettings, keys: loadKeys, signs: loadSigns, audit: loadAudit, security: loadSecurity })[tab]();
}
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => show(b.dataset.tab));
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));

/* ---------- overview ---------- */
let SETTINGS = null, ME_ID = null;
async function loadOverview() {
  const [s, st] = await Promise.all([api('/stats'), api('/settings')]);
  SETTINGS = st;
  $('appName').textContent = st.app_name;
  api('/security').then(x => { $('secWarn').hidden = x.totp_on }).catch(() => {});
  const tiles = [['Users', s.users], ['Active trials', s.trials_active], ['Paying customers', s.paid_active], ['Sign-ups (7 days)', s.signups_7d], ['Signatures (30 days)', s.signatures_30d], ['Unused keys', s.keys_unused]];
  $('tiles').innerHTML = tiles.map(([l, v]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join('');
  const max = +st.trial_max_users;
  $('trialSummary').textContent = `${s.trials_active} active trial${s.trials_active === 1 ? '' : 's'}. ${s.trials_given} trial${s.trials_given === 1 ? '' : 's'} given so far${max ? ` out of a limit of ${max}` : ''}. New accounts ${st.trial_enabled === '1' ? `get a ${st.trial_days}-day trial` : 'do not get a trial'}.`;
  const on = st.free_active;
  const ended = st.guest_mode === '1' && !on;
  $('freeBox').classList.toggle('on', on);
  $('freeSummary').textContent = on
    ? `ON: everyone can use ${st.guest_features === 'reader' ? 'the reader' : 'every tool'} free, with or without an account${st.free_until ? `, until ${st.free_until} (${st.free_days_left} day${st.free_days_left === 1 ? '' : 's'} left)` : ', until you end it'}${+st.guest_days ? `, at most ${st.guest_days} days per computer` : ''}. Accounts made now get their ${st.trial_days}-day trial after the free period. ${s.guests_active ?? ''}`.trim()
    : ended ? `ENDED on ${st.free_until}. People must log in; new accounts get the normal free trial.` : 'OFF: people must log in or create an account. New accounts get the normal free trial.';
  $('freeToggle').textContent = on ? 'End free period now' : 'Start a free period';
  $('freeToggle').className = on ? 'btn danger' : 'btn';
  $('freeExtend').hidden = !on;
  $('toggleTrials').textContent = st.trial_enabled === '1' ? 'Stop giving new trials' : 'Start giving new trials';
}
$('cancelAll').onclick = async () => {
  if (!confirm('Cancel every active free trial now? Those users drop to reader mode (or are locked out, depending on your rules). Paid licences are not touched.')) return;
  const stopNew = confirm('Also stop giving free trials to new accounts?\n\nOK = stop new trials too\nCancel = keep giving new trials');
  const r = await api('/trials/cancel-all', { stopNew });
  toast(`${r.cancelled} trial${r.cancelled === 1 ? '' : 's'} cancelled.`); loadOverview();
};
const plusMonths = n => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const askDate = (msg, def) => {
  const v = prompt(msg + '\n\nEnter the last free day as YYYY-MM-DD, or leave empty for no end date.', def);
  if (v === null) return null;
  if (v.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) { toast('Use the format YYYY-MM-DD, for example ' + plusMonths(3), true); return null; }
  return v.trim();
};
$('freeToggle').onclick = async () => {
  const on = SETTINGS.free_active;
  if (on) {
    if (!confirm('End the free period now? People without an account will be asked to create one (within 5 minutes in open apps), and accounts without a licence move to the free trial.')) return;
    await api('/settings', { guest_mode: false }, 'PUT'); toast('Free period ended.');
  } else {
    const d = askDate('Start a free period for everyone. Until when?', plusMonths(3)); if (d === null) return;
    await api('/settings', { guest_mode: true, free_until: d }, 'PUT'); toast('Free period started.');
  }
  loadOverview();
};
$('freeExtend').onclick = async () => {
  const d = askDate('Change the end date of the free period.', SETTINGS.free_until || plusMonths(3)); if (d === null) return;
  await api('/settings', { free_until: d }, 'PUT'); toast(d ? 'Free period now ends on ' + d + '.' : 'Free period has no end date now.'); loadOverview();
};
$('toggleTrials').onclick = async () => {
  await api('/settings', { trial_enabled: SETTINGS.trial_enabled !== '1' }, 'PUT');
  toast('Saved.'); loadOverview();
};

/* ---------- visitors ---------- */
const shortDay = k => new Date(k + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
async function loadVisitors() {
  const v = await api('/visitors'), t = v.totals;
  const tiles = [['Computers ever', t.devices], ['Without an account', t.guests], ['With an account', t.with_account], ['Active today', t.today], ['Active 7 days', t.d7], ['Active 30 days', t.d30], ['New this week', t.new7], ['PDFs opened (30 days)', t.opens30]];
  $('vtiles').innerHTML = tiles.map(([l, n]) => `<div class="tile"><b>${n}</b><span>${l}</span></div>`).join('');
  const max = Math.max(1, ...v.days.map(d => d.active));
  $('vchart').parentElement.classList.add('chart-wrap');
  $('vchart').innerHTML = v.days.map((d, i) => `<div class="c" title="${shortDay(d.day)}: ${d.active} active, ${d.new} new, ${d.opens} PDFs opened"><div class="a" style="height:${d.active / max * 100}%"><div class="n" style="height:${d.active ? Math.min(100, d.new / d.active * 100) : 0}%"></div></div>${i % 5 === 4 || i === 29 ? `<span class="lb">${shortDay(d.day)}</span>` : ''}</div>`).join('');
  const tmax = Math.max(1, ...v.tools.map(x => x.n));
  const tname = x => x.startsWith('run:') ? x.slice(4) + ' (run)' : x;
  $('vtools').innerHTML = v.tools.length ? '<div class="bars">' + v.tools.map(x => `<div><b>${esc(tname(x.tool))}</b><i style="width:${x.n / tmax * 100}%"></i><span>${x.n}</span></div>`).join('') + '</div>' : '<p class="muted">No tools used yet.</p>';
  $('vtbl').tBodies[0].innerHTML = v.devices.map(d => `<tr><td class="mono" title="${esc(d.device_id)}">${esc(d.device_id.slice(0, 8))}<span class="sub">${esc(browser(d.user_agent))}</span></td><td>${d.email ? esc(d.email) : '<span class="muted">No account</span>'}</td><td>${day(d.first_seen)}</td><td>${when(d.last_seen)}</td><td>${d.visits}</td><td>${d.opens}</td>
    <td>${d.blocked ? '<span class="pill bad">Blocked</span>' : d.guest_ended ? '<span class="pill warn">Free access ended</span>' : '<span class="pill ok">OK</span>'}</td>
    <td><div class="row">${d.blocked ? `<button class="btn2" data-dev="${esc(d.device_id)}" data-dact="unblock">Unblock</button>` : `<button class="btn2 danger" data-dev="${esc(d.device_id)}" data-dact="block">Block</button>`}${d.email ? '' : d.guest_ended ? `<button class="btn2" data-dev="${esc(d.device_id)}" data-dact="restore_guest">Give free access again</button>` : `<button class="btn2" data-dev="${esc(d.device_id)}" data-dact="end_guest">End free access</button>`}</div></td></tr>`).join('') || '<tr><td colspan="8" class="muted">Nobody yet.</td></tr>';
}
$('vtbl').addEventListener('click', async e => {
  const b = e.target.closest('[data-dact]'); if (!b) return;
  const a = b.dataset.dact;
  if (a === 'block' && !confirm('Block this computer? It won’t be able to use the app, even with an account (except admins).')) return;
  await api(`/devices/${encodeURIComponent(b.dataset.dev)}/action`, { action: a }); toast('Done.'); loadVisitors();
});

/* ---------- users ---------- */
let qT;
$('uq').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(loadUsers, 250); });
async function loadUsers() {
  const rows = await api('/users?q=' + encodeURIComponent($('uq').value.trim()));
  $('ucount').textContent = `${rows.length} user${rows.length === 1 ? '' : 's'}`;
  $('utbl').tBodies[0].innerHTML = rows.map(u => `<tr class="click" data-id="${u.id}">
    <td><b>${esc(u.name)}</b>${u.role === 'admin' ? ' <span class="pill">admin</span>' : ''}<span class="sub">${esc([u.email, u.phone].filter(Boolean).join(' · '))}</span></td>
    <td>${planPill(u.license)}</td>
    <td>${u.status === 'active' ? '<span class="pill ok">Active</span>' : '<span class="pill bad">Disabled</span>'}</td>
    <td>${u.devices}</td><td>${day(u.created_at)}</td><td>${when(u.last_login)}</td>
    <td><button class="btn2">Manage</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No users found.</td></tr>';
}
$('utbl').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) openUser(+tr.dataset.id); });
let UID = null;
async function openUser(id) {
  UID = id;
  const d = await api('/users/' + id);
  $('uName').textContent = d.user.name; $('uEmail').textContent = [d.user.email, d.user.phone].filter(Boolean).join(' · ') + ' · joined ' + day(d.user.created_at);
  $('uPlan').innerHTML = planPill(d.license) + (d.license.active ? '' : ' <span class="muted">This person can only use the free reader.</span>');
  const admin = d.user.role === 'admin', dis = d.user.status !== 'active';
  $('uDisable').hidden = dis; $('uEnable').hidden = !dis; $('uMkAdmin').hidden = admin; $('uRmAdmin').hidden = !admin; $('uReset2fa').hidden = !d.user.totp_on || d.user.id === ME_ID;
  $('uLics').tBodies[0].innerHTML = d.licenses.map(l => `<tr><td>${l.kind === 'trial' ? 'Trial' : 'Paid'}</td><td>${esc(l.status)}${l.status === 'active' && l.expires_at && l.expires_at < Date.now() ? ' (ended)' : ''}</td><td>${day(l.starts_at)}</td><td>${l.expires_at ? day(l.expires_at) : 'Lifetime'}</td><td>${esc(l.note || '')}${l.key ? ' <span class="mono">' + esc(l.key) + '</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">None</td></tr>';
  $('uSess').tBodies[0].innerHTML = d.sessions.map(s => `<tr><td class="mono">${esc((s.device_id || '').slice(0, 8))}</td><td>${esc(browser(s.user_agent))}</td><td>${day(s.created_at)}</td><td>${when(s.last_seen)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Not signed in anywhere</td></tr>';
  $('umsg').textContent = '';
  if (!$('udlg').open) $('udlg').showModal();
}
const browser = ua => !ua ? '' : /Electron/.test(ua) ? 'Desktop app' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ua.slice(0, 40);
$('uClose').onclick = () => $('udlg').close();
$('udlg').addEventListener('close', () => { if (TAB === 'users') loadUsers(); });
document.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
  const action = b.dataset.act, body = { action };
  if (action === 'extend_trial') body.days = +$('uTrialDays').value;
  if (action === 'grant') body.days = +$('uLicDays').value;
  if (action === 'reset_password') { const p = prompt('New password for this user (at least 8 characters):'); if (!p) return; body.password = p; }
  const confirmText = { cancel_trial: 'Cancel this person’s free trial now?', revoke: 'Revoke all of this person’s licences now?', delete: 'Delete this account for good? This can’t be undone.', disable: 'Disable this account? They will be signed out everywhere.', remove_admin: 'Remove admin rights?', make_admin: 'Make this person an administrator? They will be able to change everything here.', reset_2fa: 'Switch off 2-step login for this person? Do this only if they lost their phone and backup codes. They should set it up again straight away.' }[action];
  if (confirmText && !confirm(confirmText)) return;
  try {
    await api(`/users/${UID}/action`, body);
    toast('Done.');
    if (action === 'delete') { $('udlg').close(); return; }
    openUser(UID);
  } catch (e) { $('umsg').textContent = e.message; $('umsg').className = 'msg bad'; }
});

/* ---------- settings ---------- */
async function loadSettings() {
  const s = await api('/settings'); SETTINGS = s;
  const f = $('sform');
  for (const el of f.elements) { if (!el.name) continue; if (el.type === 'checkbox') el.checked = s[el.name] === '1'; else el.value = s[el.name] ?? ''; }
  const o = s.otp || {};
  $('otpState').textContent = `“Forgot password?” by email code: ${o.email ? 'ready' + (o.test_mode ? ' (test mode: codes are printed in the server log; turn off OTP_DEV_LOG before going live)' : '') : 'not set up (add the SMTP settings). Until then, reset passwords under Users → Manage.'}`;
  $('adsState').textContent = s.ads_client ? `AdSense account ${s.ads_client}${s.ads_slot ? `, ad unit ${s.ads_slot}` : '. No ad unit yet: set ADSENSE_SLOT on the server after Google approves your site.'}` : 'Not set up: add ADSENSE_CLIENT (ca-pub-…) in your hosting settings. Until then no ads are shown.';
  $('smsg').textContent = '';
}
$('sform').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {};
  for (const el of e.target.elements) { if (!el.name) continue; body[el.name] = el.type === 'checkbox' ? el.checked : el.value; }
  try { SETTINGS = await api('/settings', body, 'PUT'); $('smsg').textContent = 'Saved. Apps pick up the new rules within 5 minutes.'; $('smsg').className = 'msg ok'; $('appName').textContent = SETTINGS.app_name; }
  catch (err) { $('smsg').textContent = err.message; $('smsg').className = 'msg bad'; }
});

/* ---------- keys ---------- */
async function loadKeys() {
  const rows = await api('/keys');
  $('ktbl').tBodies[0].innerHTML = rows.map(k => `<tr><td class="mono">${esc(k.key)}</td><td>${k.days ? k.days + ' days' : 'Lifetime'}</td><td>${k.uses} / ${k.max_uses}</td><td>${esc(k.used_by || '–')}</td><td>${esc(k.note || '')}</td><td>${day(k.created_at)}</td>
    <td>${k.revoked ? '<span class="pill bad">Revoked</span>' : `<button class="btn2 danger" data-revoke="${k.id}">Revoke</button>`}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No keys yet.</td></tr>';
}
$('kform').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, r = await api('/keys', { count: f.count.value, days: f.days.value, max_uses: f.max_uses.value, note: f.note.value });
  $('newKeys').hidden = false;
  $('newKeys').innerHTML = `<b>${r.keys.length} new key${r.keys.length === 1 ? '' : 's'}</b> · <button type="button" class="btn2" id="copyKeys">Copy</button><pre class="mono">${r.keys.map(esc).join('\n')}</pre>`;
  $('copyKeys').onclick = () => navigator.clipboard.writeText(r.keys.join('\n')).then(() => toast('Copied.'), () => toast('Select the keys and copy them.', true));
  loadKeys();
});
$('ktbl').addEventListener('click', async e => {
  const b = e.target.closest('[data-revoke]'); if (!b) return;
  if (!confirm('Revoke this key so it can’t be used any more?')) return;
  const andLicences = confirm('Also end the licences of people who already used it?\n\nOK = end their licences too\nCancel = only stop new use');
  await api(`/keys/${b.dataset.revoke}/revoke`, { andLicences }); toast('Key revoked.'); loadKeys();
});

/* ---------- logs ---------- */
async function loadSigns() {
  const rows = await api('/signlog');
  $('stbl').tBodies[0].innerHTML = rows.map(s => `<tr><td>${when(s.created_at)}</td><td>${s.kind === 'esign' ? 'e-Sign' : s.kind === 'esign-guest' ? 'e-Sign (no account)' : 'DSC'}</td><td>${esc(s.signer)}</td><td>${esc(s.email || '')}</td><td>${esc(s.file_name || '')}</td><td class="mono" title="${esc(s.digest)}">${esc((s.digest || '').slice(0, 16))}…</td><td class="mono">${esc(s.ip || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No signatures yet.</td></tr>';
}
async function loadAudit() {
  const rows = await api('/audit');
  $('atbl').tBodies[0].innerHTML = rows.map(a => `<tr><td>${when(a.created_at)}</td><td>${esc(a.actor || '')}</td><td>${esc(a.action.replace('admin:', '').replace(/_/g, ' '))}</td><td>${esc(a.target || '')}</td><td class="small">${esc(a.detail || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nothing yet.</td></tr>';
}

/* ---------- start ---------- */
(async () => {
  try {
    const me = await fetch('/api/me', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null);
    if (!me || me.user.role !== 'admin') { $('denied').hidden = false; document.querySelector('.tabs').hidden = true; return; }
    $('meName').textContent = me.user.name; ME_ID = me.user.id;
    const t = location.hash.slice(1);
    show(['overview', 'visitors', 'users', 'settings', 'keys', 'signs', 'audit', 'security'].includes(t) ? t : 'overview');
  } catch (e) { toast(e.message, true); }
})();

/* ---------- security: 2-step login and alerts ---------- */
async function loadSecurity() {
  const x = await api('/security');
  $('tfaOff').hidden = x.totp_on; $('tfaOn').hidden = !x.totp_on; $('tfaSetup').hidden = true; $('tfaStart').hidden = false;
  $('tfaBackupLeft').textContent = `${x.backup_left} backup code${x.backup_left === 1 ? '' : 's'} left.`;
  $('mailState').innerHTML = x.mail_ready ? `Email is set up. Alerts go to <b>${esc(x.alert_to || '')}</b>.` : 'Email is <b>not set up</b> on the server yet, so alerts can’t be sent. Add the SMTP settings (see README, “Admin security”) and restart the server.';
  const f = $('alertForm'); f.alert_admin.checked = x.alert_admin; f.alert_email.value = x.alert_email || '';
  $('alertTest').disabled = !x.mail_ready;
  $('admTbl').tBodies[0].innerHTML = x.admins.map(a => `<tr><td><b>${esc(a.name)}</b><span class="sub">${esc(a.email)}</span></td><td>${a.totp_on ? '<span class="pill ok">On</span>' : '<span class="pill warn">Off</span>'}</td><td>${when(a.last_login)}</td></tr>`).join('');
  $('loginTbl').tBodies[0].innerHTML = x.logins.map(l => `<tr><td>${when(l.created_at)}</td><td>${esc(l.email)}</td><td class="mono">${esc(l.detail || '')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">None yet</td></tr>';
}
function showCodes(codes) { $('tfaCodeList').textContent = codes.join('\n'); $('tfaCodes').hidden = false; $('tfaCodes').scrollIntoView({ block: 'nearest' }) }
$('tfaStart').onclick = async () => {
  const r = await api('/2fa/setup', {});
  $('tfaQr').src = r.qr; $('tfaSecret').textContent = r.secret; $('tfaSetup').hidden = false; $('tfaStart').hidden = true; $('tfaCode').focus();
};
$('tfaForm').addEventListener('submit', async e => {
  e.preventDefault(); $('tfaMsg').textContent = '';
  try { const r = await api('/2fa/enable', { code: $('tfaCode').value }); $('tfaCode').value = ''; await loadSecurity(); showCodes(r.codes); toast('2-step login is on.') }
  catch (err) { $('tfaMsg').textContent = err.message; $('tfaMsg').className = 'msg bad' }
});
$('tfaNewCodes').onclick = async () => {
  const code = prompt('Type the 6-digit code from your authenticator app to make new backup codes. Your old backup codes will stop working.'); if (!code) return;
  try { const r = await api('/2fa/backup-codes', { code }); await loadSecurity(); showCodes(r.codes) } catch (err) { toast(err.message, true) }
};
$('tfaOffBtn').onclick = async () => {
  if (!confirm('Turn off 2-step login? Your account will be protected by the password only.')) return;
  const password = prompt('Type your password:'); if (!password) return;
  const code = prompt('Type the 6-digit code from your authenticator app (or a backup code):'); if (!code) return;
  try { await api('/2fa/disable', { password, code }); $('tfaCodes').hidden = true; await loadSecurity(); toast('2-step login is off.') } catch (err) { toast(err.message, true) }
};
$('tfaCopy').onclick = async () => { try { await navigator.clipboard.writeText($('tfaCodeList').textContent); toast('Copied.') } catch (e) { toast('Select the codes and copy them.', true) } };
$('alertSave').onclick = async () => {
  const f = $('alertForm');
  try { await api('/settings', { alert_admin: f.alert_admin.checked, alert_email: f.alert_email.value }, 'PUT'); $('alertMsg').textContent = 'Saved.'; $('alertMsg').className = 'msg ok'; loadSecurity() }
  catch (err) { $('alertMsg').textContent = err.message; $('alertMsg').className = 'msg bad' }
};
$('alertTest').onclick = async () => {
  try { const r = await api('/alerts/test', {}); $('alertMsg').textContent = 'Sent to ' + r.to + '. Check your inbox (and spam folder).'; $('alertMsg').className = 'msg ok' }
  catch (err) { $('alertMsg').textContent = err.message; $('alertMsg').className = 'msg bad' }
};
