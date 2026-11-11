/* =====================================================================
   AK Smarts PDF add-on: accounts, licensing, free (guest) access,
   usage counting, e-Sign / DSC signing, signed-document lock,
   desktop/PWA file opening.
   The main app code arrives encrypted; it is unlocked only with the key
   the server gives to people who are allowed in.
   ===================================================================== */
(() => {
'use strict';
// small helpers (the main app has the same ones, but it may not be unlocked yet)
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function setMsg(id, t, c) { const m = $(id); m.textContent = t || ''; m.className = 'msg' + (c ? ' ' + c : '') }
let toastT2 = 0;
function toast(t, bad) { const el = $('toast'); el.textContent = t; el.className = 'on' + (bad ? ' bad' : ''); clearTimeout(toastT2); toastT2 = setTimeout(() => el.className = '', 4200) }
let MAIN = typeof TOOLS !== 'undefined'; // true when the page was built without encryption
const PRE = new Set();
function need(...ns) {
  if (MAIN) return window.need(...ns);
  for (const n of ns) { if (PRE.has(n)) continue; const s = document.createElement('script'); s.textContent = $('lib-' + n).textContent; document.head.appendChild(s); PRE.add(n) }
}

const TOKEN_KEY = (document.querySelector('meta[name="pt-token-key"]') || {}).content || ''; // filled in by the server
const LS = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} }, del(k) { try { localStorage.removeItem(k) } catch (e) {} } };
const rnd = () => Math.random().toString(36).slice(2, 12);
const DEVICE = LS.get('pt-device') || (() => { const id = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : rnd() + '-' + rnd() + '-' + rnd(); LS.set('pt-device', id); return id })();
let ME = null, LIC = null, SET = {}, OFFLINE = false, READY = false, GUEST_OK = false;
// tool pages such as /compress-pdf open that tool straight away
const START_TOOL = (document.querySelector('meta[name="pt-start-tool"]') || {}).content || '';
const START_TITLE = document.title;
const START_NAME = (document.querySelector('meta[name="pt-start-name"]') || {}).content || '';
const START_DESC = (document.querySelector('meta[name="pt-start-desc"]') || {}).content || '';
if (START_TOOL && !location.hash) history.replaceState(null, '', location.pathname + location.search + '#' + START_TOOL);
window.addEventListener('hashchange', () => fixTitle());
const PENDING = [];
const Cms = () => { need('forge'); return PdfCms(forge) };

/* ---------- server calls ---------- */
async function api(path, body, method) {
  let r;
  try {
    r = await fetch(path, { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin', cache: 'no-store', headers: Object.assign({ 'x-pt': '1' }, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  } catch (e) { const err = new Error('Can’t reach the server. Check your internet connection.'); err.offline = true; throw err }
  let j = {}; try { j = await r.json() } catch (e) {}
  if (!r.ok) { const e = new Error(j.error || `Server error (${r.status}).`); e.status = r.status; e.field = j.field; e.data = j; throw e }
  return j;
}
// counts usage for the owner's statistics: what was done, never file names or contents
function track(kind, tool) {
  if (OFFLINE) return;
  try { fetch('/api/track', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'x-pt': '1', 'content-type': 'application/json' }, body: JSON.stringify({ device: DEVICE, kind, tool: tool || null }) }).catch(() => {}) } catch (e) {}
}

/* ---------- unlocking the main app ---------- */
const hexBytes = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const binStr = u => { let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return s };
async function startMain(keyHex) {
  if (MAIN) return;
  const el = $('pt-main-enc');
  if (!el) throw new Error('app code missing');
  if (!/^[0-9a-f]{64}$/.test(keyHex || '')) throw new Error('no key');
  const raw = Uint8Array.from(atob(el.textContent.trim()), c => c.charCodeAt(0)), iv = raw.subarray(0, 12), data = raw.subarray(12);
  let code;
  if (self.crypto && crypto.subtle) {
    const k = await crypto.subtle.importKey('raw', hexBytes(keyHex), 'AES-GCM', false, ['decrypt']);
    code = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, data));
  } else {
    need('forge');
    const d = forge.cipher.createDecipher('AES-GCM', forge.util.hexToBytes(keyHex));
    d.start({ iv: binStr(iv), tag: forge.util.createBuffer(binStr(data.subarray(data.length - 16))) });
    d.update(forge.util.createBuffer(binStr(data.subarray(0, data.length - 16))));
    if (!d.finish()) throw new Error('bad key');
    code = forge.util.decodeUtf8(d.output.getBytes());
  }
  const s = document.createElement('script'); s.id = 'pt-main'; s.textContent = code; document.body.appendChild(s);
  el.remove();
  if (typeof TOOLS === 'undefined') throw new Error('app code did not start');
  MAIN = true;
  wireMain();
}

/* ---------- offline licence token (signed by the server, checked here) ---------- */
const b64uBytes = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)) };
function cachedToken(key = 'pt-lic') {
  const tok = LS.get(key);
  if (!tok || !/^[0-9a-f]{64}$/.test(TOKEN_KEY)) return null;
  try {
    const [body, sig] = tok.split('.');
    need('forge');
    if (!forge.ed25519.verify({ message: body, encoding: 'utf8', signature: b64uBytes(sig), publicKey: hexBytes(TOKEN_KEY) })) return null;
    const p = JSON.parse(new TextDecoder().decode(b64uBytes(body)));
    if (!(p.exp > Date.now()) || (p.dev && p.dev !== DEVICE)) return null;
    return p;
  } catch (e) { return null }
}

/* ---------- gate (log in / sign up / trial ended) ---------- */
document.body.classList.add('gated');
const gviews = { login: 'gLogin', tfa: 'gTfa', signup: 'gSignup', otp: 'gOtp', ended: 'gEnded', wait: 'gWait' };
function gateView(v, text, retry) {
  document.body.classList.add('gated');
  // while starting, a plain splash shows instead of the sign-in screen (no flash of the log in page)
  document.body.classList.toggle('booting', v === 'wait' && !retry);
  for (const [k, id] of Object.entries(gviews)) $(id).hidden = k !== v;
  $('gCard').querySelector('.g-tabs').hidden = !(v === 'login' || v === 'signup');
  $('gTabLogin').setAttribute('aria-selected', v === 'login'); $('gTabSignup').setAttribute('aria-selected', v === 'signup');
  $('gateTitle').textContent = { login: 'Log in', tfa: '2-step login', signup: 'Create account', otp: 'Reset password', ended: 'Licence needed', wait: 'Please wait' }[v];
  showOtpOptions();
  $('gGuestRow').hidden = !(GUEST_OK && MAIN && (v === 'login' || v === 'signup'));
  if (v === 'wait') { $('gWaitText').textContent = text || 'Checking your licence…'; $('gWaitMsg').textContent = ''; $('gRetry').hidden = !retry; gNote('') }
  if (v === 'ended') {
    const r = LIC && LIC.reason;
    $('gEndTitle').textContent = r === 'trial_cancelled' ? 'Your free trial was cancelled' : r === 'revoked' ? 'Your licence was revoked' : r === 'trial_expired' ? 'Your free trial has ended' : r === 'expired' ? 'Your licence has expired' : 'You need a licence';
    $('gEndText').textContent = 'Buy a licence to keep using the app, or enter a licence key you already have.';
  }
  const f = $(gviews[v]).querySelector('input:not([type=checkbox])'); if (f) setTimeout(() => f.focus(), 50);
}
function gNote(t) { $('gNote').textContent = t || ''; $('gNote').hidden = !t }
const GUEST_REASON = {
  guest_off: 'The free period has ended. Create a free account (or log in) to keep using the app.',
  guest_expired: 'Your free access on this computer has ended. Create a free account (or log in) to continue.',
  guest_ended: 'Your free access on this computer has ended. Create a free account (or log in) to continue.',
  blocked: 'This computer has been blocked. Please contact the administrator.'
};
function hideGate() { document.body.classList.remove('gated', 'booting') }
document.querySelectorAll('[data-gt]').forEach(b => b.onclick = () => gateView(b.dataset.gt));
document.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const i = $(b.dataset.eye), show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password') });
$('gRetry').onclick = () => boot();
$('gGuest').onclick = () => { gNote(''); hideGate() };
function askAccount(note) { gNote(note || ''); gateView('signup') }

function formErr(msgId, e, form) {
  setMsg(msgId, e.message, 'bad');
  form.querySelectorAll('.inp').forEach(i => i.classList.remove('err'));
  if (e.field) { const i = form.querySelector(`[name="${e.field}"]`); if (i) { i.classList.add('err'); i.focus() } }
}
$('gLogin').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, btn = f.querySelector('[type=submit]');
  setMsg('liMsg', ''); btn.disabled = true;
  try {
    const r = await api('/api/auth/login', { email: $('liEmail').value, password: $('liPw').value, device: DEVICE });
    $('liPw').value = '';
    if (r.need2fa) { TFA_TICKET = r.ticket; setMsg('tfMsg', ''); $('tfCode').value = ''; gNote(''); gateView('tfa'); return }
    if (r.needOtp) { otpStart('login2'); otpSent(r); return }
    await accept(r); LS.set('pt-had-account', '1'); gNote('')
  }
  catch (err) { formErr('liMsg', err, f) } finally { btn.disabled = false }
});
// second step: the code from the authenticator app (or a backup code)
let TFA_TICKET = null;
$('gTfa').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, btn = f.querySelector('[type=submit]');
  setMsg('tfMsg', ''); btn.disabled = true;
  try { await accept(await api('/api/auth/2fa', { ticket: TFA_TICKET, code: $('tfCode').value, device: DEVICE })); TFA_TICKET = null; LS.set('pt-had-account', '1'); gNote('') }
  catch (err) { if (err.data && err.data.restart) { gateView('login'); setMsg('liMsg', err.message, 'bad') } else { formErr('tfMsg', err, f); $('tfCode').select() } }
  finally { btn.disabled = false }
});
$('tfBack').onclick = () => { TFA_TICKET = null; gateView('login') };
// one-time codes by email or text message: confirm a mobile number at sign-up, 2-step login, forgotten password
const OT = { mode: 'reset', ticket: null, timer: 0 };
const OT_BACK = { signup2: 'signup' };
function showOtpOptions() {
  const on = !!(SET.otp_email || SET.otp_sms);
  $('gForgotBtn').hidden = !on; $('gForgot').hidden = on;
  $('suEmailLbl').textContent = 'Email or mobile number';
  $('suEmail').placeholder = 'you@example.com or 98765 43210';
}
function otpStart(mode) {
  OT.mode = mode; OT.ticket = null;
  $('otToLbl').textContent = 'Your account’s email or mobile number';
  $('otTo').placeholder = 'you@example.com or 98765 43210';
  $('otTo').inputMode = 'email';
  $('otLead').textContent = 'Forgot your password? Type your email or mobile number. We’ll email you a 6-digit code so you can set a new password.';
  $('otStep1').hidden = false; $('otStep2').hidden = true; $('otNew').hidden = true; $('otPwRow').hidden = true; $('otResend').hidden = true;
  $('otBtn').textContent = 'Send code'; $('otCode').value = ''; $('otPw').value = ''; setMsg('otMsg', '');
  if (!$('otTo').value) $('otTo').value = $('liEmail').value || '';
  gNote(''); gateView('otp');
}
function otpSent(r) {
  OT.ticket = r.ticket;
  const how = `${r.channel === 'sms' ? 'by text message' : 'by email'} to ${r.sentTo}`;
  $('otStep1').hidden = true; $('otStep2').hidden = false; $('otNew').hidden = true; $('otPwRow').hidden = OT.mode !== 'reset';
  $('otSent').textContent = OT.mode === 'login2' ? `2-step login: we sent a 6-digit code ${how}. Type it to finish logging in.`
    : OT.mode === 'signup2' ? `Confirm your mobile number: we sent a 6-digit code ${how}. Type it to finish creating your account.`
    : `We sent a 6-digit code ${how}. Type it and choose a new password.`;
  $('otBtn').textContent = OT.mode === 'login2' ? 'Log in' : OT.mode === 'signup2' ? 'Create account' : 'Set new password and log in';
  $('gateTitle').textContent = OT.mode === 'login2' ? '2-step login' : OT.mode === 'signup2' ? 'Confirm your mobile number' : 'Reset password';
  $('otCode').value = ''; setTimeout(() => $('otCode').focus(), 50);
  otpResendTimer(30);
}
function otpResendTimer(sec) {
  clearInterval(OT.timer); const b = $('otResend'); b.hidden = false; b.disabled = true;
  const tick = () => { if (sec <= 0) { clearInterval(OT.timer); b.disabled = false; b.textContent = 'Send a new code'; return } b.textContent = `Send a new code (${sec--}s)` };
  tick(); OT.timer = setInterval(tick, 1000);
}
// when a code has expired: go back to the form the person started from
function otpRestart(msg) {
  const back = OT.mode === 'login2' ? 'login' : OT_BACK[OT.mode];
  if (back) { clearInterval(OT.timer); OT.ticket = null; gateView(back); setMsg(back === 'login' ? 'liMsg' : 'suMsg', msg, 'bad'); return true }
  otpStart('reset'); setMsg('otMsg', msg, 'bad'); return true;
}
$('gForgotBtn').onclick = () => otpStart('reset');
['otCode', 'otPw'].forEach(id => $(id).addEventListener('input', () => { setMsg('otMsg', ''); $(id).classList.remove('err') }));
$('otBack').onclick = () => { clearInterval(OT.timer); OT.ticket = null; gateView(OT_BACK[OT.mode] || 'login') };
$('otResend').onclick = async () => {
  setMsg('otMsg', '');
  try { await api('/api/auth/otp/resend', { ticket: OT.ticket }); setMsg('otMsg', 'A new code is on its way.', 'ok'); otpResendTimer(30) }
  catch (err) { if (err.data && err.data.restart) otpRestart(err.message); else setMsg('otMsg', err.message, 'bad') }
};
$('gOtp').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, btn = $('otBtn');
  setMsg('otMsg', ''); btn.disabled = true;
  try {
    if (!OT.ticket) { otpSent(await api('/api/auth/otp/send', { to: $('otTo').value, purpose: 'reset', device: DEVICE, website: $('otWeb').value })); return }
    const r = await api('/api/auth/otp/verify', { ticket: OT.ticket, code: $('otCode').value, password: OT.mode === 'reset' ? $('otPw').value : undefined, device: DEVICE });
    clearInterval(OT.timer); OT.ticket = null; $('otPw').value = '';
    if (r.need2fa) { TFA_TICKET = r.ticket; setMsg('tfMsg', ''); $('tfCode').value = ''; gateView('tfa'); return }
    LS.set('pt-had-account', '1'); gNote('');
    await accept(r);
    if (OT.mode === 'reset') toast('Your new password is set. You’re logged in.');
    else if (r.created) toast(r.notice ? r.notice + ' You can still use the free reader.' : r.license && r.license.plan === 'trial' ? `Welcome! Your ${r.license.days_left}-day free trial has started.` : 'Welcome! Your account is ready.');
  } catch (err) {
    if (err.data && err.data.restart) { otpRestart(err.message); return }
    formErr('otMsg', err, f); if (err.field === 'code') $('otCode').select();
  } finally { btn.disabled = false }
});
$('gSignup').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, btn = $('suBtn');
  if (!$('suAgree').checked) { setMsg('suMsg', 'Please accept the Terms & Conditions and Privacy Policy.', 'bad'); return }
  setMsg('suMsg', ''); btn.disabled = true;
  try {
    const r = await api('/api/auth/signup', { name: $('suName').value, email: $('suEmail').value, password: $('suPw').value, device: DEVICE, website: $('suWeb').value, agree: $('suAgree').checked });
    $('suPw').value = '';
    if (r.needOtp) { otpStart('signup2'); otpSent(r); return }
    LS.set('pt-had-account', '1'); gNote('');
    await accept(r);
    if (r.notice) toast(r.notice + ' You can still use the free reader.');
    else if (r.license && r.license.plan === 'promo') toast('Welcome! Everything is free for you right now.');
    else if (r.license && r.license.plan === 'trial') toast(`Welcome! Your ${r.license.days_left}-day free trial has started.`);
  } catch (err) { formErr('suMsg', err, f) } finally { btn.disabled = false }
});
async function activateKey(input, msgId) {
  const key = $(input).value.trim();
  if (!key) { setMsg(msgId, 'Type your licence key first.', 'bad'); return }
  setMsg(msgId, 'Checking…');
  try { await accept(await api('/api/license/activate', { key })); $(input).value = ''; setMsg(msgId, 'Licence activated. Thank you!', 'ok'); toast('Licence activated.') }
  catch (e) { setMsg(msgId, e.message, 'bad') }
}
$('gKeyBtn').onclick = () => activateKey('gKey', 'gKeyMsg');
$('gKey').addEventListener('keydown', e => { if (e.key === 'Enter') activateKey('gKey', 'gKeyMsg') });
async function logout() { try { await api('/api/auth/logout', {}) } catch (e) {} LS.del('pt-lic'); LS.del('pt-ak'); LS.del('pt-qs'); LS.del('pt-qk'); location.reload() }
$('gLogout2').onclick = logout;

