// Legal pages: privacy, terms, licence (EULA), refunds, cookies, disclaimer, contact.
// Owner details come from the admin console (Rules → Legal details). Empty details show a
// highlighted placeholder so it's obvious what still needs filling in.
// These are templates written for a small Indian software business; have a lawyer review them.
const UPDATED = '26 October 2026';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PAGES = {
  privacy: { path: '/privacy', title: 'Privacy Policy' },
  terms: { path: '/terms', title: 'Terms & Conditions' },
  eula: { path: '/licence', title: 'Software Licence (EULA)' },
  refund: { path: '/refund-policy', title: 'Refund & Cancellation Policy' },
  cookies: { path: '/cookies', title: 'Cookie Notice' },
  disclaimer: { path: '/disclaimer', title: 'Disclaimer' },
  contact: { path: '/contact', title: 'Contact Us' }
};
const ALIASES = { '/privacy-policy': '/privacy', '/terms-and-conditions': '/terms', '/tos': '/terms', '/eula': '/licence', '/license': '/licence', '/refund': '/refund-policy', '/cancellation-policy': '/refund-policy', '/cookie-policy': '/cookies' };

function details(get) {
  const ph = t => `<mark class="ph">[${t}]</mark>`;
  const v = k => String(get(k) || '').trim();
  const app = esc(v('app_name') || 'AK Smarts PDF'), owner = esc(v('legal_owner') || 'AK Smarts');
  const email = v('legal_email') || v('support_email');
  return {
    app, owner,
    email: email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : ph('contact email: Admin → Rules → Legal details'),
    address: v('legal_address') ? esc(v('legal_address')).replace(/\n/g, '<br>') : ph('Business address: Admin → Rules → Legal details'),
    place: v('legal_jurisdiction') ? esc(v('legal_jurisdiction')) : ph('City, State, e.g. Bengaluru, Karnataka'),
    grievance: v('legal_grievance') ? esc(v('legal_grievance')) : owner,
    refundDays: Math.max(0, parseInt(v('legal_refund_days'), 10) || 7),
    price: v('show_price') === '1' ? esc(v('price_text') || '') : '',
    ads: !!get('__ads')
  };
}

