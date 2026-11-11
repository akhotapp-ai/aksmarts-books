'use strict';
// The app's own e-Sign certificate authority. Each user gets a personal signing certificate issued by it.
// Keys never leave the server; user keys are stored encrypted with the server secret.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');
const { db, DATA_DIR, getSetting } = require('./db');

const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = Buffer.from(fs.readFileSync(SECRET_FILE, 'utf8').trim(), 'hex');

function seal(text) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', SECRET, iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}
function unseal(s) {
  const [iv, tag, enc] = s.split('.').map(x => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', SECRET, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

const rsaPair = () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privPem: privateKey.export({ type: 'pkcs1', format: 'pem' }),
    pub: forge.pki.publicKeyFromPem(publicKey.export({ type: 'spki', format: 'pem' }))
  };
};
const serial = () => '01' + crypto.randomBytes(15).toString('hex');

const CA_FILE = path.join(DATA_DIR, 'esign-ca.json');
function loadCA() {
  if (fs.existsSync(CA_FILE)) {
    const j = JSON.parse(fs.readFileSync(CA_FILE, 'utf8'));
    return { cert: forge.pki.certificateFromPem(j.cert), key: forge.pki.privateKeyFromPem(unseal(j.key)), pem: j.cert };
  }
  const { privPem, pub } = rsaPair();
  const key = forge.pki.privateKeyFromPem(privPem);
  const cert = forge.pki.createCertificate();
  cert.publicKey = pub; cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 86400e3);
  cert.validity.notAfter = new Date(Date.now() + 20 * 365 * 86400e3);
  const name = [{ name: 'commonName', value: (getSetting('app_name') || 'AK Smarts PDF') + ' e-Sign Root CA' }, { name: 'organizationName', value: getSetting('app_name') || 'AK Smarts PDF' }];
  cert.setSubject(name); cert.setIssuer(name);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' }
  ]);
  cert.sign(key, forge.md.sha256.create());
  const pem = forge.pki.certificateToPem(cert);
  fs.writeFileSync(CA_FILE, JSON.stringify({ cert: pem, key: seal(privPem) }), { mode: 0o600 });
  return { cert, key, pem };
}
const CA = loadCA();

/** Get (or issue) the signing certificate for a user. */
function userSigner(user) {
  const row = db.prepare('SELECT * FROM esign_certs WHERE user_id=?').get(user.id);
  if (row) {
    const cert = forge.pki.certificateFromPem(row.cert_pem);
    const cn = (cert.subject.getField('CN') || {}).value;
    if (cert.validity.notAfter > new Date() && cn === user.name) return { cert, key: forge.pki.privateKeyFromPem(unseal(row.key_enc)) };
  }
  const { privPem, pub } = rsaPair();
  const cert = forge.pki.createCertificate();
  cert.publicKey = pub; cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 3600e3);
  cert.validity.notAfter = new Date(Date.now() + 2 * 365 * 86400e3);
  const realEmail = !/@phone\.invalid$/.test(user.email); // accounts made with only a mobile number have no email
  cert.setSubject([
    { name: 'commonName', value: user.name },
    ...(realEmail ? [{ name: 'emailAddress', value: user.email }] : []),
    { name: 'organizationName', value: (getSetting('app_name') || 'AK Smarts PDF') + ' e-Sign' }
  ]);
  cert.setIssuer(CA.cert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, critical: true },
    ...(realEmail ? [{ name: 'subjectAltName', altNames: [{ type: 1, value: user.email }] }] : []),
    { name: 'subjectKeyIdentifier' }
  ]);
  cert.sign(CA.key, forge.md.sha256.create());
  const certPem = forge.pki.certificateToPem(cert);
  db.prepare('INSERT INTO esign_certs(user_id,cert_pem,key_enc,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET cert_pem=excluded.cert_pem,key_enc=excluded.key_enc,created_at=excluded.created_at')
    .run(user.id, certPem, seal(privPem), Date.now());
  return { cert, key: forge.pki.privateKeyFromPem(privPem) };
}

/** A one-time certificate for someone signing without an account. The name is typed by the signer and
 *  is not verified, which the certificate says. The key is used once and never stored. */
function guestSigner(name) {
  const { privPem, pub } = rsaPair();
  const cert = forge.pki.createCertificate();
  cert.publicKey = pub; cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 3600e3);
  cert.validity.notAfter = new Date(Date.now() + 2 * 365 * 86400e3);
  cert.setSubject([
    { name: 'commonName', value: name },
    { name: 'organizationalUnitName', value: 'Signed without an account (name not verified)' },
    { name: 'organizationName', value: (getSetting('app_name') || 'AK Smarts PDF') + ' e-Sign' }
  ]);
  cert.setIssuer(CA.cert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, critical: true },
    { name: 'subjectKeyIdentifier' }
  ]);
  cert.sign(CA.key, forge.md.sha256.create());
  return { cert, key: forge.pki.privateKeyFromPem(privPem) };
}

module.exports = { CA, userSigner, guestSigner, seal, unseal };
