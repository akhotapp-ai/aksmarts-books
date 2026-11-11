/* PDF signature helpers (CMS / PKCS#7 detached), shared by the server and the browser app.
   Works with node-forge. Only the document's SHA-256 fingerprint is needed to sign, never the file. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.PdfCms = factory;
})(typeof self !== 'undefined' ? self : this, function (forge) {
  const asn1 = forge.asn1, pki = forge.pki;
  const U = asn1.Class.UNIVERSAL, C = asn1.Class.CONTEXT_SPECIFIC, T = asn1.Type;
  const OID = {
    data: '1.2.840.113549.1.7.1', signedData: '1.2.840.113549.1.7.2',
    contentType: '1.2.840.113549.1.9.3', messageDigest: '1.2.840.113549.1.9.4', signingTime: '1.2.840.113549.1.9.5',
    sha1: '1.3.14.3.2.26', sha256: '2.16.840.1.101.3.4.2.1', sha384: '2.16.840.1.101.3.4.2.2', sha512: '2.16.840.1.101.3.4.2.3',
    rsa: '1.2.840.113549.1.1.1', sha256rsa: '1.2.840.113549.1.1.11'
  };
  const MD = { [OID.sha1]: 'sha1', [OID.sha256]: 'sha256', [OID.sha384]: 'sha384', [OID.sha512]: 'sha512' };
  const oid = o => asn1.create(U, T.OID, false, asn1.oidToDer(o).getBytes());
  const algId = o => asn1.create(U, T.SEQUENCE, true, [oid(o), asn1.create(U, T.NULL, false, '')]);
  const der = node => asn1.toDer(node).getBytes();
  const toBin = d => typeof d === 'string' ? d : String.fromCharCode.apply(null, Array.from(d));

  // Strict RSA PKCS#1 v1.5 check: rebuild the exact expected block and compare every byte
  // (avoids the lenient parsing in node-forge's own verify, GHSA-86w9-cpqp-85rv).
  function strictVerify(publicKey, digestBytes, sig, mdName) {
    const o = OID[mdName] || (forge.oids && forge.oids[mdName]);
    if (!o || !publicKey || !publicKey.n) return false;
    const k = Math.ceil(publicKey.n.bitLength() / 8);
    if (typeof sig !== 'string' || sig.length !== k) return false;
    let em;
    try { em = pki.rsa.decrypt(sig, publicKey, true, false); } catch (e) { return false; }
    const di = withNull => der(asn1.create(U, T.SEQUENCE, true, [asn1.create(U, T.SEQUENCE, true, [oid(o)].concat(withNull ? [asn1.create(U, T.NULL, false, '')] : [])), asn1.create(U, T.OCTETSTRING, false, digestBytes)]));
    const block = d => k < d.length + 11 ? null : '\x00\x01' + '\xff'.repeat(k - d.length - 3) + '\x00' + d;
    return [block(di(true)), block(di(false))].some(b => b !== null && b === em);
  }
  // is this certificate signed by the given issuer certificate? (strict, see above)
  function certSignedBy(cert, issuer) {
    try {
      if (!issuer.subject || cert.issuer.hash !== issuer.subject.hash) return false;
      const m = /^(sha1|sha256|sha384|sha512)WithRSAEncryption$/.exec(forge.oids[cert.signatureOid] || '');
      if (!m) return false;
      const md = forge.md[m[1]].create();
      md.update(der(cert.tbsCertificate || pki.getTBSCertificate(cert)));
      return strictVerify(issuer.publicKey, md.digest().getBytes(), cert.signature, m[1]);
    } catch (e) { return false; }
  }

  function tbsParts(cert) {
    const tbs = cert.tbsCertificate || pki.getTBSCertificate(cert);
    const i = tbs.value[0].tagClass === C ? 1 : 0; // skip optional [0] version
    return { serial: tbs.value[i], issuer: tbs.value[i + 2] };
  }

  function attr(type, valueNode) {
    return asn1.create(U, T.SEQUENCE, true, [oid(type), asn1.create(U, T.SET, true, [valueNode])]);
  }

  /** Build a detached CMS SignedData for a PDF.
   *  digest: SHA-256 of the PDF's signed byte ranges (binary string or Uint8Array)
   *  certs:  [signerCert, ...chain] as forge certificates
   *  key:    forge RSA private key of the signer
   *  returns DER as a binary string */
  function buildSignedData({ digest, certs, key, time }) {
    if (!key || typeof key.sign !== 'function' || !key.n) throw new Error('Only RSA keys are supported for signing.');
    const signer = certs[0];
    const attrs = [
      attr(OID.contentType, oid(OID.data)),
      attr(OID.signingTime, asn1.create(U, T.UTCTIME, false, asn1.dateToUtcTime(time || new Date()))),
      attr(OID.messageDigest, asn1.create(U, T.OCTETSTRING, false, toBin(digest)))
    ].map(a => ({ a, d: der(a) })).sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0)).map(x => x.a); // DER SET OF order
    const md = forge.md.sha256.create();
    md.update(der(asn1.create(U, T.SET, true, attrs)));
    const signature = key.sign(md);
    const { serial, issuer } = tbsParts(signer);
    const signerInfo = asn1.create(U, T.SEQUENCE, true, [
      asn1.create(U, T.INTEGER, false, asn1.integerToDer(1).getBytes()),
      asn1.create(U, T.SEQUENCE, true, [issuer, serial]),
      algId(OID.sha256),
      asn1.create(C, 0, true, attrs),
      algId(OID.rsa),
      asn1.create(U, T.OCTETSTRING, false, signature)
    ]);
    const signedData = asn1.create(U, T.SEQUENCE, true, [
      asn1.create(U, T.INTEGER, false, asn1.integerToDer(1).getBytes()),
      asn1.create(U, T.SET, true, [algId(OID.sha256)]),
      asn1.create(U, T.SEQUENCE, true, [oid(OID.data)]),
      asn1.create(C, 0, true, certs.map(c => pki.certificateToAsn1(c))),
      asn1.create(U, T.SET, true, [signerInfo])
    ]);
    return der(asn1.create(U, T.SEQUENCE, true, [oid(OID.signedData), asn1.create(C, 0, true, [signedData])]));
  }

  function cnOf(nameAttrs) {
    const get = s => (nameAttrs.find(a => a.shortName === s || a.name === s) || {}).value;
    return get('CN') || get('commonName') || get('O') || get('E') || '';
  }

  /** Read and check a CMS signature taken from a PDF.
   *  Returns { ok, signer, issuer, org, email, time, alg, messageDigest(hex), certValidTo, selfIssued, error } */
  function inspect(cmsBin) {
    const out = { ok: false };
    try {
      const ci = asn1.fromDer(cmsBin, { parseAllBytes: false });
      const sd = ci.value[1].value[0];
      const certsNode = sd.value.find(n => n.tagClass === C && n.type === 0);
      const si = sd.value[sd.value.length - 1].value[0];
      const digestAlg = asn1.derToOid(si.value[2].value[0].value);
      out.alg = MD[digestAlg] || digestAlg;
      const sattrs = si.value.find(n => n.tagClass === C && n.type === 0);
      const sigNode = si.value.find(n => n.tagClass === U && n.type === T.OCTETSTRING);
      const sid = si.value[1];
      if (sattrs) for (const a of sattrs.value) {
        const t = asn1.derToOid(a.value[0].value), v = a.value[1].value[0];
        if (t === OID.messageDigest) out.messageDigest = forge.util.bytesToHex(v.value);
        if (t === OID.signingTime) out.time = v.type === T.UTCTIME ? asn1.utcTimeToDate(v.value) : asn1.generalizedTimeToDate(v.value);
      }
      const certs = [];
      for (const n of (certsNode ? certsNode.value : [])) {
        try { certs.push(pki.certificateFromAsn1(n)); } catch (e) { certs.push(null); }
      }
      // pick the signer certificate by serial number
      let cert = null;
      if (sid.type === T.SEQUENCE) {
        const ser = forge.util.bytesToHex(sid.value[1].value).replace(/^00/, '').toLowerCase();
        cert = certs.find(c => c && c.serialNumber.replace(/^00/, '').toLowerCase() === ser) || null;
      }
      cert = cert || certs.find(Boolean) || null;
      if (!cert) { out.error = 'This signature uses a certificate type this app can’t read.'; return out; }
      out.cert = cert;
      out.signer = cnOf(cert.subject.attributes);
      out.org = (cert.subject.getField('O') || {}).value || '';
      out.unit = (cert.subject.getField('OU') || {}).value || '';
      out.email = (cert.subject.getField('E') || {}).value || '';
      out.issuer = cnOf(cert.issuer.attributes);
      out.certValidTo = cert.validity.notAfter;
      out.certValidFrom = cert.validity.notBefore;
      out.issuerHash = cert.issuer.hash;
      out.serial = cert.serialNumber;
      out.certs = certs.filter(Boolean);
      if (!sattrs) { out.error = 'Signatures without signed attributes are not supported.'; return out; }
      const set = asn1.create(U, T.SET, true, sattrs.value);
      const md = forge.md[MD[digestAlg]] && forge.md[MD[digestAlg]].create();
      if (!md) { out.error = 'Unsupported digest algorithm.'; return out; }
      md.update(der(set));
      try { out.ok = strictVerify(cert.publicKey, md.digest().getBytes(), sigNode.value, MD[digestAlg]); }
      catch (e) { out.error = 'The signature could not be checked (' + e.message + ').'; }
    } catch (e) {
      out.error = 'The signature data is damaged.';
    }
    return out;
  }

  return { buildSignedData, inspect, OID, strictVerify, certSignedBy };
});