const body = {
  privacy: d => `
<p>This policy explains what personal data ${d.app} (“the app”), provided by <b>${d.owner}</b> (“we”, “us”), collects, why, and your rights. It is written to meet India’s <b>Digital Personal Data Protection Act, 2023</b> (DPDP Act), the <b>Information Technology Act, 2000</b> and its rules, and the basic principles of the EU <b>GDPR</b> for visitors from Europe.</p>
<h2>1. Your documents stay on your device</h2>
<p>PDFs, pictures and other files you open, edit, convert, compress, merge or sign are processed <b>inside your own browser or the installed app on your device</b>. They are <b>not uploaded</b> to our servers, and we cannot see, read or store them.</p>
<p>For <b>e-Sign</b>, only a short fingerprint of the document (a SHA-256 hash, from which the document cannot be rebuilt) is sent to our server to be signed with the certificate issued to your account (or, if you sign without an account, with a one-time certificate carrying the name you type). For <b>DSC signing</b>, your certificate and private key stay on your device; we only record that a signature was made.</p>
<h2>2. What we collect</h2>
<ul>
<li><b>Account data</b> (if you create an account): your name, email address, a one-way scrambled (hashed) password, account role and creation date.</li>
<li><b>Licence and payment records</b>: your plan, trial and licence dates, licence keys you activate. If you pay online, the payment is handled by our payment provider (for example Razorpay); we receive the payment status and reference, never your full card or bank details.</li>
<li><b>Signature log</b>: for each e-Sign or DSC signature, the date and time, file name, document fingerprint, signer name and IP address. This lets you and us prove when a signature was made.</li>
<li><b>Device and security data</b>: a random device number stored in your browser, browser type, IP address, sign-in times and active sessions. We use this to run licences (device limits), prevent abuse and keep accounts safe.</li>
<li><b>Usage statistics</b>: visits and which tools are used. We never record file names or file contents in these statistics.</li>
<li><b>Messages</b> you send us (for example by email).</li>
</ul>
<h2>3. Why we use it (purpose and legal basis)</h2>
<ul>
<li>To provide the app, your account, licences and e-Sign (performance of our agreement with you; your consent under the DPDP Act when you sign up).</li>
<li>To secure the service, prevent fraud and misuse, and keep signature records (legitimate use and legal obligations).</li>
<li>To improve the app using anonymous or aggregated statistics.</li>
<li>To meet legal requirements, for example responding to lawful requests from authorities.</li>
</ul>
<p>We do <b>not sell</b> your personal data and do not use your documents for any purpose.</p>
<h2>4. Advertising</h2>
<p>${d.ads ? 'Free users may see ads on the home and tool pages, served by Google AdSense. Google and its partners may use cookies to show ads based on your visits to this and other websites. You can turn off personalised ads at <a href="https://adssettings.google.com">Google Ad Settings</a>. See <a href="https://policies.google.com/technologies/ads">how Google uses information from sites that use its services</a>. Ads are never shown inside the reader or editor, and paid users do not see ads.' : 'The app does not currently show ads. If ads are added later (for free users only), this section and the Cookie Notice will be updated first.'}</p>
<h2>5. Who we share it with</h2>
<p>Only with service providers that help us run the app, under contracts that protect your data: hosting (for example Render), database hosting (for example Neon), email delivery, the payment provider and, if ads are on, Google. Some providers may store data outside India; where they do, we use providers with appropriate safeguards and comply with any restrictions notified by the Government of India.</p>
<h2>6. How long we keep it</h2>
<ul>
<li>Account and licence data: while your account is active, and up to 3 years after it is closed, for accounting, tax and dispute purposes.</li>
<li>Signature log: up to 8 years, because signed documents may need to be proven later.</li>
<li>Security logs and usage statistics: up to 1 year.</li>
</ul>
<h2>7. Your rights</h2>
<p>Under the DPDP Act (and GDPR where it applies) you can: get a summary of the personal data we hold about you; ask us to correct or complete it; ask us to erase it (subject to records we must keep by law); withdraw consent (this may end your account); nominate another person to exercise your rights in case of death or incapacity; and file a grievance with us and, if not resolved, with the <b>Data Protection Board of India</b> (or your local data protection authority in the EU). Email ${d.email} to use any of these rights. We reply within 30 days.</p>
<h2>8. Security</h2>
<p>We use HTTPS encryption, hashed passwords, optional 2-step login for administrators, strict browser security settings and access limits. No system is perfectly secure; if a personal data breach affects you, we will inform you and the Data Protection Board as the law requires.</p>
<h2>9. Children</h2>
<p>The app is not meant for children under 18. We do not knowingly collect data of children without verifiable parental consent. If you believe a child has given us data, contact us and we will delete it.</p>
<h2>10. Grievance Officer</h2>
<p>In line with the IT Act, 2000 and the IT Rules, our Grievance Officer is <b>${d.grievance}</b>, ${d.owner}, ${d.address}. Email: ${d.email}. We acknowledge complaints within 24 hours and aim to resolve them within 15 days.</p>
<h2>11. Changes</h2>
<p>We may update this policy. The date at the top shows the latest version. Important changes will be shown in the app before they apply.</p>`,

  terms: d => `
<p>These Terms &amp; Conditions (“Terms”) are an agreement between you and <b>${d.owner}</b> (“we”, “us”) for the use of ${d.app}: the website, the web app, the installed (PWA) app, the desktop app and related services (together, “the Service”). By creating an account, buying a licence or using the Service, you agree to these Terms, the <a href="/privacy">Privacy Policy</a>, the <a href="/licence">Software Licence</a> and the <a href="/disclaimer">Disclaimer</a>. If you do not agree, do not use the Service.</p>
<h2>1. Who can use it</h2>
<p>You must be at least 18 years old and able to enter a binding contract under Indian law. If you use the Service for a company, you confirm that you may accept these Terms for it.</p>
<h2>2. Your account</h2>
<p>Give true details, keep your password secret and tell us at once at ${d.email} if you think your account has been misused. You are responsible for everything done through your account. One account is for one person; licences may limit how many devices can be used at once.</p>
<h2>3. Free use, trials and paid licences</h2>
<ul>
<li>Some features may be free, sometimes only for a limited time. A free trial gives full access for the period shown in the app.</li>
<li>A paid licence gives access for the period bought${d.price ? ` (currently ${d.price})` : ''}. Prices include or exclude GST as shown at checkout.</li>
<li>When a trial or licence ends, the app may continue as a free reader or may be locked, as shown in the app.</li>
<li>Licence keys are personal and must not be sold, shared or published.</li>
<li>Refunds follow our <a href="/refund-policy">Refund &amp; Cancellation Policy</a>.</li>
</ul>
<h2>4. Acceptable use</h2>
<p>You agree <b>not</b> to use the Service to:</p>
<ul>
<li>forge, falsify or alter any document so that it misleads anyone, including government, court, bank, tax, education, property, identity or medical documents, certificates, stamps or signatures;</li>
<li>sign a document in someone else’s name or without their authority, or use another person’s Digital Signature Certificate;</li>
<li>process content you have no right to use, or content that is illegal, defamatory, obscene, or infringes copyright, trademarks or privacy;</li>
<li>remove passwords or restrictions from documents you are not authorised to unlock;</li>
<li>break, overload, probe or bypass the security, licensing or code protection of the Service, or copy, resell or redistribute the app;</li>
<li>break any law, including the IT Act, 2000, the Bharatiya Nyaya Sanhita, 2023 and the DPDP Act, 2023.</li>
</ul>
<p>We may suspend or close accounts that break these rules, and we may report unlawful activity to the authorities.</p>
<h2>5. Your documents and content</h2>
<p>Your files remain yours. They are processed on your device, and you are solely responsible for their content, for keeping backup copies, and for how you use the results. Always check converted, compressed or edited files before relying on them.</p>
<h2>6. Electronic signatures</h2>
<p>Read the <a href="/disclaimer">Disclaimer</a> on the legal effect of e-Sign and DSC signatures. You are responsible for choosing the right type of signature for each document and for having the authority to sign it.</p>
<h2>7. Our rights</h2>
<p>The Service, its software, design, name and logo belong to ${d.owner} and are protected by copyright and trademark law. Apart from the licence in the <a href="/licence">Software Licence</a>, no rights are given to you.</p>
<h2>8. Availability and changes</h2>
<p>We work to keep the Service running, but it may sometimes be unavailable, for example during maintenance or because of our hosting providers. We may change, add or remove features. We will give reasonable notice of changes that reduce what a paid licence includes.</p>
<h2>9. No warranty</h2>
<p>The Service is provided “as is” and “as available”. To the extent the law allows, we do not promise that it will be error-free, uninterrupted, or that every file will convert perfectly.</p>
<h2>10. Limitation of liability</h2>
<p>To the extent the law allows, we are not liable for indirect or consequential losses, lost profits, lost data or business interruption. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim. Nothing in these Terms limits liability that cannot be limited under Indian law.</p>
<h2>11. Indemnity</h2>
<p>You agree to compensate us for claims and costs arising from your breach of these Terms, your documents, or your unlawful use of the Service.</p>
<h2>12. Ending the agreement</h2>
<p>You can stop using the Service and ask us to close your account at any time. We may suspend or end your access if you break these Terms or the law. Sections that by their nature should continue (for example 5, 7, 9, 10, 11 and 13) continue after the end.</p>
<h2>13. Law and disputes</h2>
<p>These Terms are governed by the laws of India. We will first try to settle any dispute informally; write to ${d.email}. If it is not settled within 30 days, the courts at <b>${d.place}</b> have exclusive jurisdiction. Consumers keep any rights they have under the Consumer Protection Act, 2019.</p>
<h2>14. Contact</h2>
<p>${d.owner}, ${d.address}. Email: ${d.email}.</p>`,

  eula: d => `
<p>This End User Licence Agreement (“Licence”) applies to the ${d.app} software in every form: the web app, the installed (PWA) app and the desktop app for Windows, macOS or Linux (“the Software”). It is part of the <a href="/terms">Terms &amp; Conditions</a>. By installing or using the Software you accept it.</p>
<h2>1. Licence granted</h2>
<p>${d.owner} gives you a personal, non-exclusive, non-transferable, revocable licence to install and use the Software on devices you own or control, for the period of your free access, trial or paid licence, and within the device limit of your plan.</p>
<h2>2. What you may not do</h2>
<ul>
<li>copy, sell, rent, lend, sublicense or distribute the Software, or offer it as a service to others;</li>
<li>decompile, decrypt, reverse engineer or modify it, or bypass its licence checks or code protection, except where the law expressly allows this;</li>
<li>remove copyright, trademark or other notices;</li>
<li>use it to break the law or the acceptable-use rules in the Terms.</li>
</ul>
<h2>3. Third-party components</h2>
<p>The Software includes open-source components (for example PDF.js, pdf-lib, node-forge, Tesseract and others) used under their own licences, such as Apache-2.0, MIT and BSD. Those licences apply to those components and are not limited by this Licence.</p>
<h2>4. Updates and online checks</h2>
<p>The Software may update itself and checks your account and licence online when it starts. Some versions may work offline for a limited number of days, as set by us.</p>
<h2>5. Ownership</h2>
<p>The Software is licensed, not sold. ${d.owner} keeps all rights, title and interest in it.</p>
<h2>6. Ending</h2>
<p>This Licence ends automatically when your access or licence ends, or if you break it. You must then stop using the Software and uninstall it.</p>
<h2>7. Warranty and liability</h2>
<p>The “No warranty” and “Limitation of liability” sections of the <a href="/terms">Terms</a> apply to the Software.</p>
<h2>8. Law</h2>
<p>This Licence is governed by the laws of India, with the courts at <b>${d.place}</b> having jurisdiction.</p>`,

  refund: d => `
<p>This policy explains cancellations and refunds for paid ${d.app} licences bought from <b>${d.owner}</b>, including payments made through Razorpay or another payment provider.</p>
<h2>1. Try before you buy</h2>
<p>Where a free period or free trial is offered, please use it to check that the app works for you before buying.</p>
<h2>2. Refunds</h2>
<ul>
<li><b>Within ${d.refundDays} days</b> of your first purchase of a licence, you can ask for a full refund if the app does not work as described and we cannot fix the problem. Email ${d.email} with your account email and payment reference.</li>
<li>Payments charged twice or by mistake are always refunded in full.</li>
<li>After ${d.refundDays} days, payments are non-refundable, except where the law requires otherwise.</li>
<li>Licences cancelled by us for breaking the <a href="/terms">Terms</a> are not refunded.</li>
</ul>
<h2>3. How refunds are paid</h2>
<p>Approved refunds are returned to the original payment method within 5–7 working days after approval. Your bank may take a few more days to show it. When a refund is made, the licence it paid for ends.</p>
<h2>4. Cancelling</h2>
<p>Licences are paid in advance for a fixed period and do not renew automatically unless you chose a subscription at checkout. You can cancel a subscription at any time by emailing ${d.email}; it then stops renewing and stays active until the end of the period already paid.</p>
<h2>5. Licence keys</h2>
<p>Licence keys that have already been activated cannot be returned or exchanged, except under section 2.</p>
<h2>6. Contact</h2>
<p>${d.owner}, ${d.address}. Email: ${d.email}.</p>`,

  cookies: d => `
<p>This notice explains how ${d.app} uses cookies and similar storage in your browser.</p>
<h2>1. Strictly necessary</h2>
<ul>
<li><b>pt_session</b> (cookie, up to 30 days): keeps you signed in. Secure, HTTP-only, not readable by other sites.</li>
<li><b>Local storage</b>: a random device number, your licence check for offline use, display settings (for example the ribbon layout and dark mode), saved signatures you choose to keep, and app files cached by the service worker so the app opens quickly and works offline.</li>
</ul>
<p>These are needed for the app to work and cannot be switched off in the app. You can delete them in your browser settings; you will then be signed out.</p>
<h2>2. Advertising</h2>
<p>${d.ads ? 'For free users, the home and tool pages may load Google AdSense, which uses cookies to show and measure ads, and may personalise ads. Manage this at <a href="https://adssettings.google.com">Google Ad Settings</a>. Visitors from the EU/UK are asked for consent first. Paid users do not load ad cookies.' : 'We do not currently use advertising cookies.'}</p>
<h2>3. No tracking of your documents</h2>
<p>Cookies and storage never contain the content of your documents.</p>
<p>Questions: ${d.email}.</p>`,

  disclaimer: d => `
<h2>1. Not legal advice</h2>
<p>${d.app} is a software tool. Nothing in the app or on this website is legal, tax or professional advice. For important documents, ask a qualified professional.</p>
<h2>2. e-Sign and DSC signatures under Indian law</h2>
<ul>
<li><b>DSC signing</b> uses your own Digital Signature Certificate issued by a Certifying Authority licensed by the Controller of Certifying Authorities (CCA). Such a signature is a “digital signature” under <b>Section 3 of the Information Technology Act, 2000</b>, and under Section 5 it has the same legal recognition as a handwritten signature, subject to the Act.</li>
<li><b>e-Sign in this app</b> signs with a certificate issued by ${d.app}’s own signing service. It is <b>not</b> Aadhaar eSign and not issued by a CCA-licensed Certifying Authority. It is an electronic signature that proves who signed through their account, when, and that the document has not been changed since. If you e-Sign <b>without an account</b>, the signature carries only the name you typed, marked as <b>not verified</b>, so it proves when the document was signed and that it has not changed, but not who signed it. Typing someone else’s name is forgery and is prohibited. It is suitable for everyday agreements, approvals, invoices and internal documents, but it may <b>not</b> be accepted where the law or an authority requires a DSC or Aadhaar eSign (for example many government, tax, company law, court and tender filings).</li>
<li>Some documents cannot be signed electronically at all under the First Schedule of the IT Act, for example negotiable instruments other than cheques, powers of attorney, trusts, wills and contracts for the sale or conveyance of immovable property.</li>
<li>Whether a signature is accepted is decided by the person, court or authority receiving it. Check their requirements before signing.</li>
</ul>
<h2>3. Your responsibility for documents</h2>
<p>You alone are responsible for the documents you open, edit, sign or create, and for having the right to do so. Editing tools (edit text, white-out, redact, stamps and signatures) must <b>never</b> be used to forge, falsify or alter official, financial, legal or identity documents, or to sign for another person. Doing so may be a crime under the Bharatiya Nyaya Sanhita, 2023 and the IT Act, 2000. We will co-operate with lawful requests from authorities.</p>
<h2>4. Accuracy of results</h2>
<p>Conversions, OCR (text recognition), compression and redaction are done automatically and may not be perfect. Always check the result. Redaction removes the hidden text where possible, but you must check that private information is really removed before sharing.</p>
<h2>5. Third-party services and links</h2>
<p>We are not responsible for websites, services or ads run by others that the app links to or shows.</p>`,

  contact: d => `
<p>We’re happy to help with questions, licences, refunds, privacy requests and problems.</p>
<div class="card"><p><b>${d.owner}</b><br>${d.address}</p>
<p>Email: ${d.email}</p>
<p>Grievance Officer (IT Act and DPDP Act): ${d.grievance}, at the email above.</p></div>
<h2>When you write to us</h2>
<ul><li>Use the email address of your account, if you have one.</li><li>For payments, include the payment reference.</li><li>Never send us your passwords, licence keys in public, or your DSC files.</li></ul>
<p>We usually reply within 1–2 working days. Privacy requests are answered within 30 days, and grievances are acknowledged within 24 hours.</p>
<p>See also: <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms &amp; Conditions</a> · <a href="/refund-policy">Refund Policy</a></p>`
};