try {
  const sub = document.querySelector('.hero .sub'); if (sub) sub.textContent = 'A complete PDF reader and editor with every tool from merging to OCR, plus e-Sign and DSC signing. Your files are processed on this computer and never uploaded.';
  const hl = document.querySelector('.hero h1 .hl'); if (hl) hl.textContent = 'Private and secure.';
} catch (e) {}

/* ---------- settings from the server ---------- */
function applySettings(s) {
  if (!s) return; SET = s; LS.set('pt-settings', JSON.stringify(s));
  const name = s.app_name || 'AK Smarts PDF';
  document.querySelectorAll('.g-appname').forEach(x => x.textContent = name);
  const bb = document.querySelector('.brand b'); if (bb) bb.textContent = name;
  $('gTrialNote').textContent = s.guest_mode ? 'Free to use. No payment details needed.' : s.trial_enabled ? `Start with a free ${s.trial_days}-day trial. No payment details needed.` : '';
  $('suLead').textContent = s.guest_mode ? 'Create your free account to keep your files’ history, settings and signatures under your name.' : s.trial_enabled ? `Create your account to start your ${s.trial_days}-day free trial.` : 'Create your account.';
  $('gTabSignup').hidden = !s.signup_open;
  $('gPrice').textContent = s.price_text ? '· Pro licence ' + s.price_text : '';
  $('gForgot').innerHTML = 'Forgot your password? ' + (s.support_email ? `Email <a href="mailto:${esc(s.support_email)}">${esc(s.support_email)}</a> to reset it.` : 'Ask the administrator to reset it.');
  for (const id of ['gBuy', 'licbarBuy', 'acBuy', 'payBuy']) { const a = $(id); a.hidden = !s.buy_url; if (s.buy_url) a.href = s.buy_url }
  $('acPrice').textContent = s.price_text ? '· ' + s.price_text : '';
  fixTitle();
}
// the app sets page titles as you move around; keep the product name in them
function fixTitle() {
  const n = (SET && SET.app_name) || 'AK Smarts PDF', h = location.hash.slice(1);
  // on a tool's own page (e.g. /compress-pdf) keep the page's search-friendly title
  const t = START_TOOL && (h === START_TOOL || !h) ? START_TITLE : !START_TOOL && (!h || h === 'home' || h === 'tools') ? START_TITLE : document.title.replace(/PDF Tools(?! Pro)/, n).replace('PDF Reader & Editor', n);
  if (t !== document.title) document.title = t;
  if (START_NAME && h === START_TOOL) { const tt = document.getElementById('tt'), td = document.getElementById('td'); if (tt && tt.textContent !== START_NAME) tt.textContent = START_NAME; if (td && START_DESC && td.textContent !== START_DESC) td.textContent = START_DESC }
  const si = document.getElementById('seoInfo'); if (si) si.hidden = !(si.dataset.tool ? h === si.dataset.tool : !h || h === 'home' || h === 'tools');
}
try { new MutationObserver(fixTitle).observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true }) } catch (e) {}
try { applySettings(JSON.parse(LS.get('pt-settings') || 'null')) } catch (e) {}

/* ---------- accepting a login, guest access or licence state ---------- */
async function accept(me) {
  ME = me.user; LIC = me.license; OFFLINE = !!me.offline; GUEST_OK = !!me.guest;
  if (me.guest) LS.set('pt-was-guest', '1');
  if (me.settings) applySettings(me.settings);
  if (me.token) LS.set('pt-lic', me.token);
  if (!me.offline && !me.quickStart) { if (me.quick && me.appKey) { LS.set('pt-qs', me.quick); LS.set('pt-qk', me.appKey) } else { LS.del('pt-qs'); LS.del('pt-qk') } }
  if (me.appKey && SET.offline_days > 0) LS.set('pt-ak', me.appKey); else if (!OFFLINE && !me.quickStart) LS.del('pt-ak');
  if (!LIC.active && LIC.mode === 'block') { READY = false; gateView('ended'); updateUI(); return }
  if (!MAIN) {
    try { await startMain(me.appKey) }
    catch (e) {
      console.error(e);
      // an older saved copy of the page (from before an update): drop it and load the new one, once
      if (!SS_get('pt-fresh')) { SS_set('pt-fresh', '1'); try { const ks = await caches.keys(); await Promise.all(ks.filter(k => k.startsWith('pdftools-')).map(k => caches.open(k).then(c => c.delete('/')))) } catch (x) {} location.reload(); return }
      gateView('wait', 'The app couldn’t start.', true); $('gWaitMsg').textContent = 'Please reload the page. If this keeps happening, clear the browser cache for this site.'; $('gWaitMsg').className = 'msg warn'; return }
  }
  SS_set('pt-fresh', '');
  hideGate(); READY = true; updateUI();
  openWaiting();
  takeHandoff();
  if (/[?&]signin=1/.test(location.search)) { history.replaceState(null, '', location.pathname + location.hash); if (ME && ME.guest) { gNote(''); gateView('login') } }
}
const SS_get = k => { try { return sessionStorage.getItem(k) } catch (e) { return null } };
const SS_set = (k, v) => { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k) } catch (e) {} };
const fromToken = (t, ak) => ({ user: { id: t.uid, email: t.email, name: t.name, role: t.role, guest: t.role === 'guest' }, license: t.lic, offline: true, appKey: ak });
async function boot() {
  gateView('wait', 'Starting…');
  const hello = api('/api/hello', { device: DEVICE });
  // used on this device before: if the server is slow to answer (for example a free server waking up),
  // open straight away and finish the licence check in the background
  const tq = cachedToken('pt-qs'), qk = LS.get('pt-qk');
  if (tq && qk) {
    const slow = await Promise.race([hello.then(() => false, () => false), new Promise(r => setTimeout(() => r(true), 2500))]);
    if (slow) {
      await accept(Object.assign(fromToken(tq, qk), { offline: false, quickStart: true }));
      hello.then(me => accept(me), e => {
        if (e.status === 401) { recheck(); return }
        const t = cachedToken(), ak = LS.get('pt-ak');
        if (t && ak) { OFFLINE = true; updateUI(); toast('Working offline. Your access will be checked again when you’re back online.'); return }
        READY = false; gateView('wait', 'Can’t reach the server.', true); $('gWaitMsg').textContent = e.message + ' The app needs the internet to start.'; $('gWaitMsg').className = 'msg warn';
      });
      return;
    }
  }
  try { await accept(await hello) }
  catch (e) {
    if (e.status === 401) {
      if (e.data && e.data.settings) applySettings(e.data.settings);
      gNote(e.data && GUEST_REASON[e.data.reason] && (LS.get('pt-was-guest') || e.data.reason === 'blocked') ? GUEST_REASON[e.data.reason] : '');
      gateView(LS.get('pt-had-account') ? 'login' : (SET.signup_open === false ? 'login' : 'signup')); return
    }
    const t = cachedToken(), ak = LS.get('pt-ak');
    if (t && ak) { await accept(fromToken(t, ak)); toast('Working offline. Your access will be checked again when you’re back online.'); return }
    gateView('wait', 'Can’t reach the server.', true); $('gWaitMsg').textContent = e.message + ' The app needs the internet to start.'; $('gWaitMsg').className = 'msg warn';
  }
}
let lastCheck = Date.now();
async function recheck() {
  if (!ME) return; lastCheck = Date.now();
  try { const was = LIC && LIC.active; await accept(await api('/api/hello', { device: DEVICE })); if (was && !LIC.active) toast(ME.guest ? 'Free access is now limited to reading.' : 'Your licence is no longer active. The app is now in reader mode.', true) }
  catch (e) {
    if (e.status !== 401) return;
    if (ME.guest) { GUEST_OK = false; READY = false; LS.del('pt-lic'); LS.del('pt-ak'); LS.del('pt-qs'); LS.del('pt-qk'); askAccount(GUEST_REASON[e.data && e.data.reason] || GUEST_REASON.guest_off); $('gGuestRow').hidden = true }
    else { LS.del('pt-lic'); LS.del('pt-qs'); LS.del('pt-qk'); location.reload() }
  }
}
setInterval(recheck, 5 * 60e3);
window.addEventListener('focus', () => { if (Date.now() - lastCheck > 60e3) recheck() });

/* ---------- header: account button, install button, licence bar ---------- */
const hdr = document.querySelector('.hdr-r');
hdr.insertAdjacentHTML('afterbegin', `<button class="iconbtn" id="installBtn" type="button" hidden aria-label="Install as an app" title="Install as an app"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></svg></button><button class="acbtn" id="acbtn" type="button" aria-label="Your account"><span class="av"></span><span class="pl"></span></button>`);
hdr.appendChild($('acbtn')); // the account / Sign in button sits at the right end of the header
document.querySelector('header.app').after($('licbar'));
$('ribbon').after($('sigbar'));
const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
// users never see a "free until" date; it is shown only in the admin console
const planLabel = l => /^Free until /.test(String(l || '')) ? 'Free access' : String(l || '');
const USER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
function updateUI() {
  if (!ME || !LIC) return;
  try { adsCheck() } catch (e) { console.warn(e) }
  const acb = $('acbtn'); acb.classList.toggle('guest', !!ME.guest);
  if (ME.guest) acb.querySelector('.av').innerHTML = USER_ICON; else acb.querySelector('.av').textContent = initials(ME.name);
  acb.querySelector('.pl').textContent = ME.guest ? 'Sign in' : String(ME.name || '').split(/\s+/)[0] + (OFFLINE ? ' · offline' : '');
  acb.setAttribute('aria-label', ME.guest ? 'Sign in' : 'Your account'); acb.title = ME.guest ? 'Sign in or create a free account' : ME.name + ' · ' + planLabel(LIC.label);
  const bar = $('licbar');
  $('licbarSignup').hidden = true;
  // no banner for visitors without an account and no "free until" notice for anyone
  if (ME.guest) { bar.hidden = true; if (MAIN) { drawGrid(); if (!$('ws').hidden) drawRibbon() } return }
  $('licbarBuy').hidden = !SET.buy_url;
  if (LIC.plan === 'promo') bar.hidden = true;
  else if (LIC.plan === 'trial') { bar.className = 'trial'; $('licbarText').textContent = `Free trial: ${LIC.days_left} day${LIC.days_left === 1 ? '' : 's'} left.`; bar.hidden = false }
  else if (!LIC.active) { bar.className = 'ended'; $('licbarText').textContent = `${LIC.label}. The app is in free reader mode.`; bar.hidden = false }
  else bar.hidden = true;
  $('licbarKey').hidden = LIC.active && LIC.plan !== 'trial' && LIC.plan !== 'promo';
  // account dialog
  $('acAv').textContent = initials(ME.name); $('acName').textContent = ME.name; $('acEmail').textContent = ME.email || (ME.phone || '').replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2');
  $('acBadge').textContent = LIC.plan === 'admin' ? 'Owner' : LIC.plan === 'paid' ? 'Pro' : LIC.plan === 'trial' ? 'Trial' : LIC.plan === 'promo' ? 'Free' : 'Free reader';
  $('acBadge').className = 'ac-badge' + (LIC.active ? '' : ' bad');
  $('acPlanText').textContent = LIC.plan === 'admin' ? 'Full access as the administrator.' : planLabel(LIC.label) + (LIC.active ? '' : ' · reader mode only');
  $('acAdmin').hidden = ME.role !== 'admin';
  if (MAIN) { drawGrid(); if (!$('ws').hidden) drawRibbon() }
}
$('licbarSignup').onclick = () => askAccount('Create a free account to keep your access when the free period ends.');
$('acbtn').onclick = () => { if (ME && ME.guest) { gNote(''); gateView('login'); return } setMsg('acKeyMsg', ''); setMsg('acPwMsg', ''); $('acctdlg').showModal(); $('acTfaSetup').hidden = true; $('acTfaCodes').hidden = true; setMsg('acTfaMsg', ''); setMsg('acCtMsg', ''); loadSecurity() };
// mobile number, email and login codes
let ACSEC = null;
const fmtPhone = p => String(p || '').replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2');
async function loadSecurity() {
  $('acSecBox').hidden = $('acTfaBox').hidden = true;
  try { ACSEC = await api('/api/account/security') } catch (e) { return }
  $('acSecBox').hidden = $('acTfaBox').hidden = false;
  drawSecurity();
}
function drawSecurity() {
  const s = ACSEC; if (!s) return;
  const bits = [s.phone ? `Mobile: ${fmtPhone(s.phone)}.` : 'No mobile number yet.', s.email ? `Email: ${s.email}.` : 'No email yet.'];
  $('acSecInfo').textContent = bits.join(' ') + (s.email ? ' Add or change your mobile number below. You can then log in with it.' : ' Add a mobile number or an email below. With an email, you can reset a forgotten password yourself.');
  $('acCtTo').placeholder = s.email ? 'Mobile number, e.g. 98765 43210' : 'Mobile number or email';
  // 2-step login with an authenticator app
  $('acTfaSum').textContent = '2-step login (Google Authenticator)' + (s.totp_on ? ' · On' : '');
  $('acTfaInfo').textContent = s.totp_on ? `2-step login is on. When you log in, type your password and then the 6-digit code from your authenticator app. ${s.backup_left} backup code${s.backup_left === 1 ? '' : 's'} left.`
    : !s.has_password ? 'Set a password first (below), then turn on 2-step login.'
    : 'Turn on 2-step login so nobody can get in with your password alone. After your password, you type a 6-digit code from the free Google Authenticator app on your phone. No text messages.';
  $('acTfaOff').hidden = s.totp_on || !s.has_password || !$('acTfaSetup').hidden;
  $('acTfaOnBox').hidden = !s.totp_on;
  $('acPwSum').textContent = s.has_password ? (s.reset_ok ? 'Set a new password' : 'Change password') : 'Set a password';
  $('acOld').hidden = !s.has_password || s.reset_ok;
}
$('acCtForm').addEventListener('submit', async e => {
  e.preventDefault(); setMsg('acCtMsg', '');
  try { const r = await api('/api/account/contact', { to: $('acCtTo').value, password: $('acCtPw').value }); $('acCtPw').value = ''; $('acCtTo').value = ''; ACSEC = r.security; await accept(r); drawSecurity(); setMsg('acCtMsg', 'Saved. You can now log in with it.', 'ok') }
  catch (err) { setMsg('acCtMsg', err.message, 'bad') }
});
const showBackup = codes => { $('acTfaList').textContent = codes.join('\n'); $('acTfaCodes').hidden = false; $('acTfaCodes').scrollIntoView({ block: 'nearest' }) };
$('acTfaStart').onclick = async () => {
  setMsg('acTfaMsg', '');
  try { const r = await api('/api/account/2fa/setup', {}); $('acTfaQr').src = r.qr; $('acTfaKey').textContent = r.secret; $('acTfaSetup').hidden = false; $('acTfaOff').hidden = true; $('acTfaCode').value = ''; $('acTfaCode').focus() }
  catch (err) { setMsg('acTfaMsg', err.message, 'bad') }
};
const tfaOn = async () => {
  setMsg('acTfaMsg', '');
  try { const r = await api('/api/account/2fa/enable', { code: $('acTfaCode').value }); $('acTfaSetup').hidden = true; ACSEC = r.security; drawSecurity(); showBackup(r.codes); setMsg('acTfaMsg', '2-step login is on. Other devices were logged out.', 'ok') }
  catch (err) { setMsg('acTfaMsg', err.message, 'bad'); $('acTfaCode').select() }
};
$('acTfaOn').onclick = tfaOn;
['acTfaCode', 'acTfaCode2', 'acTfaPw'].forEach(id => $(id).addEventListener('input', () => setMsg('acTfaMsg', '')));
['acCtTo', 'acCtPw'].forEach(id => $(id).addEventListener('input', () => setMsg('acCtMsg', '')));
$('acTfaCode').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tfaOn() } });
$('acTfaNew').onclick = async () => {
  setMsg('acTfaMsg', '');
  if (!$('acTfaCode2').value.trim()) { setMsg('acTfaMsg', 'Type the code from your authenticator app first.', 'bad'); $('acTfaCode2').focus(); return }
  try { const r = await api('/api/account/2fa/backup-codes', { code: $('acTfaCode2').value }); $('acTfaCode2').value = ''; ACSEC = r.security; drawSecurity(); showBackup(r.codes); setMsg('acTfaMsg', 'New backup codes made. The old ones no longer work.', 'ok') }
  catch (err) { setMsg('acTfaMsg', err.message, 'bad') }
};
$('acTfaOffBtn').onclick = async () => {
  setMsg('acTfaMsg', '');
  if (!$('acTfaCode2').value.trim() || !$('acTfaPw').value) { setMsg('acTfaMsg', 'To turn it off, type a code from the app and your password.', 'bad'); return }
  try { const r = await api('/api/account/2fa/disable', { code: $('acTfaCode2').value, password: $('acTfaPw').value }); $('acTfaCode2').value = $('acTfaPw').value = ''; $('acTfaCodes').hidden = true; ACSEC = r.security; drawSecurity(); setMsg('acTfaMsg', '2-step login is off.', 'ok') }
  catch (err) { setMsg('acTfaMsg', err.message, 'bad') }
};
$('acTfaCopy').onclick = async () => { try { await navigator.clipboard.writeText($('acTfaList').textContent); toast('Copied.') } catch (e) { toast('Select the codes and copy them.', true) } };
$('acClose').onclick = () => $('acctdlg').close();
$('acLogout').onclick = logout;
$('acKeyBtn').onclick = () => activateKey('acKey', 'acKeyMsg');
$('acKey').addEventListener('keydown', e => { if (e.key === 'Enter') activateKey('acKey', 'acKeyMsg') });
$('licbarKey').onclick = () => { $('acctdlg').showModal(); $('acKey').focus() };
$('acPwForm').addEventListener('submit', async e => {
  e.preventDefault();
  try { await api('/api/account/password', { old: $('acOld').value, password: $('acNew').value }); $('acOld').value = $('acNew').value = ''; setMsg('acPwMsg', ACSEC && !ACSEC.has_password ? 'Password set.' : 'Password changed. Other devices were signed out.', 'ok'); if (ACSEC) { ACSEC.has_password = true; ACSEC.reset_ok = false; drawSecurity() } }
  catch (err) { setMsg('acPwMsg', err.message, 'bad') }
});
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('installBtn').hidden = false });
$('installBtn').onclick = async () => { if (!installEvt) return; installEvt.prompt(); const r = await installEvt.userChoice; if (r.outcome === 'accepted') { $('installBtn').hidden = true; toast('Installed. PDFs can now open straight in the app (choose it under “Open with”).') } installEvt = null };
window.addEventListener('appinstalled', () => { $('installBtn').hidden = true });