const nav = () => Object.values(PAGES).map(p => `<a href="${p.path}">${esc(p.title)}</a>`).join('');

function render(key, get) {
  const p = PAGES[key], d = details(get);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} · ${d.app}</title><meta name="description" content="${esc(p.title)} of ${d.app}, by ${d.owner}."><link rel="icon" href="/favicon.ico"><meta name="theme-color" content="#145447">
<style>
:root{--ink:#17262a;--muted:#5b6b6e;--accent:#1d6b59;--rule:#dfe7e5;--bg:#f4f7f6;--card:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#e6eeec;--muted:#a3b3b0;--accent:#6fd0b4;--rule:#2b3a38;--bg:#0f1716;--card:#16201f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{background:linear-gradient(120deg,#0c332d,#1d6b59);color:#fff}header .in{max-width:860px;margin:0 auto;padding:14px 18px;display:flex;align-items:center;gap:10px}
header a{color:#fff;text-decoration:none;font-weight:600;display:flex;align-items:center;gap:10px}header img{width:32px;height:32px;border-radius:8px}
main{max-width:860px;margin:0 auto;padding:24px 18px 40px}.doc{background:var(--card);border:1px solid var(--rule);border-radius:14px;padding:clamp(18px,4vw,36px)}
h1{font-size:clamp(1.5rem,4vw,2rem);margin:0 0 4px;letter-spacing:-.01em}.upd{color:var(--muted);font-size:.88rem;margin:0 0 20px}
h2{font-size:1.1rem;margin:26px 0 6px}p,li{color:var(--ink)}ul{padding-left:22px}a{color:var(--accent)}
mark.ph{background:#fff1c2;color:#6b4e00;border-radius:4px;padding:0 4px}
.card{border:1px solid var(--rule);border-radius:12px;padding:6px 16px;margin:12px 0}
nav.legal{display:flex;flex-wrap:wrap;gap:8px 16px;margin:22px 0 0;font-size:.9rem}footer{color:var(--muted);font-size:.85rem;text-align:center;padding:0 18px 30px}
</style></head><body>
<header><div class="in"><a href="/"><img src="/icons/icon-128.png" alt="">${d.app}</a></div></header>
<main><article class="doc"><h1>${esc(p.title)}</h1><p class="upd">Last updated: ${UPDATED}</p>${body[key](d)}</article>
<nav class="legal" aria-label="Legal">${nav()}</nav></main>
<footer>© ${new Date().getFullYear()} ${d.owner}. All rights reserved.</footer>
</body></html>`;
}

module.exports = { PAGES, ALIASES, render, UPDATED };