/* ---------- licence gating ---------- */
const FREE_TOOLS = new Set(['read', 'verify']);
const toolAllowed = id => !!(LIC && LIC.active) || FREE_TOOLS.has(id);
function showPay(what) {
  if (ME && ME.guest) { askAccount(`${what || 'This tool'} needs a free account. Create one to start your free trial.`); return }
  const r = LIC && LIC.reason;
  $('payH').textContent = what ? `${what} is a Pro feature` : 'This is a Pro feature';
  $('payText').textContent = (r === 'trial_cancelled' ? 'Your free trial was cancelled' : r === 'revoked' ? 'Your licence was revoked' : r === 'trial_expired' ? 'Your free trial has ended' : r === 'expired' ? 'Your licence has expired' : 'You don’t have a licence yet') + ', so the app works as a free PDF reader. Buy a licence or enter a licence key to edit, convert and sign PDFs.';
  $('paydlg').showModal();
}
$('payClose').onclick = () => $('paydlg').close();
$('payKey').onclick = () => { $('paydlg').close(); $('acctdlg').showModal(); $('acKey').focus() };
document.addEventListener('click', e => {
  const a = e.target.closest('a.card[href^="#"]'); if (!a) return;
  const id = a.getAttribute('href').slice(1);
  if (!toolAllowed(id)) { e.preventDefault(); e.stopPropagation(); showPay(TOOLS[id] && TOOLS[id].n) }
}, true);
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (MAIN && TOOLS[id] && !toolAllowed(id)) { location.hash = 'tools'; showPay(TOOLS[id].n) } });

/* ---------- read-only modes: no licence, or a signed document ---------- */
const RO_OK = new Set(['open', 'save', 'saveas', 'print', 'zoomin', 'zoomout', 'fitw', 'fitp', 'two', 'night', 'full', 'find', 'props', 't:select', 't:hand', 'sigver']);
const OUT_OK = new Set(['x:pdf2word', 'x:pdf2ppt', 'x:excel', 'x:pdf2jpg', 'x:text']);
const isSigned = d => !!(d && d.sig && d.sig.list.length);
function roReason() { if (!LIC || !LIC.active) return 'license'; if (isSigned(D)) return 'signed'; return null }
function actionAllowed(a) { const r = roReason(); return !r || RO_OK.has(a) || (r === 'signed' && OUT_OK.has(a)) }
function blocked() {
  if (roReason() === 'license') showPay();
  else toast('This PDF is signed and locked. Changing it would break the signature. Save a copy or convert it instead.', true);
}
$('ribbon').addEventListener('click', e => {
  if (!roReason()) return;
  const t = e.target.closest('[data-rt]');
  if (t && !['home', 'convert'].includes(t.dataset.rt)) { e.preventDefault(); e.stopImmediatePropagation(); blocked(); return }
  const b = e.target.closest('#rbar [data-a]');
  if (b && !actionAllowed(b.dataset.a)) { e.preventDefault(); e.stopImmediatePropagation(); blocked() }
}, true);
function enforceRO() { if (roReason() && !['home', 'convert'].includes(WS.rtab)) setRTab('home'); if (roReason() && !['select', 'hand'].includes(WS.tool)) setTool('select', true); drawRibbon() }


/* ---------- reading signatures in a PDF ---------- */
const latin1 = b => new TextDecoder('latin1').decode(b);
function hasSigQuick(bytes) { try { return /\/ByteRange\s*\[/.test(latin1(bytes)) } catch (e) { return false } }
async function digestHex(alg, parts) {
  if (self.crypto && crypto.subtle) {
    let n = 0; parts.forEach(p => n += p.length); const all = new Uint8Array(n); let o = 0; parts.forEach(p => { all.set(p, o); o += p.length });
    const h = new Uint8Array(await crypto.subtle.digest(alg, all)); return [...h].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  need('forge'); const md = forge.md[alg.replace('-', '').toLowerCase()].create();
  for (const p of parts) for (let i = 0; i < p.length; i += 65536) md.update(forge.util.binary.raw.encode(p.subarray(i, i + 65536)));
  return md.digest().toHex();
}
let CA_CERT;
async function appCA() {
  if (CA_CERT !== undefined) return CA_CERT;
  need('forge');
  let pem = LS.get('pt-ca');
  try { const r = await fetch('/api/esign/ca', { cache: 'no-store' }); if (r.ok) { pem = await r.text(); LS.set('pt-ca', pem) } } catch (e) {}
  try { CA_CERT = pem ? forge.pki.certificateFromPem(pem) : null } catch (e) { CA_CERT = null }
  return CA_CERT;
}
async function inspectPdf(bytes) {
  const txt = latin1(bytes), re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g, list = [];
  const ca = await appCA();
  let m;
  while ((m = re.exec(txt))) {
    const [a, b, c, d] = m.slice(1, 5).map(Number), s = { range: [a, b, c, d] };
    list.push(s);
    if (a !== 0 || b > c || c + d > bytes.length) { s.error = 'The signature’s byte range is damaged.'; continue }
    const hex = txt.slice(b, c).replace(/[<>\s]/g, '');
    if (!/^[0-9a-fA-F]*$/.test(hex) || !hex.replace(/0/g, '')) { s.error = 'This signature field is empty or damaged.'; continue }
    Object.assign(s, Cms().inspect(forge.util.hexToBytes(hex.length % 2 ? hex + '0' : hex)));
    const alg = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }[s.alg];
    if (alg && s.messageDigest) s.intact = (await digestHex(alg, [bytes.subarray(a, a + b), bytes.subarray(c, c + d)])) === s.messageDigest;
    s.wholeFile = c + d === bytes.length;
    s.appIssued = false;
    if (ca && s.cert) s.appIssued = Cms().certSignedBy(s.cert, ca);
  }
  const certified = /\/TransformMethod\s*\/DocMDP/.test(txt);
  const pm = txt.match(/\/TransformParams\s*<<[^>]*?\/P\s+(\d)/);
  return { list, certified, P: certified ? (pm ? +pm[1] : 2) : null };
}
function sigStatus(sig) {
  if (!sig || !sig.list.length) return null;
  if (sig.pending) return { cls: 'warn', ic: '…', text: 'Checking signatures…' };
  const bad = sig.list.find(s => s.error || s.ok === false || s.intact === false);
  if (bad) return { cls: 'bad', ic: '✕', text: bad.intact === false ? 'Signature is INVALID: this document was changed after it was signed.' : 'Signature is INVALID: ' + (bad.error || 'the signature doesn’t match the signer’s certificate.') };
  const last = sig.list[sig.list.length - 1], names = [...new Set(sig.list.map(s => s.signer).filter(Boolean))].join(', ');
  if (!last.wholeFile) return { cls: 'warn', ic: '!', text: `Signed by ${names}, but the document was changed after the last signature.` };
  const lock = sig.certified ? (sig.P === 1 ? ' Certified: no changes allowed.' : ' Certified: only form filling and signing allowed.') : '';
  return { cls: '', ic: '✓', text: `Signed by ${names}. Signature${sig.list.length > 1 ? 's are' : ' is'} valid and the document hasn’t been changed.${lock} This copy is read-only.` };
}
function refreshSigUI() {
  const st = D && sigStatus(D.sig), bar = $('sigbar');
  bar.hidden = !st;
  if (st) { bar.className = st.cls; $('sigbarIc').textContent = st.ic; $('sigbarText').textContent = st.text }
  if (D && !$('ws').hidden) enforceRO();
}
$('sigbarMore').onclick = () => showSigDetails();
const fmtD = d => d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '–';
function showSigDetails() {
  if (!D) return;
  const sig = D.sig;
  if (!sig || !sig.list.length) { $('svList').innerHTML = '<p>This PDF has no digital signatures. Use <b>e-Sign &amp; lock</b> or <b>DSC sign</b> on the Fill &amp; Sign tab to sign it.</p>'; $('svdlg').showModal(); return }
  $('svList').innerHTML = (sig.certified ? `<p class="lbl" style="margin:0 0 10px">🔒 This document is <b>certified</b>${sig.P === 1 ? ' with “no changes allowed”' : ''}.</p>` : '') + sig.list.map((s, i) => {
    const ok = !s.error && s.ok && s.intact !== false, whole = s.wholeFile;
    const trust = s.appIssued ? `<span class="sv-ok">Issued by this app’s e-Sign service (${esc(s.issuer)})</span>` : s.issuer ? `Issued by ${esc(s.issuer)} <span class="lbl">(not checked against a list of trusted authorities)</span>` : '–';
    return `<div class="sv-item"><h4>${ok ? '<span class="sv-ok">✓</span>' : '<span class="sv-bad">✕</span>'} Signature ${i + 1}${s.signer ? ': ' + esc(s.signer) : ''}</h4><dl class="kv">
      <dt>Status</dt><dd>${ok ? (whole ? '<span class="sv-ok">Valid. The document hasn’t been changed since this signature.</span>' : '<span class="sv-warn">Valid, but later changes were added after this signature.</span>') : `<span class="sv-bad">${esc(s.error || (s.intact === false ? 'The document was changed after signing.' : 'The signature doesn’t match the certificate.'))}</span>`}</dd>
      <dt>Signed by</dt><dd>${esc(s.signer || '–')}${s.email ? ' · ' + esc(s.email) : ''}${s.org ? ' · ' + esc(s.org) : ''}</dd>${s.appIssued && /not verified/i.test(s.unit || '') ? '<dt>Identity</dt><dd><span class="sv-warn">Signed without an account. The name was typed by the signer and was not verified.</span></dd>' : ''}
      <dt>Signing time</dt><dd>${fmtD(s.time)}</dd>
      <dt>Certificate</dt><dd>${trust}</dd>
      <dt>Certificate valid</dt><dd>${fmtD(s.certValidFrom)} to ${fmtD(s.certValidTo)}</dd>
      <dt>Algorithm</dt><dd>${esc((s.alg || '').toUpperCase())} with RSA</dd></dl></div>`;
  }).join('');
  $('svdlg').showModal();
}

/* ---------- signing ---------- */
const SIGBYTES = 16384, SIGHEX = SIGBYTES * 2, BRPH = '**********';
function findPlaced() {
  if (!D) return null;
  const s = selObj && selObj();
  if (s && s.t === 'img' && s.kind === 'sig') return { k: WS.sel.k, o: s };
  for (let k = D.pages.length - 1; k >= 0; k--) { const o = [...D.pages[k].objs].reverse().find(o => o.t === 'img' && o.kind === 'sig'); if (o) return { k, o } }
  return null;
}
let DSC = null; // {key, chain, name}
// Checks the chosen file before we try to read it, so people get a clear, kind message instead of a technical error.
// Returns '' when the file looks like a .pfx / .p12, otherwise the message to show.
function pfxProblem(name, u8) {
  const n = String(name || '').toLowerCase();
  const head = binStr(u8.subarray(0, 8));
  if (!u8.length) return 'This file is empty. Choose your DSC file (.pfx or .p12).';
  if (head.startsWith('%PDF') || /\.pdf$/.test(n)) return 'You chose a PDF. This box needs your DSC certificate file, which ends in .pfx or .p12. The PDF you want to sign is already open, so you don’t need to choose it here.';
  if (/\.(cer|crt|pem|der|p7b|p7c)$/.test(n)) return 'This is a public certificate (' + n.slice(n.lastIndexOf('.')) + '). Signing needs the file that also contains your private key: a .pfx or .p12 file.';
  if (/\.(jpe?g|png|gif|webp|docx?|xlsx?|zip|txt)$/.test(n)) return 'This isn’t a certificate file. Choose the file that ends in .pfx or .p12.';
  if (u8.length > 1024 * 1024) return 'This file is too big to be a certificate (' + (u8.length / 1048576).toFixed(1) + ' MB). Choose the .pfx or .p12 file.';
  if (u8[0] !== 0x30) return 'This file couldn’t be read as a .pfx / .p12 certificate. Choose the file that ends in .pfx or .p12.';
  return '';
}
async function readPfx() {
  const f = $('esPfx').files[0], pw = $('esPfxPw').value;
  if (!f) throw new UserError('Choose your .pfx or .p12 certificate file.');
  need('forge');
  const u8 = new Uint8Array(await f.arrayBuffer());
  const bad = pfxProblem(f.name, u8);
  if (bad) throw new UserError(bad);
  if (!pw) throw new UserError('Type the certificate password to read it.');
  const bin = binStr(u8); // in small pieces, so even a large file can’t overflow the stack
  let p12;
  try { p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bin), false, pw) }
  catch (e) {
    if (/MAC|password|Invalid|PKCS#12/i.test(e.message) && !/OID|curve/i.test(e.message)) throw new UserError('That password doesn’t open this certificate. Check it and try again. (If you set the password when you exported the DSC, use that one.)');
    if (/OID|curve|EC/i.test(e.message)) throw new UserError('This certificate uses a key type that isn’t supported yet. Only RSA certificates (used by most Indian DSCs) work.');
    throw new UserError('This file couldn’t be read as a .pfx / .p12 certificate.');
  }
  const O = forge.pki.oids, bags = t => p12.getBags({ bagType: t })[t] || [];
  const keys = [...bags(O.pkcs8ShroudedKeyBag), ...bags(O.keyBag)].map(b => b.key).filter(Boolean);
  const certs = bags(O.certBag).map(b => b.cert).filter(Boolean);
  if (!keys.length) throw new UserError('This file has no private key, so it can’t sign. Export the DSC again with “include private key”.');
  const key = keys.find(k => k.n) ; if (!key) throw new UserError('Only RSA certificates are supported.');
  const signer = certs.find(c => c.publicKey && c.publicKey.n && c.publicKey.n.equals(key.n));
  if (!signer) throw new UserError('The certificate that matches the private key is missing from this file.');
  const name = (signer.subject.getField('CN') || {}).value || 'Unknown signer';
  return { key, chain: [signer, ...certs.filter(c => c !== signer)], name, cert: signer };
}
async function previewPfx() {
  const box = $('esCert'); DSC = null;
  const f = $('esPfx').files[0];
  if (!f) { box.hidden = true; return }
  try {
    const bad = pfxProblem(f.name, new Uint8Array(await f.arrayBuffer()));
    if (bad) { box.hidden = false; box.className = 'es-cert bad'; box.textContent = bad; return }
  } catch (e) { box.hidden = false; box.className = 'es-cert bad'; box.textContent = 'This file couldn’t be opened. Choose it again.'; return }
  if (!$('esPfxPw').value) { box.hidden = false; box.className = 'es-cert'; box.textContent = 'Certificate file found. Now type its password.'; return }
  try {
    DSC = await readPfx();
    const c = DSC.cert, now = new Date(), exp = c.validity.notAfter < now;
    box.hidden = false; box.className = 'es-cert' + (exp ? ' bad' : '');
    box.innerHTML = `<b>${esc(DSC.name)}</b>${c.subject.getField('O') ? ' · ' + esc(c.subject.getField('O').value) : ''}<br>Issued by ${esc((c.issuer.getField('CN') || {}).value || '')}<br>${exp ? 'EXPIRED on ' : 'Valid until '}${fmtD(c.validity.notAfter)}`;
  } catch (e) { box.hidden = false; box.className = 'es-cert bad'; box.textContent = errText(e) }
}
$('esPfx').addEventListener('change', previewPfx);
$('esPfxPw').addEventListener('change', previewPfx);
{ let t; $('esPfxPw').addEventListener('input', () => { clearTimeout(t); t = setTimeout(previewPfx, 600) }) }
$('esPfxShow') && $('esPfxShow').addEventListener('change', e => { $('esPfxPw').type = e.target.checked ? 'text' : 'password' });
let SIGN_KIND = 'esign';
function startSign(kind) {
  if (!D) { toast('Open a PDF first.', true); return }
  if (!LIC || !LIC.active) { showPay(kind === 'dsc' ? 'DSC signing' : 'e-Sign'); return }
  if (isSigned(D)) { toast('This PDF is already signed and locked. Signing it again would break the existing signature.', true); return }
  if (OFFLINE && kind === 'esign') { toast('e-Sign needs an internet connection. DSC signing works offline.', true); return }
  cancelEdit(); SIGN_KIND = kind;
  const placed = findPlaced();
  $('esH').textContent = kind === 'esign' ? 'e-Sign and lock' : 'Sign with DSC and lock';
  const guest = !!ME.guest && kind === 'esign';
  $('esIntro').textContent = guest
    ? 'Sign without an account. Only the document’s fingerprint is sent to the server, never the file.'
    : kind === 'esign'
    ? 'Your e-signature uses a personal certificate issued to your account. Only the document’s fingerprint is sent to the server, never the file.'
    : 'Sign with your Digital Signature Certificate (DSC). Signing happens on this computer.';
  $('esWho').hidden = kind !== 'esign' || guest;
  $('esGuest').hidden = !guest; $('esGAgree').checked = false; if (guest) $('esGName').value = LS.get('pt-gname') || '';
  $('esWho').innerHTML = `Signing as <b>${esc(ME.name)}</b> · ${esc(ME.email || ME.phone || '')}`;
  $('esDsc').hidden = kind !== 'dsc'; $('esPwRow').hidden = kind !== 'esign' || guest;
  $('esPw').value = '';
  $('esPlacedRow').hidden = !placed; if (placed) $('esPlacedPg').textContent = placed.k + 1;
  $('esPage').innerHTML = D.pages.map((p, i) => `<option value="${i}"${i === D.pages.length - 1 ? ' selected' : ''}>page ${i + 1}</option>`).join('');
  document.querySelector(`[name=esPos][value=${placed ? 'placed' : 'box'}]`).checked = true;
  setMsg('esMsg', ''); $('esGo').disabled = false;
  $('esdlg').showModal();
  setTimeout(() => (guest ? $('esGName') : kind === 'esign' ? $('esPw') : $('esPfx')).focus(), 50);
}
const pad2 = n => String(n).padStart(2, '0');
function sigDateText(d) { const o = -d.getTimezoneOffset(), s = o >= 0 ? '+' : '-', a = Math.abs(o); return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${s}${pad2(a / 60 | 0)}'${pad2(a % 60)}'` }
async function loadImg(url) { const i = new Image(); i.src = url; await i.decode(); return i }
// draws the visible signature: handwriting (or the name) on top, signer details underneath
async function appearancePng(W, H, imgUrl, name, lines) {
  const S = 4, cv = document.createElement('canvas'); cv.width = Math.round(W * S); cv.height = Math.round(H * S);
  const x = cv.getContext('2d'), fs = 6.4, lh = fs * 1.25, textH = lines.length * lh + 3, topH = H - textH;
  x.scale(S, S);
  if (imgUrl) {
    const im = await loadImg(imgUrl), k = Math.min(W / im.width, topH / im.height);
    x.drawImage(im, 0, (topH - im.height * k) / 2, im.width * k, im.height * k);
  } else {
    x.fillStyle = '#0d2b6b'; let f = Math.min(30, topH * .7); x.font = `${f}px ${SIGFONTS[0]}`;
    while (x.measureText(name).width > W - 4 && f > 8) { f -= 1; x.font = `${f}px ${SIGFONTS[0]}` }
    x.textBaseline = 'middle'; x.fillText(name, 2, topH / 2);
  }
  x.strokeStyle = 'rgba(17,96,63,.55)'; x.lineWidth = .6; x.beginPath(); x.moveTo(0, topH + .5); x.lineTo(W, topH + .5); x.stroke();
  x.fillStyle = '#1b2b30'; x.font = `${fs}px Helvetica, Arial, sans-serif`; x.textBaseline = 'top';
  lines.forEach((l, i) => { let t = l; while (x.measureText(t).width > W - 2 && t.length > 4) t = t.slice(0, -2) + '…'; x.fillText(t, 1, topH + 2 + i * lh) });
  return cv.toDataURL('image/png');
}
async function signDocument({ pos, page, corner, reason, location, signerName, contact, getCms, onStep }) {
  need('pdflib', 'forge');
  const { PDFDocument, PDFName, PDFString, PDFHexString, PDFDict, PDFArray, PDFNumber } = PDFLib;
  const placed = pos === 'placed' ? findPlaced() : null;
  onStep('Preparing the document…');
  const clone = { ...D, pages: D.pages.map(p => ({ ...p, objs: p.objs.filter(o => !placed || o !== placed.o) })) };
  const flat = await buildDoc(clone, { flatten: true, optimize: false });
  const doc = await PDFDocument.load(flat, { updateMetadata: false });
  const ctx = doc.context, pages = doc.getPages(), when = new Date();
  // appearance
  let k = 0, rect = [0, 0, 0, 0], ap = null;
  if (pos !== 'none') {
    const lines = [`Digitally signed by ${signerName}`, `Date: ${sigDateText(when)}`, `Reason: ${reason}`].concat(location ? [`Location: ${location}`] : []);
    const textH = lines.length * 6.4 * 1.25 + 3;
    let x, y, w, h, img = null;
    if (placed) {
      k = placed.k; const o = placed.o; img = IMGS[o.img] && IMGS[o.img].url;
      w = Math.max(o.w, 165); h = o.h + textH; x = o.x; y = o.y;
    } else {
      k = page; const p = D.pages[k], saved = loadSigs('sig')[0]; img = saved ? saved.url : null;
      w = 190; h = 52 + textH; const mg = 30;
      x = corner[1] === 'r' ? p.bw - w - mg : mg; y = corner[0] === 'b' ? p.bh - h - mg : mg;
    }
    const png = await doc.embedPng(dataUrlBytes(await appearancePng(w, h, img, signerName, lines)));
    const M = mInv(D.pages[k].vt);
    ap = ctx.register(ctx.stream(`q ${N(w)} 0 0 ${N(-h)} ${N(x)} ${N(y + h)} cm /Im0 Do Q`, { Type: 'XObject', Subtype: 'Form', BBox: [x, y, x + w, y + h], Matrix: M, Resources: { XObject: { Im0: png.ref } } }));
    rect = mRect(M, x, y, x + w, y + h);
  }
  // signature dictionary with room for the signature, certifying "no changes allowed"
  const sigDict = ctx.obj({
    Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, PDFName.of(BRPH), PDFName.of(BRPH), PDFName.of(BRPH)],
    Contents: PDFHexString.of('0'.repeat(SIGHEX)),
    Name: PDFHexString.fromText(signerName), Reason: PDFHexString.fromText(reason), M: PDFString.fromDate(when),
    Reference: [{ Type: 'SigRef', TransformMethod: 'DocMDP', TransformParams: { Type: 'TransformParams', P: 1, V: '1.2' } }],
    Prop_Build: { App: { Name: 'AKSmartsPDF' } }
  });
  if (location) sigDict.set(PDFName.of('Location'), PDFHexString.fromText(location));
  if (contact) sigDict.set(PDFName.of('ContactInfo'), PDFHexString.fromText(contact));
  const sigRef = ctx.register(sigDict);
  let af = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (!af) { af = ctx.obj({}); doc.catalog.set(PDFName.of('AcroForm'), ctx.register(af)) }
  let fields = af.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (!fields) { fields = ctx.obj([]); af.set(PDFName.of('Fields'), fields) }
  const pg = pages[k];
  const widget = ctx.obj({ Type: 'Annot', Subtype: 'Widget', FT: 'Sig', Rect: rect, V: sigRef, T: PDFString.of('Signature' + (fields.size() + 1)), F: 132, P: pg.ref });
  if (ap) widget.set(PDFName.of('AP'), ctx.obj({ N: ap }));
  const wref = ctx.register(widget);
  pg.node.addAnnot(wref); fields.push(wref);
  af.set(PDFName.of('SigFlags'), PDFNumber.of(3));
  doc.catalog.set(PDFName.of('Perms'), ctx.obj({ DocMDP: sigRef }));
  doc.setModificationDate(when); doc.setProducer('AK Smarts PDF');
  const out = await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
  // fill in the byte range, then sign everything except the signature itself
  const txt = latin1(out);
  const brm = /\/ByteRange\s*\[\s*0\s+\/\*{10}\s+\/\*{10}\s+\/\*{10}\s*\]/.exec(txt);
  const start = txt.indexOf('<' + '0'.repeat(SIGHEX) + '>');
  if (!brm || start < 0) throw new Error('signature placeholder not found');
  const end = start + SIGHEX + 2;
  let br = `/ByteRange [0 ${start} ${end} ${out.length - end}]`;
  if (br.length > brm[0].length) throw new Error('byte range too long');
  br = br.padEnd(brm[0].length, ' ');
  for (let i = 0; i < br.length; i++) out[brm.index + i] = br.charCodeAt(i);
  const dg = await digestHex('SHA-256', [out.subarray(0, start), out.subarray(end)]);
  onStep('Signing…');
  const cms = await getCms(dg);
  const hex = forge.util.bytesToHex(cms);
  if (hex.length > SIGHEX) throw new UserError('The certificate chain is too large to fit in the signature.');
  for (let i = 0; i < hex.length; i++) out[start + 1 + i] = hex.charCodeAt(i);
  return { bytes: out, digest: dg };
}
$('esGSignIn').onclick = () => { $('esdlg').close(); gNote('Sign in to e-Sign with your verified name and email.'); gateView('login') };
$('esGo').onclick = async () => {
  const kind = SIGN_KIND, pos = document.querySelector('[name=esPos]:checked').value;
  const btn = $('esGo'); btn.disabled = true; setMsg('esMsg', '');
  try {
    let getCms, signerName, contact;
    if (kind === 'esign' && ME.guest) {
      const nm = $('esGName').value.replace(/\s+/g, ' ').trim();
      if (nm.length < 2) { $('esGName').focus(); throw new UserError('Type your full name as it should appear on the signature.') }
      if (!$('esGAgree').checked) { $('esGAgree').focus(); throw new UserError('Please tick the box to confirm you are the person named and agree to sign.') }
      LS.set('pt-gname', nm); signerName = nm; contact = '';
      getCms = async dg => { const r = await api('/api/esign/guest-sign', { digest: dg, file_name: D.name, name: nm, agree: true, device: DEVICE }); return atob(r.cms) };
    } else if (kind === 'esign') {
      const pw = $('esPw').value;
      if (!pw) { $('esPw').focus(); throw new UserError('Type your account password to confirm.') }
      signerName = ME.name; contact = ME.email || ME.phone || '';
      getCms = async dg => { const r = await api('/api/esign/sign', { digest: dg, file_name: D.name, password: pw }); return atob(r.cms) };
    } else {
      const d = DSC || await readPfx();
      if (d.cert.validity.notAfter < new Date()) throw new UserError('This certificate has expired. Renew your DSC to sign.');
      if (d.cert.validity.notBefore > new Date()) throw new UserError('This certificate isn’t valid yet.');
      signerName = d.name; contact = (d.cert.subject.getField('E') || {}).value || '';
      getCms = async dg => Cms().buildSignedData({ digest: forge.util.hexToBytes(dg), certs: d.chain, key: d.key });
    }
    const r = await signDocument({ pos, page: +$('esPage').value, corner: $('esCorner').value, reason: $('esReason').value, location: $('esLoc').value.trim(), signerName, contact, getCms, onStep: t => setMsg('esMsg', t) });
    if (kind === 'dsc') api('/api/esign/log', { digest: r.digest, file_name: D.name, signer: signerName }).catch(() => {});
    const name = D.name.replace(/(-edited)?(-signed)?\.pdf$/i, '') + '-signed.pdf';
    $('esdlg').close(); DSC = null; $('esPfx').value = ''; $('esPfxPw').value = ''; $('esCert').hidden = true;
    const old = D; old.dirty = false;
    try { await saveBytes(name, r.bytes) } catch (e) { if (!(e && e.code === 'declined')) throw e }
    await wsOpenBytes(r.bytes, name);
    closeDoc(old);
    toast(`Signed and locked. Saved as ${name}.`);
  } catch (e) {
    console.error(e);
    setMsg('esMsg', e instanceof UserError || e.status ? e.message : 'Signing didn’t work. Check the certificate file and password, then try again. If it keeps happening, tell us at the Contact page (technical note: ' + String(e && e.message || e).slice(0, 80) + ').', 'bad');
    if (e.field === 'password') $('esPw').focus(); else if (e.field === 'name') $('esGName').focus();
  } finally { btn.disabled = false }
};

/* ---------- ribbon buttons and tool cards ---------- */
const PATH = {
  esign: 'M3 17.5l9.5-9.5 3 3L6 20.5H3zM14 6.5l2-2 3 3-2 2M14 15h7v6h-7zM15.5 15v-1.5a2 2 0 0 1 4 0V15',
  dsc: 'M4 4h16v11H4zM8 8h8M8 11h5M15 13.5a2 2 0 1 0 .01 0M14 17l-1 4 2.5-1.2L18 21l-1-4',
  verify: 'M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6zM8.5 12l2.5 2.5 4.5-5'
};

/* ---------- ribbon: display options (like Word), full screen, and a "More" menu so it always fits ---------- */
const ICO_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const ICO_FULL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICO_EXIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
const ICO_MORE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';
const ICO_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function refit() { setTimeout(() => { try { if (typeof D !== 'undefined' && D && D.fit) setZoom(0, D.fit) } catch (e) {} window.dispatchEvent(new Event('resize')) }, 120) }
const ribMin = () => document.body.classList.contains('rib-min');
function setRibbonMin(min, remember = true) {
  document.body.classList.toggle('rib-min', min);
  document.body.classList.remove('rib-peek');
  if (remember) LS.set('pt-rib-min', min ? '1' : '0');
  if (!min) fitRibbon();
  syncRibMenu(); refit();
}
const isFull = () => !!document.fullscreenElement || document.body.classList.contains('ws-max');
function updateFullBtn() { const b = $('ribFull'); if (!b) return; const f = isFull(); b.innerHTML = f ? ICO_EXIT : ICO_FULL; b.title = f ? 'Exit full screen (Esc)' : 'Full screen'; b.setAttribute('aria-label', b.title); b.classList.toggle('on', f); syncRibMenu() }
async function toggleFull() {
  if (isFull()) {
    document.body.classList.remove('ws-max');
    if (document.fullscreenElement) { try { await document.exitFullscreen() } catch (e) {} }
  } else {
    // real full screen where the browser allows it; otherwise (e.g. iPhone) fill the window
    const el = document.documentElement;
    try { if (!el.requestFullscreen) throw 0; await el.requestFullscreen({ navigationUI: 'hide' }) } catch (e) {}
    document.body.classList.add('ws-max');
  }
  updateFullBtn(); fitRibbon(); refit();
}
function syncRibMenu() {
  const m = $('ribMenu'); if (!m) return;
  const mode = isFull() ? 'full' : ribMin() ? 'tabs' : 'always';
  m.querySelectorAll('[data-mode]').forEach(i => { i.setAttribute('aria-checked', String(i.dataset.mode === mode)); i.querySelector('.ck').innerHTML = i.dataset.mode === mode ? ICO_CHECK : '' });
}
function closeMenus(except) { document.querySelectorAll('.pop-menu:not([hidden])').forEach(m => { if (m !== except) { m.hidden = true; const b = m.previousElementSibling; if (b) b.setAttribute('aria-expanded', 'false') } }) }
function toggleMenu(btn, menu) { const open = menu.hidden; closeMenus(menu); menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) { const f = menu.querySelector('button,select,input'); if (f) f.focus({ preventScroll: true }) } }

// keep every toolbar button on screen: whatever doesn't fit goes into a "More" menu at the end
function fitRibbon() {
  const r = $('rbar'); if (!r) return;
  const old = r.querySelector(':scope > .rb-more');
  if (old) { const menu = old.querySelector('.rb-menu'); while (menu.firstChild) r.insertBefore(menu.firstChild, old); old.remove() }
  r.querySelectorAll(':scope > .sep.rb-cut').forEach(x => x.classList.remove('rb-cut'));
  if (!r.offsetParent || ribMin() && !document.body.classList.contains('rib-peek')) return;
  r.classList.add('fitting');
  if (r.scrollWidth > r.clientWidth + 1) {
    const more = document.createElement('div'); more.className = 'rb-more';
    more.innerHTML = `<button type="button" class="tb rb-more-btn" aria-haspopup="menu" aria-expanded="false" title="More tools">${ICO_MORE}<span>More</span></button><div class="rb-menu pop-menu" role="menu" hidden></div>`;
    r.appendChild(more);
    const menu = more.querySelector('.rb-menu');
    const items = [...r.children].filter(c => c !== more);
    for (let i = items.length - 1; i >= 0 && r.scrollWidth > r.clientWidth + 1; i--) menu.prepend(items[i]);
    while (menu.firstElementChild && menu.firstElementChild.classList.contains('sep')) menu.firstElementChild.classList.add('rb-cut'), menu.appendChild(menu.firstElementChild);
    const prev = more.previousElementSibling; if (prev && prev.classList.contains('sep')) prev.classList.add('rb-cut');
    if (!menu.children.length) more.remove();
    more.querySelector('.rb-more-btn').onclick = e => { e.stopPropagation(); toggleMenu(e.currentTarget, menu) };
    // close after a command runs (not when changing a colour, size or other setting)
    menu.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) setTimeout(() => closeMenus(), 0) });
  }
  r.classList.remove('fitting');
}
let fitT = 0;
window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fitRibbon, 120) });

function wireRibbonControls() {
  const tabs = $('rtabs'); if (!tabs || $('ribCtl')) return;
  const row = document.createElement('div'); row.className = 'rtabs-row';
  tabs.parentNode.insertBefore(row, tabs); row.appendChild(tabs);
  const ctl = document.createElement('div'); ctl.className = 'rib-ctl'; ctl.id = 'ribCtl';
  ctl.innerHTML = `<button type="button" id="ribFull" class="rib-ic"></button>
    <div class="rib-dd"><button type="button" id="ribOpt" class="rib-ic" aria-haspopup="menu" aria-expanded="false" title="Ribbon display options" aria-label="Ribbon display options">${ICO_DOWN}</button>
    <div class="pop-menu rib-menu" id="ribMenu" role="menu" hidden>
      <div class="pm-h">Show ribbon</div>
      <button type="button" role="menuitemradio" data-mode="full"><span class="ck"></span><span><b>Full-screen mode</b><small>Only the document. Esc to exit.</small></span></button>
      <button type="button" role="menuitemradio" data-mode="tabs"><span class="ck"></span><span><b>Show tabs only</b><small>Click a tab to see its tools.</small></span></button>
      <button type="button" role="menuitemradio" data-mode="always"><span class="ck"></span><span><b>Always show ribbon</b><small>Tabs and tools are always visible.</small></span></button>
      <div class="pm-foot">Ctrl+F1 shows or hides the ribbon</div>
    </div></div>`;
  row.appendChild(ctl);
  $('ribFull').onclick = () => toggleFull();
  $('ribOpt').onclick = e => { e.stopPropagation(); syncRibMenu(); toggleMenu(e.currentTarget, $('ribMenu')) };
  $('ribMenu').addEventListener('click', async e => {
    const i = e.target.closest('[data-mode]'); if (!i) return;
    closeMenus();
    const m = i.dataset.mode;
    if (m === 'full') { if (!isFull()) await toggleFull() }
    else { if (isFull()) await toggleFull(); setRibbonMin(m === 'tabs') }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.pop-menu, .rb-more-btn, #ribOpt')) closeMenus();
    // "tabs only": the tools drop down over the page, and fold away again after use
    // (a tab that was just redrawn is no longer in the page: that click was on the ribbon)
    if (document.body.classList.contains('rib-peek') && e.target.isConnected && !e.target.closest('#ribbon, dialog')) { document.body.classList.remove('rib-peek') }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.querySelector('.pop-menu:not([hidden])')) { closeMenus(); return }
    if (e.key === 'F1' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setRibbonMin(!ribMin()) }
    else if (e.key === 'Escape' && document.body.classList.contains('rib-peek')) document.body.classList.remove('rib-peek');
    else if (e.key === 'Escape' && document.body.classList.contains('ws-max') && !document.querySelector('dialog[open]')) toggleFull();
  });
  // in "tabs only", clicking a tab shows its tools over the page; double-clicking a tab switches modes (like Word)
  // (the tabs are redrawn on every click, so a double-click is detected by timing)
  let last = { rt: null, t: 0 };
  tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-rt]'); if (!b) return;
    const now = Date.now(), dbl = last.rt === b.dataset.rt && now - last.t < 450;
    last = dbl ? { rt: null, t: 0 } : { rt: b.dataset.rt, t: now };
    if (dbl) { setRibbonMin(!ribMin()); return }
    if (ribMin()) { document.body.classList.add('rib-peek'); setTimeout(fitRibbon, 0) }
  }, true);
  $('rbar').addEventListener('click', e => { if (document.body.classList.contains('rib-peek') && e.target.closest('[data-a]') && !e.target.closest('.rb-more-btn')) setTimeout(() => document.body.classList.remove('rib-peek'), 150) });
  window.addEventListener('hashchange', () => { if (location.hash !== '#reader' && document.body.classList.contains('ws-max')) toggleFull() });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('ws-max'); updateFullBtn(); fitRibbon(); refit() });
  setRibbonMin(LS.get('pt-rib-min') === '1', false); updateFullBtn();
}

/* ---------- compress levels (90 / 75 / 50 / 25 %), Compress image, Resize image, Convert image ---------- */
// the work is done by src/compress.js (window.PTCompress)
const LEVEL_NOTES = {
  pdf: {
    '90': 'Best quality. Pictures look the same; duplicate pictures and fonts are stored once and hidden extras are removed. Good for printing.',
    '75': 'Recommended. Pictures stay sharp on screen and the file is usually much smaller. Text stays selectable. Good for email.',
    '50': 'Strong. Fine for reading on screen; scans become clean grey when they are black-and-white documents. Good for upload forms.',
    '25': 'Smallest while still readable. Use when a website has a strict size limit.',
    'x': 'Extreme: every page becomes a picture (with searchable text). Smallest file.',
    'l': 'Lossless: nothing changes visually. Only removes unused data, so the file is usually only a little smaller.'
  },
  img: {
    '90': 'Best quality. Looks the same as the original. Very large photos are reduced to 3200 pixels.',
    '75': 'Recommended. Looks the same on screen and is usually much smaller. Good for email and WhatsApp.',
    '50': 'Strong. Fine on screen; document photos become clean grey. Photos are reduced to 1600 pixels.',
    '25': 'Smallest. Good for forms with a strict size limit. Photos are reduced to 1200 pixels.'
  }
};
const LEVEL_TEXT = { '90': '90% quality · light compression', '75': '75% quality · recommended', '50': '50% quality · strong compression', '25': '25% quality · smallest file' };
const imgLevels = () => ['90', '75', '50', '25'].map(v => [v, LEVEL_TEXT[v]]);
const TARGETS = [['0', 'No size limit (use the level above)'], ['5120', 'Under 5 MB'], ['2048', 'Under 2 MB'], ['1024', 'Under 1 MB'], ['500', 'Under 500 KB'], ['300', 'Under 300 KB'], ['200', 'Under 200 KB'], ['100', 'Under 100 KB'], ['50', 'Under 50 KB'], ['20', 'Under 20 KB']];
const fileNote = (f, out) => out.length >= f.size ? 'Already as small as this level allows, so the original is kept.' : `${Math.round(100 - out.length / f.size * 100)}% smaller: ${fmtSize(f.size)} → ${fmtSize(out.length)}.`;
async function compressImageFile(f, lv, target, P) { return PTCompress.image(f, { lv, target: (+target || 0) * 1024 }, P) }
// Crop image: a box you drag on the picture, with ready-made shapes and rotation
const CROP_RATIOS = [['free', 'Free (any shape)', 0], ['passport', 'Passport photo 3.5 × 4.5 cm', 35 / 45], ['1:1', 'Square 1:1 (profile photo)', 1], ['4:5', 'Portrait 4:5 (Instagram)', 4 / 5], ['3:4', 'Portrait 3:4', 3 / 4], ['4:3', 'Landscape 4:3', 4 / 3], ['16:9', 'Wide 16:9 (YouTube, slides)', 16 / 9], ['a4', 'A4 page', 210 / 297]];
function cropDialog(src, ratioKey) {
  return new Promise((resolve, reject) => {
    const dlg = document.createElement('dialog'); dlg.className = 'wide cropdlg'; dlg.setAttribute('aria-labelledby', 'crH');
    dlg.innerHTML = `<h3 id="crH">Crop image</h3>
<div class="cr-bar"><label>Shape <select class="cr-ratio">${CROP_RATIOS.map(r => `<option value="${r[0]}">${esc(r[1])}</option>`).join('')}</select></label>
<span class="cr-btns"><button type="button" class="btn2" data-rot="-1" aria-label="Rotate left" title="Rotate left">⟲</button><button type="button" class="btn2" data-rot="1" aria-label="Rotate right" title="Rotate right">⟳</button></span></div>
<div class="cr-wrap"><div class="cr-stage"><canvas></canvas><div class="cr-box" tabindex="0" aria-label="Crop area. Use the arrow keys to move it."><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i><span class="cr-size"></span></div></div></div>
<p class="lbl cr-tip">Drag the box to move it; drag a corner to resize.</p>
<div class="dbar"><button type="button" class="btn2" data-x>Cancel</button><button type="button" class="btn" data-ok>Crop and save</button></div>`;
    document.body.appendChild(dlg);
    const view = dlg.querySelector('canvas'), box = dlg.querySelector('.cr-box'), sel = dlg.querySelector('.cr-ratio'), sizeEl = dlg.querySelector('.cr-size');
    let cv = src, rot = 0, k = 1, B = { x: 0, y: 0, w: 0, h: 0 }, R = 0;
    const ratio = () => (CROP_RATIOS.find(r => r[0] === sel.value) || CROP_RATIOS[0])[2];
    function rotated() {
      if (!rot) return src;
      const c = document.createElement('canvas'), q = rot % 2 !== 0; c.width = q ? src.height : src.width; c.height = q ? src.width : src.height;
      const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 2); x.drawImage(src, -src.width / 2, -src.height / 2); return c;
    }
    function draw() {
      const wrap = dlg.querySelector('.cr-wrap'), maxW = Math.min((wrap.clientWidth - 28) || 800, 900), maxH = Math.max(220, innerHeight * .58);
      k = Math.min(1, maxW / cv.width, maxH / cv.height);
      view.width = Math.round(cv.width * k); view.height = Math.round(cv.height * k);
      view.getContext('2d').drawImage(cv, 0, 0, view.width, view.height); place();
    }
    function fit() {
      R = ratio(); const W = cv.width, H = cv.height;
      let w = W * .9, h = H * .9; if (R) { if (w / h > R) w = h * R; else h = w / R }
      B = { x: (W - w) / 2, y: (H - h) / 2, w, h }; place();
    }
    function place() {
      box.style.left = B.x * k + 'px'; box.style.top = B.y * k + 'px'; box.style.width = B.w * k + 'px'; box.style.height = B.h * k + 'px';
      sizeEl.textContent = `${Math.round(B.w)} × ${Math.round(B.h)}`;
    }
    const clampMove = () => { B.x = Math.max(0, Math.min(cv.width - B.w, B.x)); B.y = Math.max(0, Math.min(cv.height - B.h, B.y)) };
    let drag = null;
    box.addEventListener('pointerdown', e => { e.preventDefault(); box.setPointerCapture(e.pointerId); drag = { h: e.target.dataset.h || 'move', sx: e.clientX, sy: e.clientY, b: { ...B } } });
    box.addEventListener('pointermove', e => {
      if (!drag) return; const dx = (e.clientX - drag.sx) / k, dy = (e.clientY - drag.sy) / k, b = drag.b, W = cv.width, H = cv.height, min = 16;
      if (drag.h === 'move') { B.x = b.x + dx; B.y = b.y + dy; clampMove(); place(); return }
      const L = drag.h.includes('w'), T = drag.h.includes('n');
      let x0 = L ? b.x + dx : b.x, x1 = L ? b.x + b.w : b.x + b.w + dx, y0 = T ? b.y + dy : b.y, y1 = T ? b.y + b.h : b.y + b.h + dy;
      x0 = Math.max(0, Math.min(x0, x1 - min)); x1 = Math.min(W, Math.max(x1, x0 + min)); y0 = Math.max(0, Math.min(y0, y1 - min)); y1 = Math.min(H, Math.max(y1, y0 + min));
      let w = x1 - x0, h = y1 - y0;
      if (R) { // keep the shape: follow the larger change, stay inside the picture
        if (w / h > R) w = h * R; else h = w / R;
        const maxW = L ? b.x + b.w : W - b.x, maxH = T ? b.y + b.h : H - b.y;
        if (w > maxW) { w = maxW; h = w / R } if (h > maxH) { h = maxH; w = h * R }
        x0 = L ? b.x + b.w - w : b.x; y0 = T ? b.y + b.h - h : b.y;
      }
      B = { x: x0, y: y0, w, h }; place();
    });
    box.addEventListener('pointerup', () => { drag = null });
    box.addEventListener('keydown', e => { const st = e.shiftKey ? 10 : 1, m = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key]; if (m) { e.preventDefault(); B.x += m[0] / k; B.y += m[1] / k; clampMove(); place() } });
    sel.onchange = fit;
    dlg.querySelectorAll('[data-rot]').forEach(b => b.onclick = () => { rot = (rot + +b.dataset.rot + 4) % 4; cv = rotated(); draw(); fit() });
    const done = v => { dlg.close(); dlg.remove(); removeEventListener('resize', draw); v ? resolve(v) : reject(new UserError('Cropping was cancelled.')) };
    dlg.querySelector('[data-x]').onclick = () => done(null);
    dlg.addEventListener('cancel', e => { e.preventDefault(); done(null) });
    dlg.querySelector('[data-ok]').onclick = () => done({ cv, x: Math.round(B.x), y: Math.round(B.y), w: Math.max(1, Math.round(B.w)), h: Math.max(1, Math.round(B.h)) });
    addEventListener('resize', draw);
    sel.value = CROP_RATIOS.some(r => r[0] === ratioKey) ? ratioKey : 'free';
    dlg.showModal(); draw(); fit(); box.focus();
  });
}
// a canvas that keeps transparency (for PNG and WebP)
async function plainCanvas(f, maxSide, scale) {
  let bm; try { bm = await createImageBitmap(f) } catch (e) { throw new UserError(`“${f.name || 'This picture'}” is not a picture this browser can open. Use JPG, PNG or WebP.`) }
  let k = scale || 1; if (maxSide) k = Math.min(k, maxSide / Math.max(bm.width, bm.height));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bm.width * k)); cv.height = Math.max(1, Math.round(bm.height * k));
  const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(bm, 0, 0, cv.width, cv.height); bm.close && bm.close();
  return cv;
}
const IMG_TYPES = { jpg: ['image/jpeg', 'jpg'], png: ['image/png', 'png'], webp: ['image/webp', 'webp'] };
const typeOfImg = f => /png$/i.test(f.type) || /\.png$/i.test(f.name) ? 'png' : /webp$/i.test(f.type) || /\.webp$/i.test(f.name) ? 'webp' : 'jpg';
async function encodeImg(cv, to, q) {
  if (to === 'jpg') { const w = document.createElement('canvas'); w.width = cv.width; w.height = cv.height; const c = w.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, w.width, w.height); c.drawImage(cv, 0, 0); cv = w }
  return blobU8(await toBlob(cv, IMG_TYPES[to][0], to === 'png' ? undefined : (q || .9)));
}
function addImageAndCompressTools() {
  const C = TOOLS.compress; if (!C || TOOLS.compressimg) return;
  // Compress PDF: clear percentage levels, plus Extreme and Lossless, an optional target size
  C.d = 'Make a PDF smaller to email or upload, even big scanned files';
  C.kinds = ['pdf'];
  C.multi = true;
  C.help = 'Pick a level, or a size the file must fit under. Scans, photos and merged files shrink the most. Several PDFs at once are saved together in a ZIP.';
  C.opts = [SEL('lv', 'Compression level', [...imgLevels(), ['x', 'Extreme · pages become pictures'], ['l', 'Lossless · no visible change']]),
    SEL('tg', 'Must be smaller than (optional)', TARGETS),
    SEL('kt', 'If more shrinking is needed', [['auto', 'Allow pages to become pictures (text stays searchable)'], ['keep', 'Always keep text selectable']])];
  C.run = async (fs, o, P) => {
    const outs = [];
    for (let i = 0; i < fs.length; i++) {
      const f = fs[i], pp = (fr, t) => P(fr == null ? null : (i + fr) / fs.length, (fs.length > 1 ? `File ${i + 1} of ${fs.length}: ` : '') + (t || ''));
      if (!isPdf(f)) { outs.push(await compressImageFile(f, o.lv in PTCompress.IMG_LV ? o.lv : '75', o.tg, pp)); continue }
      outs.push(await PTCompress.pdf(f, { lv: o.lv, target: (+o.tg || 0) * 1024, keepText: o.kt === 'keep' }, pp));
    }
    return outs;
  };
  // Compress image: its own card, next to Compress PDF
  TOOLS.compressimg = { n: 'Compress image', d: 'Make JPG, PNG and other pictures smaller for forms, email and WhatsApp', cat: 'opt', h: 200, kinds: ['img'], multi: true, go: 'Compress', isNew: 1,
    help: 'Pick a quality level, or the size the picture must fit under (for example under 100 KB for a form). Several pictures are saved together in a ZIP. Pictures are saved as JPG.',
    opts: [SEL('lv', 'Compression level', imgLevels()), SEL('tg', 'Must be smaller than (optional)', TARGETS)],
    run: async (fs, o, P) => { const outs = []; for (let i = 0; i < fs.length; i++) { P(i / fs.length, `Compressing picture ${i + 1} of ${fs.length}`); outs.push(await compressImageFile(fs[i], o.lv, o.tg)) } return outs } };
  TOOLS.resizeimg = { n: 'Resize image', d: 'Change the width and height of pictures, for photos, forms and websites', cat: 'opt', h: 230, kinds: ['img'], multi: true, go: 'Resize', isNew: 1,
    help: 'The picture keeps its shape (nothing is stretched). PNG and WebP keep their transparent background.',
    opts: [SEL('sz', 'New size', [['1920', 'Large · longest side 1920 px (Full HD)'], ['1280', 'Medium · longest side 1280 px'], ['800', 'Small · longest side 800 px'], ['600', 'Passport / form photo · 600 px'], ['s75', '75% of the original size'], ['s50', '50% of the original size'], ['s25', '25% of the original size']])],
    run: async (fs, o, P) => {
      const outs = [];
      for (let i = 0; i < fs.length; i++) {
        const f = fs[i]; P(i / fs.length, `Resizing picture ${i + 1} of ${fs.length}`);
        const sc = /^s/.test(o.sz) ? +o.sz.slice(1) / 100 : 1, cv = await plainCanvas(f, sc === 1 ? +o.sz : 0, sc), to = typeOfImg(f);
        outs.push({ name: `${base(f)}-${cv.width}x${cv.height}.${IMG_TYPES[to][1]}`, data: await encodeImg(cv, to, .9), note: `${cv.width} × ${cv.height} pixels.` });
      }
      return outs;
    } };
  TOOLS.convertimg = { n: 'Convert image', d: 'Change pictures to JPG, PNG or WebP (for example PNG to JPG)', cat: 'opt', h: 260, kinds: ['img'], multi: true, go: 'Convert', isNew: 1,
    help: 'JPG is best for photos and is the most widely accepted. PNG keeps sharp edges and transparency. WebP is small and works on modern websites.',
    opts: [SEL('to', 'Convert to', [['jpg', 'JPG · photos, smallest, accepted everywhere'], ['png', 'PNG · sharp, keeps transparency'], ['webp', 'WebP · small, for websites']])],
    run: async (fs, o, P) => {
      const outs = [];
      for (let i = 0; i < fs.length; i++) { const f = fs[i]; P(i / fs.length, `Converting picture ${i + 1} of ${fs.length}`); const cv = await plainCanvas(f, 0, 1); outs.push({ name: `${base(f)}.${IMG_TYPES[o.to][1]}`, data: await encodeImg(cv, o.to, .92) }) }
      return outs;
    } };
  TI.compressimg = 'M4 5h16v14H4zM9 9l3 3 3-3M9 15l3-3 3 3';
  TI.resizeimg = 'M4 4h7M4 4v7M20 20h-7M20 20v-7M4 4l7 7M20 20l-7-7';
  TI.convertimg = 'M4 7h12l-3-3M20 17H8l3 3';
  TOOLS.cropimg = { n: 'Crop image', d: 'Cut a photo to the part you need: passport, square, 16:9 or free', cat: 'opt', h: 170, kinds: ['img'], go: 'Choose the area', isNew: 1,
    help: 'Drag the box to move it, drag its corners to change its size. Pick a shape such as Passport or Square, or rotate the picture first.',
    opts: [SEL('ratio', 'Shape', CROP_RATIOS.map(r => [r[0], r[1]]))],
    run: async ([f], o, P) => {
      P(null, 'Opening the picture…');
      const src = await plainCanvas(f, 0, 1), r = await cropDialog(src, o.ratio);
      const out = document.createElement('canvas'); out.width = r.w; out.height = r.h;
      out.getContext('2d').drawImage(r.cv, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      const to = typeOfImg(f);
      return [{ name: `${base(f)}-cropped.${IMG_TYPES[to][1]}`, data: await encodeImg(out, to, .92), note: `${r.w} × ${r.h} pixels.` }];
    } };
  TI.cropimg = 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14';
  ORDER.splice(ORDER.indexOf('compress') + 1, 0, 'compressimg', 'resizeimg', 'cropimg', 'convertimg');
  // a level note under the drop-down that changes with the choice
  const _openGeneric = openGeneric;
  openGeneric = function (id) {
    const r = _openGeneric.apply(this, arguments);
    const sel = $('o_lv'), notes = id === 'compress' ? LEVEL_NOTES.pdf : id === 'compressimg' ? LEVEL_NOTES.img : null;
    if (sel && notes) {
      sel.value = '75';
      const n = document.createElement('small'); n.className = 'lv-note'; n.id = 'o_lv_h'; sel.after(n); sel.setAttribute('aria-describedby', 'o_lv_h');
      const upd = () => { n.textContent = notes[sel.value] || ''; n.dataset.lv = sel.value };
      sel.addEventListener('change', upd); upd();
    }
    return r;
  };
  // the page was opened straight on one of the new tools (for example /compress-image)
  const h = location.hash.slice(1);
  if (['compressimg', 'resizeimg', 'cropimg', 'convertimg'].includes(h)) setTimeout(() => { try { cur = null } catch (e) {} route() }, 0);
}

/* ---------- Merge PDF: one tool with two modes ---------- */
// "Combine into one PDF": every file, in the order shown, becomes one PDF.
// "Batch by file name": "01_invoice.pdf", "_01 receipt.jpg" and "01-scan.pdf" are one set and become 01.pdf.
// Separators (_ - . space) at the start or between parts don't matter, and numbers ignore leading zeros (1 = 01 = 001).
// Files can be sorted A→Z or Z→A (2 before 10), or put in any order by dragging or with the arrows.
const GM_SEP = /[\s_\-.]+/;
const gmFid = f => f.name + '|' + f.size + '|' + (f.lastModified || 0);
const GM_OVR = new Map();   // sets the user typed in by hand
const natCmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const MM = { mode: 'one', sort: 'az', n: 0 };
const isMerge = () => typeof cur !== 'undefined' && (cur === 'merge' || cur === 'groupmerge');
function gmAutoKey(name, mode) {
  const s = name.replace(/\.[a-z0-9]{1,5}$/i, '').trim().replace(/^[\s_\-.]+/, '');
  let k;
  if (/^c\d+$/.test(mode)) k = s.slice(0, +mode.slice(1)).replace(/[\s_\-.]+$/, '');
  else { const parts = s.split(GM_SEP).filter(Boolean); k = parts.slice(0, mode === 'p2' ? 2 : mode === 'p3' ? 3 : 1).join('_') }
  return k || s || name;
}
const gmNorm = k => String(k).trim().replace(/^[\s_\-.]+|[\s_\-.]+$/g, '').split(GM_SEP).map(x => /^\d+$/.test(x) ? String(+x) : x.toLowerCase()).join('_');
// sets in A→Z (or Z→A) order; inside a set the files keep the order of the list
function gmGroups(files, mode) {
  const map = new Map();
  for (const f of files) {
    const label = (GM_OVR.get(gmFid(f)) || gmAutoKey(f.name, mode)).trim() || 'files', key = gmNorm(label) || label;
    if (!map.has(key)) map.set(key, { key, labels: [], files: [] });
    map.get(key).files.push(f); map.get(key).labels.push(label);
  }
  const gs = [...map.values()];
  gs.forEach(g => { const n = {}; g.labels.forEach(l => n[l] = (n[l] || 0) + 1); g.label = Object.keys(n).sort((a, b) => n[b] - n[a] || natCmp(a, b))[0] });
  return gs.sort((a, b) => MM.sort === 'za' ? natCmp(b.label, a.label) : natCmp(a.label, b.label));
}
const gmFileName = l => (String(l).replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'group') + '.pdf';
const bareName = n => n.replace(/^[\s_\-.]+/, '');
// compares names part by part (without the extension), so 18566 comes before 18566-1, 18566-2 … 18566-10
const nameParts = n => bareName(n).replace(/\.[a-z0-9]{1,5}$/i, '').split(GM_SEP).filter(Boolean);
function nameCmp(a, b) {
  const A = nameParts(a), B = nameParts(b);
  for (let i = 0; i < Math.min(A.length, B.length); i++) { const r = natCmp(A[i], B[i]); if (r) return r }
  return A.length - B.length || natCmp(a, b);
}
function sortFiles(dir) {
  gfiles.sort((a, b) => { const r = nameCmp(a.name, b.name); return dir === 'za' ? -r : r });
}
const ICO_AZ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M3.5 16.5L7 20l3.5-3.5"/><path d="M13 9.5L15.5 4 18 9.5M13.8 8h3.4M13 14h5l-5 6h5"/></svg>';
const ICO_ZA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20V4M3.5 7.5L7 4l3.5 3.5"/><path d="M13 4h5l-5 6h5M13 20l2.5-5.5L18 20M13.8 18.5h3.4"/></svg>';
function mergeBar() {
  let bar = $('mbar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'mbar'; bar.className = 'mbar';
    bar.innerHTML = `<div class="mseg" role="radiogroup" aria-label="How to merge">
  <button type="button" role="radio" data-mm="one"><b>Combine into one PDF</b><small>All files become one PDF, in the order below</small></button>
  <button type="button" role="radio" data-mm="batch"><b>Batch by file name</b><small>01_… files become 01.pdf, 02_… become 02.pdf</small></button></div>
<div class="msort"><span class="lbl">Order</span><button type="button" class="btn2 msb" data-ms="az" title="Sort A to Z, 1 to 9 (2 before 10)">${ICO_AZ}A → Z</button><button type="button" class="btn2 msb" data-ms="za" title="Sort Z to A, 9 to 1">${ICO_ZA}Z → A</button><span class="mhint">or drag files (or use the arrows) to put them in any order</span></div>`;
    $('glist').before(bar);
    bar.addEventListener('click', e => {
      const m = e.target.closest('[data-mm]'), s = e.target.closest('[data-ms]');
      if (m) { setMergeMode(m.dataset.mm); return }
      if (s) { MM.sort = s.dataset.ms; sortFiles(MM.sort); drawFiles() }
    });
  }
  return bar;
}
function setMergeMode(mode) {
  MM.mode = mode === 'batch' ? 'batch' : 'one';
  const sel = $('o_mode'); if (sel) { sel.value = MM.mode; sel.dispatchEvent(new Event('change', { bubbles: true })) }
  $('grun').textContent = MM.mode === 'batch' ? 'Merge into sets' : 'Merge files';
  $('gres').hidden = true;
  drawFiles();
}
function syncMergeBar() {
  const bar = $('mbar'), on = isMerge();
  if (bar) bar.hidden = !on;
  if (!on || !bar) return;
  bar.querySelectorAll('[data-mm]').forEach(b => { const p = b.dataset.mm === MM.mode; b.setAttribute('aria-checked', String(p)); b.classList.toggle('on', p) });
  bar.querySelectorAll('[data-ms]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ms === MM.sort)));
  bar.querySelector('.msort').hidden = gfiles.length < 2;
}
function gmPreview() {
  let box = $('gmPrev');
  const on = isMerge() && MM.mode === 'batch';
  document.body.classList.toggle('gm-on', on && gfiles.length > 0);
  if (!on) { if (box) box.hidden = true; return }
  if (!box) { box = document.createElement('div'); box.id = 'gmPrev'; box.className = 'gm-prev'; $('gopts').after(box); wireGmPreview(box) }
  box.hidden = !gfiles.length;
  if (!gfiles.length) { box.innerHTML = ''; return }
  const sel = $('o_by'), mode = sel ? sel.value : 'p1', gs = gmGroups(gfiles, mode);
  box.innerHTML = `<div class="gm-head"><b>${gs.length} PDF${gs.length === 1 ? '' : 's'} will be made</b> from ${gfiles.length} file${gfiles.length === 1 ? '' : 's'}${gs.length > 1 ? ', saved together as a ZIP' : ''}.<span>To move a file to another set, change its set name. Use the arrows to change the order inside a set.</span></div>` +
    gs.map(g => `<section class="gm-g"><h4><span class="gm-n">${esc(gmFileName(g.label))}</span><small>${g.files.length} file${g.files.length === 1 ? '' : 's'}</small></h4><ol>` +
      g.files.map((f, i) => `<li data-fid="${esc(gmFid(f))}"><span class="gm-f" title="${esc(f.name)}">${esc(f.name)}</span><span class="gm-mv"><button type="button" class="gm-u" aria-label="Move ${esc(f.name)} up"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="gm-d" aria-label="Move ${esc(f.name)} down"${i === g.files.length - 1 ? ' disabled' : ''}>↓</button></span><input class="inp gm-k" value="${esc(GM_OVR.get(gmFid(f)) || gmAutoKey(f.name, mode))}" aria-label="Set name for ${esc(f.name)}" spellcheck="false"><button type="button" class="gm-x" aria-label="Remove ${esc(f.name)}" title="Remove">×</button></li>`).join('') + '</ol></section>').join('') +
    (GM_OVR.size ? '<button type="button" class="btn2 gm-reset">Undo my changes to the sets</button>' : '');
}
function wireGmPreview(box) {
  const apply = inp => { const li = inp.closest('li'), v = inp.value.trim(), f = gfiles.find(x => gmFid(x) === li.dataset.fid); if (!f) return; const auto = gmAutoKey(f.name, ($('o_by') || {}).value || 'p1'); if (!v || v === auto) GM_OVR.delete(li.dataset.fid); else GM_OVR.set(li.dataset.fid, v); gmPreview() };
  box.addEventListener('change', e => { if (e.target.classList.contains('gm-k')) apply(e.target) });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('gm-k')) { e.preventDefault(); e.target.blur() } });
  box.addEventListener('click', e => {
    if (e.target.closest('.gm-reset')) { GM_OVR.clear(); gmPreview(); return }
    const li = e.target.closest('li'); if (!li) return;
    const i = gfiles.findIndex(f => gmFid(f) === li.dataset.fid); if (i < 0) return;
    if (e.target.closest('.gm-x')) { gfiles.splice(i, 1); drawFiles(); return }
    const up = e.target.closest('.gm-u'), dn = e.target.closest('.gm-d'); if (!up && !dn) return;
    // swap with the neighbour in the same set
    const sib = (up ? li.previousElementSibling : li.nextElementSibling); if (!sib) return;
    const j = gfiles.findIndex(f => gmFid(f) === sib.dataset.fid); if (j < 0) return;
    [gfiles[i], gfiles[j]] = [gfiles[j], gfiles[i]]; MM.sort = null; drawFiles();
  });
}
async function combine(files, P, out) {
  for (let i = 0; i < files.length; i++) {
    const f = files[i]; P && P(i / files.length, `Adding ${f.name} (${i + 1} of ${files.length})`);
    if (isPdf(f)) { const src = await ldoc(f); (await out.copyPages(src, src.getPageIndices())).forEach(pg => out.addPage(pg)) }
    else await addImagePage(out, f, 'fit', 0);
  }
  return out;
}
function addGroupMergeTool() {
  if (TOOLS.groupmerge) return;
  const M = TOOLS.merge;
  M.n = 'Merge PDF';
  M.d = 'Combine PDFs and pictures into one file, or batch-merge many files by name';
  M.h = 210; M.min = 2;
  M.help = 'Combine: all files become one PDF in the order shown. Batch: files whose names start the same become one PDF each (for example 01_invoice.pdf, 01_receipt.jpg and _01 photo.png become 01.pdf; 02_… files become 02.pdf). Any number of files and pages. Pictures become full pages. Nothing is uploaded.';
  M.opts = [SEL('mode', 'How to merge', [['one', 'Combine into one PDF'], ['batch', 'Batch by file name']]),
    SEL('by', 'Files belong together when', [['p1', 'The first part of the name matches (before _ - or space)'], ['p2', 'The first two parts match (e.g. 01_A)'], ['p3', 'The first three parts match'], ['c2', 'The first 2 characters match'], ['c3', 'The first 3 characters match'], ['c4', 'The first 4 characters match'], ['c6', 'The first 6 characters match']], { show: { mode: 'batch' } })];
  M.run = async (fs, o, P) => {
    if (MM.mode !== 'batch') {
      if (fs.length < 2) throw new UserError('Add at least two files to combine.');
      const out = await combine(fs, P, await newDoc());
      P(1, 'Saving…');
      return [{ name: 'merged.pdf', data: await out.save({ useObjectStreams: true }), note: `${fs.length} files, ${out.getPageCount()} page${out.getPageCount() === 1 ? '' : 's'}.` }];
    }
    const gs = gmGroups(fs, o.by), outs = [], names = new Set(); let done = 0;
    for (const g of gs) {
      const out = await newDoc();
      for (const f of g.files) {
        P(done / fs.length, `Set ${gmFileName(g.label)}: adding ${f.name} (${++done} of ${fs.length})`);
        await combine([f], null, out);
      }
      let nm = gmFileName(g.label), i = 2; while (names.has(nm.toLowerCase())) nm = gmFileName(g.label + ' (' + i++ + ')'); names.add(nm.toLowerCase());
      outs.push({ name: nm, data: await out.save({ useObjectStreams: true }), note: `${g.files.length} file${g.files.length === 1 ? '' : 's'}, ${out.getPageCount()} page${out.getPageCount() === 1 ? '' : 's'}.` });
    }
    return outs;
  };
  // the old "Merge by file name" address opens the same tool in Batch mode (no separate card)
  TOOLS.groupmerge = Object.assign({}, M, { isNew: 0 });
  TI.groupmerge = TI.merge;
  // the result of a batch is one ZIP with a clear name
  const _ready = window.ptResultReady;
  window.ptResultReady = (name, blob) => {
    if (_ready) _ready(name, blob);
    if (isMerge() && /\.zip$/i.test(name) && gout) { gout.name = 'merged-by-name.zip'; setTimeout(() => { $('grname').textContent = gout.name }, 0) }
  };
  const _open = openGeneric;
  openGeneric = function (id) {
    if (id === 'merge' || id === 'groupmerge') { MM.mode = id === 'groupmerge' ? 'batch' : 'one'; MM.sort = 'az'; MM.n = 0; GM_OVR.clear() }
    const r = _open.apply(this, arguments);
    if (id === 'merge' || id === 'groupmerge') { mergeBar(); const sel = $('o_mode'); if (sel) { sel.value = MM.mode; syncOpts() } $('grun').textContent = MM.mode === 'batch' ? 'Merge into sets' : 'Merge files' }
    syncMergeBar();
    return r;
  };
  const _drawFiles = drawFiles;
  drawFiles = function () {
    if (isMerge()) {
      TOOLS[cur].min = MM.mode === 'batch' ? 1 : 2;
      // newly added files take their place in the chosen A→Z / Z→A order
      if (gfiles.length > MM.n && MM.sort) sortFiles(MM.sort);
      MM.n = gfiles.length;
    }
    const r = _drawFiles.apply(this, arguments);
    try { syncMergeBar(); gmPreview() } catch (e) { console.warn(e) }
    return r;
  };
  // dragging or the arrows put files in the user's own order
  $('glist').addEventListener('click', e => { if (isMerge() && e.target.closest('button[data-a="u"],button[data-a="d"]')) MM.sort = null }, true);
  $('glist').addEventListener('drop', () => { if (isMerge()) MM.sort = null }, true);
  $('gopts').addEventListener('change', e => { if (e.target.id === 'o_by') gmPreview(); if (e.target.id === 'o_mode' && e.target.value !== MM.mode) setMergeMode(e.target.value) });
  window.addEventListener('hashchange', () => { if (!isMerge()) { GM_OVR.clear(); gmPreview(); syncMergeBar() } });
}

/* ---------- Edit text: hide the old words with the page's own background, not a white box ---------- */
// Reads the rendered page around the text. A plain background gives an exact colour fill;
// a gradient or pattern gives a small picture of the background with the old letters filled in.
let EDIT_BG = null;
function pageBackground(k, rect) {
  const el = D.els[k], cv = el && el.querySelector('canvas.pc'), p = D.pages[k];
  if (!cv || p.rot) return null;
  const s = D.scale * PX * (cv.width / el.clientWidth);
  const x0 = Math.max(0, Math.floor(rect[0] * s)), y0 = Math.max(0, Math.floor(rect[1] * s));
  const x1 = Math.min(cv.width, Math.ceil((rect[0] + rect[2]) * s)), y1 = Math.min(cv.height, Math.ceil((rect[1] + rect[3]) * s));
  const w = x1 - x0, h = y1 - y0; if (w < 2 || h < 2) return null;
  const m = 4, X0 = Math.max(0, x0 - m), Y0 = Math.max(0, y0 - m), X1 = Math.min(cv.width, x1 + m), Y1 = Math.min(cv.height, y1 + m);
  const W = X1 - X0, H = Y1 - Y0, d = cv.getContext('2d', { willReadFrequently: true }).getImageData(X0, Y0, W, H).data;
  const px = (x, y) => { const i = ((y - Y0) * W + (x - X0)) * 4; return [d[i], d[i + 1], d[i + 2]] };
  const inRect = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  // the most common colour in the ring just outside the text box = the background
  const ring = [], hist = new Map();
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (!inRect(x, y)) { const c = px(x, y); ring.push(c); const q = (c[0] >> 3) + ',' + (c[1] >> 3) + ',' + (c[2] >> 3); hist.set(q, (hist.get(q) || 0) + 1) }
  if (!ring.length) return null;
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(v => +v * 8 + 4);
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const near = ring.filter(c => dist(c, top) < 30);
  const avg = l => [0, 1, 2].map(i => Math.round(l.reduce((t, c) => t + c[i], 0) / l.length));
  const bg = avg(near.length ? near : ring);
  const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  // plain background? (the four sides of the ring all have the same colour)
  const side = f => { const l = []; for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (!inRect(x, y) && f(x, y)) { const c = px(x, y); if (dist(c, bg) < 60) l.push(c) } return l.length ? avg(l) : bg };
  const sides = [side((x) => x < x0), side((x) => x >= x1), side((x, y) => y < y0), side((x, y) => y >= y1)];
  const spread = Math.max(...sides.map(c => dist(c, bg)));
  if (spread <= 9 && near.length > ring.length * .6) return { bg: hex(bg) };
  // gradient or pattern: fill each row from the colours just left and right of the text
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ctx = out.getContext('2d'), img = ctx.createImageData(w, h), o = img.data;
  const lum = c => c[0] * .3 + c[1] * .59 + c[2] * .11, bgL = lum(bg);
  const edge = (y, xs) => { const l = []; for (const x of xs) if (x >= 0 && x < cv.width && x >= X0 && x < X1) { const c = px(x, y); if (Math.abs(lum(c) - bgL) < 70) l.push(c) } return l.length ? avg(l) : null };
  let lastL = bg, lastR = bg;
  for (let y = 0; y < h; y++) {
    const L = edge(y0 + y, [x0 - 1, x0 - 2, x0 - 3]) || lastL, R = edge(y0 + y, [x1, x1 + 1, x1 + 2]) || lastR; lastL = L; lastR = R;
    for (let x = 0; x < w; x++) { const t = w > 1 ? x / (w - 1) : 0, i = (y * w + x) * 4; for (let c = 0; c < 3; c++) o[i + c] = Math.round(L[c] + (R[c] - L[c]) * t); o[i + 3] = 255 }
  }
  ctx.putImageData(img, 0, 0);
  return { bg: hex(bg), img: out.toDataURL('image/png') };
}
function wireEditBackground() {
  const _sample = sampleColor;
  sampleColor = function (k, it) { EDIT_BG = { k, it }; return _sample.apply(this, arguments) };
  const _measure = measure;
  measure = function (o) {
    if (o && o.edit && o.cover && o.bg === undefined && EDIT_BG && EDIT_BG.it && EDIT_BG.it.idx === o.src) {
      try { const r = pageBackground(EDIT_BG.k, o.cover); if (r) { o.bg = r.bg; if (r.img) o.bgImg = r.img } } catch (e) { console.warn('background check failed', e) }
      EDIT_BG = null;
    }
    return _measure.apply(this, arguments);
  };
  const _editText = editText;
  editText = function (k, o) {
    const r = _editText.apply(this, arguments);
    // while typing, show the page behind the box instead of white
    if (o && o.cover) { const ta = D.els[k] && D.els[k].querySelector('textarea.inedit'); if (ta) ta.style.background = 'transparent' }
    return r;
  };
}

/* ---------- Google AdSense: only on the home and tool pages, never in the reader/editor, never for paid users ---------- */
let ADS_LOADED = false, ADS_PUSHED = false;
const adsWanted = () => !!(SET.ads_client && LIC && ME && !['paid', 'admin'].includes(LIC.plan));
function adsCheck() {
  const want = adsWanted(), inReader = document.body.classList.contains('wsmode') || location.hash === '#reader';
  let box = $('adBox');
  if (!want) { if (box) box.hidden = true; return }
  if (!ADS_LOADED && !inReader) {
    ADS_LOADED = true;
    const sc = document.createElement('script'); sc.async = true; sc.crossOrigin = 'anonymous';
    sc.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(SET.ads_client);
    document.head.appendChild(sc);
  }
  if (!SET.ads_slot) return;   // no ad unit yet: the code is only there for Google's site check
  if (!box) {
    box = document.createElement('aside'); box.id = 'adBox'; box.className = 'ad-box'; box.setAttribute('aria-label', 'Advertisement');
    box.innerHTML = '<span class="ad-lbl">Advertisement</span><ins class="adsbygoogle" style="display:block" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    const ins = box.querySelector('ins'); ins.dataset.adClient = SET.ads_client; ins.dataset.adSlot = SET.ads_slot;
    const at = $('seoInfo') || document.querySelector('footer'); at.parentNode.insertBefore(box, at);
  }
  box.hidden = inReader;
  if (!inReader && !ADS_PUSHED) { ADS_PUSHED = true; try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch (e) {} }
}
window.addEventListener('hashchange', () => setTimeout(adsCheck, 0));

/* ---------- saving: stay in the app ---------- */
// Files are saved with the system "Save as" window where the browser has one, so nothing is handed to
// another program. When the work took a while (the browser no longer counts it as the user's click),
// a small "Your file is ready" box asks first, so the save always comes from a click in this app.
const FILE_TYPES = { pdf: 'PDF document', jpg: 'JPG picture', jpeg: 'JPG picture', png: 'PNG picture', webp: 'WebP picture', zip: 'ZIP file', xlsx: 'Excel workbook', csv: 'CSV file', docx: 'Word document', pptx: 'PowerPoint file', txt: 'Text file', html: 'Web page' };
const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const declined = () => { const e = new Error('declined'); e.code = 'declined'; return e };
function wireSaving() {
  const plain = saveBlob;
  async function pickAndSave(name, blob) {
    if (window.showSaveFilePicker && !isPhone() && window.isSecureContext) {
      const ext = (name.split('.').pop() || '').toLowerCase(), mime = (blob.type || mimeOf(name)).split(';')[0];
      let h = null;
      try { h = await window.showSaveFilePicker({ suggestedName: name, types: FILE_TYPES[ext] ? [{ description: FILE_TYPES[ext], accept: { [mime || 'application/octet-stream']: ['.' + ext] } }] : undefined }) }
      catch (e) { if (e && e.name === 'AbortError') throw declined(); h = null }
      if (h) { const w = await h.createWritable(); await w.write(blob); await w.close(); LAST_SAVED = h.name; return }
    }
    LAST_SAVED = name;
    return plain(name, blob);
  }
  window.ptPickAndSave = pickAndSave;
  saveBlob = async function (name, blob) {
    const fresh = !navigator.userActivation || navigator.userActivation.isActive;
    if (fresh) return pickAndSave(name, blob);
    return readyDialog(name, blob, true);
  };
  // a finished tool: show the result with Download / Open buttons (nothing downloads by itself)
  window.ptResultReady = (name, blob) => {
    try { if (typeof gout !== 'undefined' && gout) gout.saved = false } catch (e) {}
  };
  $('gagain').onclick = async () => {
    if (typeof gout === 'undefined' || !gout) return;
    try { await pickAndSave(gout.name, gout.blob); toast('Saved ' + (LAST_SAVED || gout.name) + '.') }
    catch (e) { if (!(e && e.code === 'declined')) toast(errText(e), true) }
  };
}
let LAST_SAVED = '';
function readyDialog(name, blob, mustSave) {
  return new Promise((resolve, reject) => {
    const dlg = document.createElement('dialog'); dlg.className = 'readydlg'; dlg.setAttribute('aria-labelledby', 'rdH');
    const isPdfName = /\.pdf$/i.test(name);
    dlg.innerHTML = `<h3 id="rdH">Your file is ready</h3><p class="rd-f"><b>${esc(name)}</b><span>${esc(fmtSize(blob.size))}</span></p>
<div class="dbar">${isPdfName ? '<button type="button" class="btn2" data-open>Open in AK Smarts PDF</button>' : ''}<button type="button" class="btn2" data-x>Close</button><button type="button" class="btn" data-save>Save</button></div>`;
    document.body.appendChild(dlg);
    let settled = false;
    const end = (ok, err) => { if (settled) return; settled = true; try { dlg.close() } catch (e) {} dlg.remove(); ok ? resolve() : reject(err || declined()) };
    dlg.querySelector('[data-save]').onclick = async () => { try { await window.ptPickAndSave(name, blob); end(true) } catch (e) { if (!(e && e.code === 'declined')) end(false, e) } };
    dlg.querySelector('[data-x]').onclick = () => end(false);
    const op = dlg.querySelector('[data-open]');
    if (op) op.onclick = async () => { end(false); try { await wsOpenBytes(new Uint8Array(await blob.arrayBuffer()), name) } catch (e) { toast(errText(e), true) } };
    dlg.addEventListener('cancel', e => { e.preventDefault(); end(false) });
    dlg.showModal(); dlg.querySelector('[data-save]').focus();
  });
}

/* ---------- hooks into the main app (run once its code is unlocked) ---------- */
function wireMain() {
  wireSaving();
  const _drawGrid = drawGrid;
  drawGrid = function () { _drawGrid(); document.querySelectorAll('#grid a.card').forEach(a => a.classList.toggle('locked', !toolAllowed(a.getAttribute('href').slice(1)))) };
  const _drawRibbon = drawRibbon;
  drawRibbon = function () {
    _drawRibbon();
    setTimeout(fitRibbon, 0);
    if (!roReason()) return;
    document.querySelectorAll('#rbar [data-a]').forEach(b => { if (!actionAllowed(b.dataset.a)) { b.classList.add('ro'); b.title = 'Locked' } });
    document.querySelectorAll('#rtabs [data-rt]').forEach(b => b.classList.toggle('ro', !['home', 'convert'].includes(b.dataset.rt)));
  };
  if (typeof syncProps === 'function') { const _syncProps = syncProps; syncProps = function () { const r = _syncProps.apply(this, arguments); fitRibbon(); return r } }
  const _setTool = setTool;
  setTool = function (t, quiet) { if (roReason() && !['select', 'hand'].includes(t)) t = 'select'; return _setTool(t, quiet) };
  const _wsSave = wsSave;
  wsSave = async function (asDialog) {
    if (isSigned(D)) {
      try { await saveBytes(D.name.replace(/\.pdf$/i, '') + '.pdf', D.sources[0].bytes); toast('Saved an exact copy. The signature stays valid.') }
      catch (e) { toast(e && e.code === 'declined' ? 'Download cancelled.' : errText(e), true) }
      return;
    }
    return _wsSave(asDialog);
  };
  const _switchDoc = switchDoc;
  switchDoc = function (d) { _switchDoc(d); refreshSigUI() };
  const _wsOpenBytes = wsOpenBytes;
  wsOpenBytes = async function (bytes, name, opt = {}) {
    const quick = hasSigQuick(bytes);
    if (quick) opt = { ...opt, rtab: 'home', tool: undefined };
    const doc = await _wsOpenBytes(bytes, name, opt);
    if (quick) { doc.sig = { list: [{ pending: true }], pending: true }; refreshSigUI() }
    try {
      if (quick) { doc.sig = await inspectPdf(doc.sources[0].bytes); if (doc === D) refreshSigUI() }
    } catch (e) { console.warn('signature check failed', e) }
    if (opt.after && !isSigned(doc)) setTimeout(() => startSign(opt.after), 150);
    return doc;
  };
  TI.esign = PATH.esign; TI.dsc = PATH.dsc; TI.verify = PATH.verify;
  TOOLS.esign = { n: 'e-Sign & lock PDF', d: 'Sign electronically (with or without an account) and lock the PDF against changes', cat: 'view', h: 160, isNew: 1, ws: { rtab: 'sign', after: 'esign' }, help: 'Signs with a certificate issued to your account, or with your typed name if you have no account. The signed PDF is certified with “no changes allowed”.' };
  TOOLS.dsc = { n: 'Sign with DSC', d: 'Use your Digital Signature Certificate (.pfx / .p12) and lock the PDF', cat: 'view', h: 280, isNew: 1, ws: { rtab: 'sign', after: 'dsc' }, help: 'Works with Class 2 / Class 3 DSCs exported as .pfx or .p12. The certificate never leaves this computer.' };
  TOOLS.verify = { n: 'Verify signatures', d: 'See who signed a PDF and whether it was changed afterwards', cat: 'sec', h: 140, isNew: 1, ws: { rtab: 'home' }, help: 'Opens the PDF read-only and shows the signature status at the top.' };
  ORDER.splice(ORDER.indexOf('sign') + 1, 0, 'esign', 'dsc'); ORDER.push('verify');
  addImageAndCompressTools();
  addGroupMergeTool();
  if (window.PTRename) PTRename.add();
  if (window.PTNew) try { PTNew.add() } catch (e) { console.error('new tools', e) } // v1.2 tools; a problem here must never stop the rest of the app
  if (window.PTRibbon) try { PTRibbon.add() } catch (e) { console.error('ribbon', e) } // v1.3 tools ribbon; never allowed to stop the app
  wireEditBackground();
  PTTextEdit.wire();
  const sgi = RIB.sign.it, pi = sgi.indexOf('P');
  sgi.splice(pi > 0 && sgi[pi - 1] === '|' ? pi - 1 : sgi.length, 0, '|', ['esign', 'e-Sign & lock', PATH.esign], ['dsc', 'DSC sign', PATH.dsc], ['sigver', 'Signatures', PATH.verify]);
  RIB.home.it.push(['sigver', 'Signatures', PATH.verify]);
  const _wsAction = wsAction;
  wsAction = async function (a, btn) {
    if (a === 'esign' || a === 'dsc') return startSign(a);
    if (a === 'sigver') return showSigDetails();
    if (a === 'full') return toggleFull();
    return _wsAction(a, btn);
  };
  wireRibbonControls();
  drawGrid();

  /* ---------- about text ---------- */
  try {
    const ab = $('about').querySelector('p');
    ab.textContent = 'Your PDFs are opened, edited and converted on this computer and are never uploaded. e-Sign sends only the document’s fingerprint to the server to be signed (with your account certificate, or with your typed name if you sign without an account); DSC signing happens entirely on this computer.';
    const abh = $('abh'); abh.innerHTML = '<img src="/icons/icon-64.png" alt="" width="40" height="40" class="ab-logo">About ' + esc((SET && SET.app_name) || 'AK Smarts PDF');
    const abl = $('about').querySelector('p.lbl');
    if (abl && !$('about').querySelector('.ab-links')) abl.insertAdjacentHTML('beforebegin', '<p class="ab-links"><a href="/privacy" target="_blank">Privacy</a> · <a href="/terms" target="_blank">Terms</a> · <a href="/licence" target="_blank">Licence</a> · <a href="/disclaimer" target="_blank">Disclaimer</a> · <a href="/contact" target="_blank">Contact &amp; support</a></p>');
    document.querySelector('footer .in span').textContent = 'AK Smarts PDF · Files are processed on your device.';
    const fin = document.querySelector('footer .in');
    if (fin && fin.lastElementChild && !fin.querySelector('.pp-link')) fin.lastElementChild.insertAdjacentHTML('beforeend', '<a class="pp-link" href="/privacy">Privacy</a><a class="pp-link" href="/terms">Terms</a><a class="pp-link" href="/refund-policy">Refunds</a><a class="pp-link" href="/disclaimer">Disclaimer</a><a class="pp-link" href="/contact">Contact</a>');
    document.querySelector('header .pill').lastChild.textContent = 'Files stay on this device';
  } catch (e) {}
  // usage counting (no file contents, only what kind of thing was done)
  const _open2 = wsOpenBytes;
  wsOpenBytes = async function (bytes, name, opt) { track('open'); return _open2(bytes, name, opt) };
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (MAIN && TOOLS[id]) track('tool', id) });
  $('grun').addEventListener('click', () => track('tool', 'run:' + cur), true);
  for (const n of PRE) LOADED[n] = 1;
  // the page was opened straight on a tool (for example /compress-pdf): draw it again with the changes above
  const h0 = location.hash.slice(1);
  if (TOOLS[h0] && !TOOLS[h0].ws) setTimeout(() => { try { cur = null } catch (e) {} route() }, 0);
}

/* ---------- files chosen on a search page (/compress-pdf …): open the tool with them ---------- */
let HANDOFF_DONE = false;
async function takeHandoff() {
  if (HANDOFF_DONE || !MAIN || !READY) return; HANDOFF_DONE = true;
  if (SS_get('pt-handoff') !== '1' || !('caches' in window)) return;
  SS_set('pt-handoff', '');
  try {
    const c = await caches.open('pt-handoff'), fs = [];
    const reqs = await c.keys();
    for (const req of reqs) { const r = await c.match(req); const b = await r.blob(); fs.push([+(r.headers.get('x-order') || 0), new File([b], decodeURIComponent(r.headers.get('x-name') || 'file'), { type: b.type || r.headers.get('content-type') || '' })]); await c.delete(req) }
    const files = fs.sort((a, b) => a[0] - b[0]).map(x => x[1]);
    if (!files.length) return;
    const id = location.hash.slice(1), t = TOOLS[id];
    const give = (inputId, list) => { const inp = $(inputId); if (!inp) return false; const dt = new DataTransfer(); list.forEach(f => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event('change')); return true };
    await new Promise(r => setTimeout(r, 60)); // let the tool's page draw first
    if (!t || id === 'reader') { wsOpenFiles(files); return }
    // options chosen by the page (e.g. JPG to PNG picks PNG)
    let opts = null; try { opts = JSON.parse(SS_get('pt-handoff-opts') || 'null') } catch (e) {} SS_set('pt-handoff-opts', '');
    if (opts) for (const [k, v] of Object.entries(opts)) { const el = $('o_' + k); if (el && [...el.options || []].some(o => o.value === v)) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) } }
    if (t.ws) { await wsOpenFiles(files, t.ws); return }
    if (t.special === 'pcmp') { give('kfA', files.slice(0, 1)); if (files[1]) give('kfB', files.slice(1, 2)); return }
    if (!give(t.special === 'pc' ? 'cf' : t.special ? '' : 'gf', t.multi || t.special === 'pc' ? files : files.slice(0, 1))) wsOpenFiles(files);
  } catch (e) { console.warn('handoff', e) }
}

/* ---------- open PDFs handed over by the operating system ---------- */
// Double-clicking a PDF (or "Open with AK Smarts PDF") opens it straight in the Reader, like other PDF apps.
// Until the app has started, the files wait here. They are also kept in the browser's storage, so they
// still open if the page has to reload once while starting (for example right after an update).
const INBOX = 'pt-incoming';
async function stashIncoming(files) {
  if (!('caches' in window)) return;
  try { const c = await caches.open(INBOX); let i = 0; for (const f of files) await c.put('/incoming/' + Date.now() + '-' + (i++), new Response(f, { headers: { 'content-type': f.type || 'application/pdf', 'x-name': encodeURIComponent(f.name || 'document.pdf') } })) } catch (e) { console.warn('stash', e) }
}
async function takeStashed() {
  if (!('caches' in window)) return [];
  try {
    const c = await caches.open(INBOX), out = [];
    for (const req of await c.keys()) { const r = await c.match(req); if (r) { const b = await r.blob(); out.push(new File([b], decodeURIComponent(r.headers.get('x-name') || 'document.pdf'), { type: b.type || 'application/pdf' })) } await c.delete(req) }
    return out;
  } catch (e) { return [] }
}
function openIncoming(files) {
  files = files.filter(Boolean); if (!files.length) return;
  if (!READY) {
    PENDING.push(...files); stashIncoming(files);
    try { const t = $('gWaitText'); if (t && !$('gWait').hidden) t.textContent = 'Opening ' + files[0].name + '…'; else gNote('Sign in to open ' + files[0].name + '.') } catch (e) {}
    return;
  }
  if (location.hash !== '#reader') location.hash = 'reader';
  wsOpenFiles(files);
}
// called when the app is ready: files that arrived before (in this page or before a reload)
async function openWaiting() {
  const now = PENDING.splice(0), stashed = await takeStashed();
  const seen = new Set(now.map(f => f.name + '|' + f.size));
  const all = now.concat(stashed.filter(f => !seen.has(f.name + '|' + f.size)));
  if (all.length) { if (location.hash !== '#reader') location.hash = 'reader'; wsOpenFiles(all) }
}
if ('launchQueue' in window) launchQueue.setConsumer(async p => {
  const fs = []; for (const h of p.files || []) { try { fs.push(await h.getFile()) } catch (e) {} }
  if (fs.length) openIncoming(fs);
});
// PDFs shared to the installed app from another app on a phone (Android share sheet)
if (/[?&]shared=1/.test(location.search) && 'caches' in window) (async () => {
  try {
    const c = await caches.open('pt-share'); const fs = [];
    for (const req of await c.keys()) { const r = await c.match(req); const b = await r.blob(); fs.push(new File([b], decodeURIComponent(r.headers.get('x-name') || 'shared.pdf'), { type: 'application/pdf' })); await c.delete(req) }
    history.replaceState(null, '', location.pathname + location.hash);
    if (fs.length) openIncoming(fs);
  } catch (e) { console.warn('share', e) }
})();
if (window.pdfDesktop && window.pdfDesktop.onOpenFile) window.pdfDesktop.onOpenFile((name, data) => openIncoming([new File([data], name, { type: 'application/pdf' })]));
// the installed app was started by double-clicking a PDF: show that while it starts
if (/^\/open/.test(location.pathname)) try { $('gWaitText').textContent = 'Opening your PDF…' } catch (e) {}
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('/sw.js').catch(e => console.warn('service worker', e));

if (MAIN) wireMain();
boot();
})();
