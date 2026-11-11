# AK Smarts PDF

Your PDF Tools app, now called **AK Smarts PDF** with your icon, extended into a complete PDF product:

- **Sign-up and log-in** screens before the app opens.
- **Free trial + paid licence**, with an **admin console** where you decide the trial length, how many trials are given, and can cancel one trial or all trials at any time.
- **e-Sign** (a digital signature tied to the user's account) and **DSC signing** (the user's own Digital Signature Certificate, `.pfx` / `.p12`). Both **certify the PDF with "no changes allowed"**, the standard *Certify* option. Signed PDFs open read-only in this app, and other PDF readers show any later change as breaking the signature.
- **Free for everyone for the first 3 months** (on by default): no sign-up needed, every tool works. You can end it, extend it or change the date any time from the admin console.
- **Works on computers and phones**: in any browser, installable on Android, iPhone, Windows and Mac with your icon.
- **Visitor statistics**: how many computers use the app with and without an account, daily activity, PDFs opened and the most used tools.
- **Code lock**: the app's code is sent encrypted and only unlocks after your server lets the person in, so a saved or copied page doesn't work on its own.
- **Opens PDFs directly with a double-click**: install it as an app from Chrome/Edge, or build the Windows installer in `desktop/`. Then double-click any PDF.

### New in version 1.3: Excel-style tools ribbon

On laptop and desktop screens (900 px and wider) the home page and every tool page now have a ribbon like Excel's, with **11 tabs**: Home, Sign & Fill, Merge & Split, Pages, Convert, Scan & OCR, Optimize, Security, Page design, Compare & Info, Help. Each tool has one home, in a labelled group with a big icon. Split PDF opens a small menu (Split PDF, Split PDF by size).

- **Search:** "Tell me what you want to do…" finds any tool; arrow keys and Enter work.
- **Keyboard:** Left/Right/Home/End move between tabs, Escape closes a menu.
- **Collapse** hides the buttons, **Classic view** switches the ribbon off (a *Show the tools ribbon* link appears in the footer). Both are remembered on that device.
- **Phones** keep the card layout. The Reader & Editor keeps its own ribbon.
- **Safety net:** a tool that is not named in the ribbon is still shown, in a *More* group on the closest tab.
- **Help tab:** Quick guide (opens About & help), Keyboard shortcuts, What's new, and *Contact support*. The last one appears only when you set **`SUPPORT_CONTACT`** (an email address or a web address, such as a WhatsApp link) in Render's environment variables.
- Code: `src/ribbon.js` and the end of `src/addon.css`. The Google pages are unchanged.

### Fix 1.2.3: fits every screen

- **Reader:** *Automatic* zoom used to stop at 125%, so on a Full HD screen the page used only 59% of the width (27% on a very large screen). It now fits the width of the window, up to 240%. Small screens behave as before. Measured at 1024, 1280, 1366, 1440, 1536, 1920 and 2560 pixels wide: the page fills 94% to 98% of the width up to 1920 and 82% at 2560, follows window resizing, and nothing scrolls sideways.
- **Home and tool pages:** the content column was fixed at 1180 px. It now widens to 1400 px (from 1500 px screens), 1680 px (from 1900) and 2000 px (from 2400). Change the numbers at the end of `src/addon.css`.
- The code is in `src/newtools.js` (`addScreenFit`) and `src/addon.css`; the protected main script is not touched.

### Fix 1.2.3: fits every screen

- **Reader:** *Automatic* zoom now fits the window width (up to 240%). It used to stop at 125%, so a Full HD screen showed the page in a narrow column (59% of the width, 27% on a very large screen). It is now 94 to 97% of the width from 1024 px to 1920 px wide, and follows the window when it is resized. Small screens are unchanged. Code: `addScreenFit()` in `src/newtools.js`.
- **Home and tool pages:** the content column was a fixed 1180 px. On wide screens it is now 1400 px (from 1500 px wide), 1680 px (from 1900 px) and 2000 px (from 2400 px). Code: end of `src/addon.css`.
- **Desktop app:** the window used to open at a fixed 1360 x 900, which is taller than a 1366 x 768 laptop, so the bottom bar was cut off. It now fits the usable screen, opens maximized the first time, and remembers its size. Code: `desktop/main.js` (needs a new installer).

### Fix 1.2.1: sharper pages in the reader (HD)

The reader drew each page at one pixel per screen pixel on normal screens, and at most twice on dense screens, so text looked soft on laptops with Windows display scaling (125% or 150%) and on phones. Pages are now drawn at least 2x (up to 3x on dense phone screens). Measured detail: 1.25x → 2x on a 125% screen, 2x → 3x on a 3x phone. Phones keep a smaller memory limit for very large zoom. The change is one line in `original/PDF-Tools.html` (`renderPg`), with the page's security hash updated to match.

### New in version 1.2

Six additions. All of them work on the user's device and upload nothing.

- **Split PDF by size** (`/split-pdf-by-size`): parts under 500 KB, 1 MB, 2 MB, 5 MB, 10 MB or a size you type. Each part is saved and measured, so it really is under the limit. A page that is bigger on its own is reported.
- **Remove blank pages** (`/remove-blank-pages-from-pdf`): looks at how each page really appears. *Standard* ignores dust and tiny marks and keeps a page with only a page number, *Careful* keeps any small mark, *Strict* also removes pages with only a page number. The result lists the removed pages; the original is never changed.
- **Image to text (OCR)** (`/image-to-text`): one or many pictures to a text file, a Word file or a searchable PDF (English).
- **Scan to PDF** (`/scan-to-pdf`): on a phone, *Take a photo* opens the camera for each page; photos can also be added. Each page is cleaned like a scanner would (black and white, grey or colour), the table around the paper is trimmed when it is clear, and the pages become one PDF. It does not correct perspective yet.
- **Stamps and QR code** (`/stamp-pdf`): PAID, RECEIVED, APPROVED, REJECTED, CONFIDENTIAL, DRAFT, COPY or your own text (English letters), with an optional date, or a QR code (up to about 200 characters). Choose position, size, colour and pages. The QR code was checked to scan correctly.
- **Autosave and recover:** while a document has unsaved changes, a copy is kept on that device every 30 seconds. After a crash or a closed tab, the app offers to restore it. The copy is removed when the document is saved or closed on purpose, after 7 days, or when the user deletes it or turns autosave off (the box has a *Turn off autosave on this device* link). Nothing leaves the device.

Each new tool has its own Google page (55 pages in all). The code is in `src/newtools.js`; the page texts are in `server/seo-content.js`.

**The app builds itself on GitHub.** `.github/workflows/build-app.yml` runs `npm run build` whenever you upload changes to `src/`, `original/`, `build/` or `server/cms.js`, and saves the new `public/app.html` into your repository, so Render updates your website. You can also run it by hand: *Actions → Build app → Run workflow*. No Node.js is needed on your computer.

### Fix 1.1.1: DSC signing

- **"Maximum call stack size exceeded" fixed.** The certificate file was read in one go, so any large file (for example a PDF chosen by mistake) crashed the signer. It is now read in small pieces.
- **Clear messages.** Choosing a PDF, a .cer/.crt (no private key), an image, an empty or oversized file now says exactly what to choose instead. A wrong password says so in plain words, and the dialog no longer shows technical text.
- **Easier to use.** The certificate is checked as soon as you pick it and while you type the password, there is a *Show password* box, and the help text says which file to choose.
- **`public/app.html` is generated from `src/`.** You don't need Node.js on your computer: the workflow `.github/workflows/build-app.yml` (*Actions → Build web app → Run workflow*) builds it on GitHub and saves `public/app.html` and `public/sw.js` into the repository, and Render redeploys. It also runs by itself whenever `src/`, `original/` or `build/` change. Until it has run, the old app is still served.

### New in version 1.1

- **Much stronger compression.** Compress PDF and Compress image now have real levels (Light 90% quality, Recommended, Strong, Extreme) plus **"Must be smaller than"** (for example 2 MB, 1 MB, 500 KB, 200 KB, 100 KB, 50 KB) for upload limits on government and job portals. Pictures inside PDFs are re-saved, duplicated pictures are stored once, and scanned PDFs can be turned into lighter page pictures that keep searchable text. Several files can be compressed at once.
- **Editable text, like other PDF editors.** Text you add can be changed any time: double-click it, click it again, press Enter, or use the small *Edit text* button above it. *Edit text* now picks whole words and lines on any PDF. Scanned pages, and PDFs whose letters are stored in a hidden code (like many EPFO passbooks), get a **"Make the text editable (OCR)"** button. Hindi and Kannada can be typed into PDFs. Text you add or change stays editable after the PDF is saved and opened again: it looks like normal page text, and *Edit text* changes it (other PDF readers simply show the text). When you change words that were already in the PDF, saving takes the old letters out of the page (they can't be copied or found any more) and, when the page's own font has all the letters, writes the new words in that same font. Text inside unusual fonts or form objects keeps the older method (covered with a matching patch). The file's properties still record that it was edited, and digitally signed PDFs show that the signature no longer matches.
- **Opens PDFs like a PDF reader.** "Open with → AK Smarts PDF" (installed app or Windows desktop app) opens the file straight in the reader, even when the app is still starting or you are asked to sign in first. The Windows installer registers a PDF file icon and appears in *Default apps*.
- **One Merge PDF tool** with two modes side by side: *Combine into one PDF* (default) and *Batch by file name* (`01_invoice.pdf + 01_receipt.jpg + _01 photo.png → 01.pdf`, `02_… → 02.pdf`), with **A→Z / Z→A** sorting and ↑ ↓ arrows to put files in any order.
- **Results stay in the app.** After a tool finishes you get *Download* and *Open in AK Smarts PDF* buttons; nothing is downloaded automatically, so the browser no longer jumps to another PDF program. Download asks where to save (on computers).
- **Bulk rename PDFs** (next to Merge PDF). Add the PDFs and an Excel/CSV list (column A = the number in the file name, column B = the new name). `001.pdf`, `Scan_001.pdf` and `1.pdf` all match row 001, or match *by order*. A preview shows old name → new name with warnings (no matching row, row without a PDF, empty new name, the same new name twice → `_1`, `_2` or stop, characters not allowed in file names removed, names kept to 35 letters). You get a ZIP with the renamed PDFs and `rename-log.csv` (old → new); on computers you can also save them straight into a folder. Your original files are never changed.
- **PDF names to Excel** (in the same tool). No list yet? Add the PDFs and press **Get PDF names as Excel**: column A = the number from each name, column B = empty for the new names, column C = the current name. Fill in column B, add the file back, and press *Rename PDFs*.
- **Sign up and log in with your email or mobile number and a password.** No text messages (SMS) are sent, so there is no SMS cost. **2-step login with Google Authenticator** (free): anyone can turn it on in *Your account*, so nobody can get in with the password alone. **Forgot password?** emails a code to set a new password (a mobile number can be typed too; the code goes to the account's email). See section 6d.
- **Price hidden for now.** The price is not shown anywhere until you tick *Admin console → Rules → Show the price to users*.
- **New icon** everywhere (app, browser tab, phone home screen, desktop app, PDF file icon, share image).
- **Security fixes:** updated the signing library (node-forge 1.4.2), safer desktop app (no navigation to other sites, no extra permissions, links open in the browser), account-takeover protection for mobile/email changes, and more (section 6c).

All PDF work (editing, converting, signing with DSC) still happens on the user's computer. Files are never uploaded. The server only handles accounts, licences and e-Sign.

---

## 1. Run it on your computer (5 minutes)

You need **Node.js 22.13 or newer** (https://nodejs.org).

```bash
npm install
npm run create-admin -- you@yourcompany.com YourStrongPassword "Your Name"
npm start
```

Open **http://localhost:8080**. Log in with the admin account you just created. Open **http://localhost:8080/admin** for the admin console (or click your name in the app, then **Admin panel**).

`public/app.html` is already built. If you change anything in `src/` or replace `original/PDF-Tools.html` with a newer version of your app, run `npm run build` again and **restart the server**. Each build gets a new code-lock key, so old saved copies stop working.

## 2. Put it online for free

You need three free accounts: **GitHub** (to hold the code), **Neon** (the database) and **Render** (runs the app). No card is needed for GitHub or Neon. Render may ask for a card to confirm who you are, but the free plan costs nothing.

**Why not Netlify?** Netlify only hosts plain pages. This app needs a running server and a database for accounts, licences and e-Sign.

### Step 1: put the code on GitHub
1. Make a free account at https://github.com and click **New repository**. Name it `aksmarts-pdf` and choose **Private**.
2. On the new repository page, click **uploading an existing file** and drag in everything from this folder (not the `node_modules` or `data` folders). Click **Commit changes**.

### Step 2: make the free database (Neon)
1. Sign up at https://neon.tech (the free plan has 0.5 GB, plenty for this app).
2. Create a project (any name; pick the region **Asia Pacific (Singapore)** for India).
3. Click **Connect** and copy the **connection string**. It looks like `postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`. Keep it secret: it's the key to your data.

### Step 3: run the app (Render)
1. Sign up at https://render.com with your GitHub account.
2. Click **New → Blueprint**, pick your `aksmarts-pdf` repository, and click **Apply**. Render reads `render.yaml`.
3. It asks for the settings:
   - `DATABASE_URL`: the Neon connection string from step 2
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: your owner login (created on the first start)
   - the `SMTP_…` ones are optional (email alerts, section 6b); leave them empty for now
4. Wait for **Live** (about 3–5 minutes). Your app is at **https://aksmarts-pdf.onrender.com** (Render shows the exact address at the top; if the name is taken it adds a few letters). This free address works on computers and phones, and can be installed as an app. No domain needed.
5. Open it, log in with your owner email and password, and go to `/admin` → **Security** to turn on 2-step login.

**How the free plan behaves**
- After **15 minutes with no visitors**, Render puts the app to sleep. The next visitor waits about 30–60 seconds while it wakes up; after that it's fast. To avoid this, make a free job at https://cron-job.org that opens `https://aksmarts-pdf.onrender.com/api/config` every 10 minutes. Render's free 750 hours a month is enough to stay awake all month.
- Render's own disk is wiped on every restart, so the app saves its data (users, licences, trials, settings, visitor counts, the free-period date, 2-step login, the e-Sign and licence keys) to your Neon database within 3 seconds of any change, and loads it back on start. **Don't delete the Neon project.** Neon also keeps backups (free plan: about 1 day of history).
- There's no command line on the free plan, so use settings instead: `ADMIN_EMAIL` + `ADMIN_PASSWORD` create the owner account, and if you lose your phone and backup codes, add the setting `RESET_2FA` = your email, let it restart, log in, then remove the setting.
- Updating the app: upload the changed files to GitHub; Render rebuilds by itself.

**Your own domain:** see section 4c, *Connect your domain*.

### Other places it runs
Any server with Node.js 22.13+ works: a VPS (`npm install`, `npm start`), Docker (included), Railway, Fly.io. Without `DATABASE_URL` the data is kept in the `data` folder, which must then be on a disk that survives restarts.

| Setting | What it does |
|---|---|
| `DATABASE_URL` | Free Postgres (Neon / Supabase) that keeps the data when the host's disk is wiped |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Creates the owner account on first start |
| `PORT` | Port to listen on (default 8080) |
| `DATA_DIR` | Working folder for the database and keys (default `./data`) |
| `TRUST_PROXY=1` | Set when running behind Render, Nginx, Cloudflare, etc. |
| `PUBLIC_URL` | Your web address, e.g. `https://pdf.aksmarts.com`: used in Google links and the sitemap, and http / onrender.com visits forward to it |
| `COMPANY_URL`, `COMPANY_NAME` | Optional: your company site (e.g. `https://aksmarts.com`, `AK Smarts`), shown as the publisher and linked in the footer |
| `CANONICAL_REDIRECT=0` | Optional: stop forwarding other addresses to `PUBLIC_URL` |
| `ADSENSE_CLIENT` | Your Google AdSense publisher ID, `ca-pub-…` (optional; empty = no ads). See section 4e |
| `ADSENSE_SLOT` | The ad unit ID from AdSense (optional, after approval) |
| `SIGNUP_MAX_PER_HOUR` | Most new accounts per hour for the whole site (optional, default 100) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email alerts (section 6b) |
| `GOOGLE_SITE_VERIFICATION` | The code from Google Search Console's "HTML tag" check (you can paste the whole `<meta …>` tag) |
| `RESET_2FA` | An email address: switches off its 2-step login on start (remove afterwards) |

## 3. Opening PDFs directly with a double-click

**Option A: install from the browser (no extra work).** Open your site in Chrome or Edge and click the install icon in the address bar (or the download icon in the app's header). The app gets its own window, Start-menu entry and taskbar icon. Then right-click any PDF, choose **Open with**, pick **AK Smarts PDF** and tick **Always use this app**. PDFs now open straight into the reader.

**Option B: a real Windows installer (`.exe`).** In the `desktop/` folder:

1. Put your website address in `desktop/config.json` (`"appUrl": "https://pdf.yourcompany.com"`).
2. On a Windows PC: `npm install` and then `npm run dist`.
3. You get `desktop/dist/AKSmartsPDF-Setup-1.1.0.exe`. It installs the app, registers it for `.pdf` files with its own PDF file icon, and lists it under *Settings > Apps > Default apps*. Users then pick it once: right-click a PDF → *Open with* → *Choose another app* → **AK Smarts PDF** → *Always* (Windows doesn't let any app make itself the default without asking).

**No Windows PC at hand?** Put the project on GitHub. The workflow `.github/workflows/desktop-installer.yml` builds the installer on GitHub's own Windows computers: GitHub → *Actions* → *Desktop installer* → *Run workflow*, then download the `.exe` from the finished run.

When a PDF is opened, the desktop app opens it in the reader, shows a "Save" dialog for downloads (it never hands the file to another PDF program), and shows a friendly page if the internet is down.

The desktop app is a window around your website, so every update you deploy reaches desktop users automatically. Use `npm run dist:mac` on a Mac for a `.dmg`. For a Windows installer without "unknown publisher" warnings, buy a code-signing certificate and add it to electron-builder.

## 4. Free period for everyone (first 3 months)

When the server starts for the first time, a **free period of 3 months** starts automatically (the end date is fixed on that first start).

- **During the free period** anyone can use every tool without signing up. People who do create an account also get everything free; their normal free trial (14 days by default) starts only **after** the free period ends, so it isn't wasted. e-Sign needs an account (a signature must carry a verified name); DSC signing works without one.
- **The banner** shows "Free until 26 Jan 2027" (your date) with a *Create free account* button.
- **When the date passes** it ends by itself: people without an account are asked to sign up; accounts without a licence move to their free trial, then to reader mode (or locked, your choice) when the trial ends.
- **Your controls** (admin console → *Overview*): **End free period now**, **Change end date** (make it longer or shorter, or leave it empty for no end date), and **Start a free period** again later. The same settings are under *Trial & licence rules*, plus: free days per computer (0 = the whole period) and "every tool" vs "reading and printing only".
- **Visitors tab:** for each computer: first and last visit, number of visits, PDFs opened, whether it has an account. You can **end free access for one computer** or **block** a computer completely.

How visitors are counted: each browser or installed app gets an anonymous ID the first time it opens the app. Only the kind of action is sent (visit, PDF opened, tool used), never file names or contents. One person on two computers counts as two, and clearing the browser data makes a new ID.

## 4b. Phones and the web

The same address works everywhere. Nothing extra to build for phones.

| Where | How people get it |
|---|---|
| Any browser (computer or phone) | Just open your site, e.g. `https://pdf.yourcompany.com` |
| Android | Open the site in Chrome → menu ⋮ → **Install app** (or *Add to Home screen*). It gets the AK Smarts icon, opens full screen, and appears in Android's **Share** menu, so a PDF from WhatsApp, Gmail or Files can be shared straight into it. |
| iPhone / iPad | Open the site in Safari → **Share** → **Add to Home Screen**. It opens full screen with your icon. (Apple doesn't let web apps appear in the Share menu; people use the app's *Open* button.) |
| Windows / Mac | Chrome or Edge → install icon in the address bar, or the `.exe` from `desktop/` (section 3). |

The screens fit phones (checked on Pixel 7 and iPhone 13 sizes). Large jobs such as OCR or converting big files are slower on phones because all work happens on the device.

**Publishing in the Google Play Store** (optional): wrap the site with Google's free *Bubblewrap* / PWABuilder tool (pwabuilder.com → enter your address → Android package). It reuses this app as-is. A Google Play developer account costs a one-time US$25. Apple's App Store needs a Mac and a US$99/year account and usually wants more native features, so the home-screen install is the simple route on iPhone.

## 4c. Google: tool pages, your domain and Search Console

**How the pages work.** Every tool has its own light, fast page for Google, like iLovePDF: `/compress-pdf`, `/pdf-to-excel`, `/pdf-to-word`, `/merge-pdf`, `/jpg-to-pdf`, `/compress-image` … (45 in total). Each page is about 6 KB (the full app is about 4 MB), so it opens instantly on phones, which Google rewards. When the visitor chooses a file, the full app opens at `/app` straight in that tool with the file already added. The home page `/` and `/tools` (all tools) are light pages too; the installed app and the desktop app open `/app` directly.

Each page has: a title and description written for what people search (e.g. *Compress PDF Online Free – Reduce PDF Size (100KB, 200KB)*), one heading, 350–500 words of help, steps, features, questions and answers, links to related tools, and structured data that Google reads (app, how-to, FAQ, breadcrumbs). The words are in `server/seo-content.js`; change them there. When you edit that file, change `UPDATED` at the top so the sitemap tells Google.

**Hindi and Kannada.** The 10 most-searched tools also have Hindi (`/hi/compress-pdf`) and Kannada (`/kn/compress-pdf`) pages, linked to the English page so Google shows each person their language. The text is in `server/seo-i18n.js`; the tool itself opens in English. Have a native speaker read them once.

**Also built in:** `sitemap.xml` (every page, with dates and language links), `robots.txt`, share previews with your logo for WhatsApp/Facebook/X, a proper *Page not found* (status 404), tidy addresses (`/Compress-PDF/` → `/compress-pdf`), and `/app` kept out of Google.

### Connect your domain: the PDF app at pdf.aksmarts.com
The PDF app lives on its own subdomain, **pdf.aksmarts.com**, so **aksmarts.com** stays free for your company home page that links to all your apps (see *More apps later* below).

1. Render → your service → **Settings → Custom Domains** → add `pdf.aksmarts.com`.
2. At the company where you bought the domain, open **DNS settings** and add the record Render shows: a **CNAME** record, name/host `pdf`, value `aksmarts-pdf.onrender.com` (your Render address). Don't touch the records for `aksmarts.com` or `www`.
3. Wait until Render shows it as **Verified** with a certificate (minutes to a few hours). Open https://pdf.aksmarts.com to check.
4. Render → **Environment** → add `PUBLIC_URL` = `https://pdf.aksmarts.com` and `COMPANY_URL` = `https://aksmarts.com` → Save. From then on `http://` and the onrender.com address forward (301) to `https://pdf.aksmarts.com`, so Google sees one site, and the pages name AK Smarts as the company with a "More apps" link. (If you need the old address to stay as it is, add `CANONICAL_REDIRECT` = `0`.)
5. Update the keep-awake job at cron-job.org to `https://pdf.aksmarts.com/api/config`. `desktop/config.json` already points to `https://pdf.aksmarts.com`.

### More apps later (aksmarts.com)
- **One subdomain per app:** `pdf.aksmarts.com`, then for example `invoice.aksmarts.com`, `gst.aksmarts.com`. Each app is its own Render service with its own `PUBLIC_URL`, so one app's update or outage never affects another, and Google ranks each app's pages on their own.
- **Company home page at aksmarts.com:** a small, fast page with your logo, one card per app, About, Contact and the legal links. It can be hosted free (Render *Static Site*, GitHub Pages or Cloudflare Pages). Point `aksmarts.com` (A record) and `www` (CNAME) to wherever it is hosted, and make www forward to aksmarts.com there.
- **Same brand everywhere:** reuse the logo, colours and the footer ("More apps from AK Smarts"), and keep the legal pages consistent (same owner, email and grievance officer).
- **Google:** add each subdomain as its own property in Search Console (or add one **Domain** property for `aksmarts.com`, verified once by a DNS TXT record, which covers every subdomain). Link the company page to each app and each app back to the company page.
- **Shared login (only if you need it):** keeping separate accounts per app is simplest. If you later want one AK Smarts account for every app, make a small login service at `account.aksmarts.com` and let the apps trust it; plan that before the second app launches.

### Get into Google
1. Open https://search.google.com/search-console → **Add property** → **URL prefix** → `https://pdf.aksmarts.com`.
2. Choose **HTML tag**, copy the tag, and add it in Render → Environment as `GOOGLE_SITE_VERIFICATION`. Save, wait for the redeploy, then click **Verify**.
3. **Sitemaps** → type `sitemap.xml` → Submit.
4. **URL inspection** → paste `https://pdf.aksmarts.com/compress-pdf` → **Request indexing**. Do the same for your 10 most important pages (one a day is fine).
5. Optional: Bing Webmaster Tools → **Import from Google Search Console** (also covers Yahoo and DuckDuckGo).

**What to expect.** New pages usually appear in Google within a few days to a few weeks. Ranking on the first page for big words like "compress pdf" or "pdf to excel" takes months, because large sites already rank there, and nobody can guarantee it. What helps most: other websites linking to yours (blogs, CA/office groups, college groups, your business listing), people using and sharing it, and longer, specific searches first ("bank statement pdf to excel", "compress pdf to 100kb"). Check Search Console every week: **Performance** shows which searches bring visitors.

- While the free period is on, titles say "Free". When it ends, "Free" is removed automatically.
- Search-engine robots are not counted as visitors.
- To add a tool page: one line in `server/seo.js` and its text in `server/seo-content.js`.

## 4d. Your icon

Your logo is `brand/AK_Smarts_PDF_Tool.png` (the full picture with the name). For small sizes, where the name can't be read, the app uses the same picture without the name text (`brand/AK_Smarts_PDF_icon.png`, made by `python3 build/icon-notext.py`).

- **Full logo with the name:** the start-up splash screen, the social share image (`public/icons/og-image.png`, shown when a link is shared on WhatsApp, Facebook, LinkedIn or X), the desktop app's large icon, and `public/icons/logo-256.png` / `logo-512.png`.
- **Logo without the name:** browser tab (`favicon.ico`), app header, sign-in screen, admin console, legal pages, phone home screen, Android adaptive icon, Apple touch icon, small Windows icon sizes and the PDF file icon.

To change the logo, replace `brand/AK_Smarts_PDF_Tool.png` and run `python3 build/icon-notext.py` then `python3 build/icons.py` (needs Pillow). If your new logo has a different layout, adjust the two boxes at the top of `build/icon-notext.py`.

## 4e. Google AdSense ads

Ads are off until you add your AdSense ID. When on, they appear **only on the home page and the tool pages**, never in the reader or editor and never over a document, and **never for paid users** (or admins). The owner can switch them off any time in the admin console → Rules → *Ads*.

1. Your site must be live on **your own domain** (AdSense doesn't accept `onrender.com` addresses), with `PUBLIC_URL` set.
2. Go to **adsense.google.com** → sign up with your Google account → add your site (e.g. `aksmarts.in`).
3. Copy your publisher ID (`ca-pub-1234567890123456`) and add it in Render → Environment as `ADSENSE_CLIENT`. Save (the app restarts).
4. Back in AdSense, choose the **meta tag** or **ads.txt** check: both are already done by the app (`/ads.txt` is created automatically). Click *Verify*, then *Request review*. Approval usually takes from a few days to 2–4 weeks.
5. After approval: AdSense → **Ads → By ad unit → Display ads** → create one (responsive). Copy its **data-ad-slot** number into Render → Environment as `ADSENSE_SLOT`.
6. Keep **Auto ads switched off** in AdSense (Ads → By site → edit → Auto ads off). Auto ads place ads anywhere, including over documents.

Tips for approval: have a privacy policy page link and your contact email (Support email in Rules), and some useful text on the pages (the tool pages already have it).

## 4f. Legal pages

The app has: `/privacy` (Privacy Policy: DPDP Act 2023, IT Act, GDPR basics), `/terms` (Terms & Conditions), `/licence` (software licence / EULA), `/refund-policy` (for Razorpay), `/cookies`, `/disclaimer` (e-Sign vs DSC under the IT Act, no forging documents) and `/contact`. They're linked in the footer and the sitemap, and new accounts must tick *I agree to the Terms & Conditions and Privacy Policy* (recorded in the Activity log).

Fill in your details in the admin console → **Rules → Legal details**: business address, the city/state for court jurisdiction, Grievance Officer name and refund window. Anything still missing shows as a yellow placeholder on the pages. Razorpay asks for the Terms, Privacy, Refund and Contact page links during sign-up: use these addresses.

These are templates, not legal advice. Have a lawyer or CA check them before you start charging.

## 5. How licensing works

| Situation | What the user gets |
|---|---|
| New account, trials on | Free trial for *N* days (you choose). Green bar shows the days left. |
| Trial ended / cancelled / licence revoked | **Reader mode** (open, read, search and print), or **completely locked** until they buy. You choose which under *Trial & licence rules*. |
| Licence key entered | Pro for the key's length (1 month to lifetime). Keys stack: a second 1-year key adds a year. |
| During the free period | Everything, with or without an account. Accounts get their trial after the free period. |
| Admin account | Everything, always. |

**Your controls in the admin console:**

- **Trial & licence rules**: free access on/off, trial on/off, trial length, the **maximum number of trials ever given**, one trial per computer (stops people making new accounts for more free days), devices per account, how many days it may work offline, the "Buy" link and price text.
- **Overview → Cancel all active trials**: ends every running trial at once (optionally also stops new trials).
- **Users → Manage**: give or extend a trial, cancel a trial, give a paid licence, revoke, sign out all devices, reset password, disable, delete, make admin.
- **Licence keys**: create keys after a customer pays, revoke keys.
- **Signatures**: every e-Sign (and online DSC signing) with the document fingerprint, so you can prove later who signed which file.

Changes reach open apps within 5 minutes, and immediately when the app is next opened. **Offline days is 0 by default**, so the app needs your server every time it starts. If you set it higher, people who were already let in can keep using it without internet for that many days.

**Taking payments:** put your Razorpay / Stripe / Instamojo payment link in *Buy link*. After someone pays, create a key and email it to them. (Automatic key delivery after payment needs a payment webhook; see "Next steps".)

## 6. Signing: e-Sign vs DSC

Both are on the **Fill & Sign** tab of the reader (and as tool cards on the home page).

**e-Sign without an account.** Visitors can e-Sign without signing up, like free PDF signing apps. They type their name and tick "I am the person named above and agree to sign electronically". The signature uses a one-time certificate from your authority that carries only that name, marked *Signed without an account (name not verified)*; the app's signature panel shows this warning too. It proves when the document was signed and that it hasn't changed, but not who signed it. Limits: 20 signatures per computer per hour, 30 per network per hour and 100 per day, and 600 per hour site-wide. Each one is listed in the admin console's signature log as *e-Sign (no account)* with the IP address. Blocking a computer in *Visitors* also stops its signing.

**e-Sign & lock.** The user confirms with their account password. The server signs the document's SHA-256 fingerprint with a personal certificate issued to that user by your app's own certificate authority. The file itself is never sent. Desktop PDF readers show the signature as cryptographically valid and the document as certified. Because your authority isn't on their built-in trusted list, they say the signer's identity is "unknown" until the recipient trusts your certificate (download it from `/api/esign/ca`). That's the same for every in-house e-sign service. To get a green tick for everyone, sign with a DSC from a licensed CA (below) or buy an AATL document-signing certificate.

**DSC sign & lock.** The user picks their `.pfx` / `.p12` certificate file and types its password. Signing happens entirely on their computer. This gives the full legal weight of a DSC under the IT Act, and PDF readers trust it when the issuing CA (eMudhra, Capricorn, Sify, etc.) is trusted on that computer.

**Signature placement.** Either place a handwritten signature first with **Signature** and choose "Use the signature I placed", or let the app add a signature box in a corner of any page, or sign invisibly. The visible box shows "Digitally signed by …, Date, Reason, Location", like Indian DSC signers.

**Locked after signing.** Every signature certifies the PDF with *no changes allowed* (DocMDP level 1). In this app a signed PDF opens read-only with a status bar ("Signed by … Signature is valid …"), and only Save copy, Print and convert-to-Word/Excel/images remain. Nobody can stop another program from changing bytes in a file, but any change makes the signature show as **invalid** in any standard PDF reader and in this app. That is how PDF certification works everywhere.

Signatures made here were checked with Poppler `pdfsig` and pyHanko: both report the signature valid, covering the whole document, with "no changes allowed".

## 6b. Admin security

**Who can open the admin console?** Anyone can load the page `/admin`, but it only shows "Admins only". Every piece of data and every button is checked by the server, which answers only a logged-in administrator.

**2-step login (strongly recommended).** Admin console → **Security** → *Set up 2-step login*. Scan the QR code with Google Authenticator or Microsoft Authenticator, type the code, and save the 10 **backup codes** it shows (each works once if you lose your phone). From then on, logging in needs your password **and** the 6-digit code from your phone. Turning it on signs your account out everywhere else.

Lost your phone and the backup codes? On the server run `npm run reset-2fa -- you@example.com`, or ask another admin to use *Users → Manage → Reset 2-step login*.

**Email alerts.** You get an email when:
- someone logs in as admin (says whether a code was used),
- a backup code is used,
- 5 wrong passwords are typed for an admin account,
- 2-step login is turned on or off, or a new admin is made.

Alerts need an email account to send from. Set these on the server (Render → Environment) and restart:

| Variable | Gmail example |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `yourname@gmail.com` |
| `SMTP_PASS` | a Gmail **App password** (Google Account → Security → 2-Step Verification → App passwords), not your normal password |
| `SMTP_FROM` | `AK Smarts PDF <yourname@gmail.com>` (optional) |

Then Security → **Send test email**. Choose where alerts go under *Send alerts to*.

**Also:** use a long password used nowhere else, keep the site on HTTPS, don't set `ADMIN_EMAIL` after your admin exists, and keep backups of the `data` folder private.

## 6d. Logging in: email or mobile number, password, 2-step login

- **Sign up:** name, *email or mobile number*, password. No code and no text message is needed. (A mobile number is not checked by SMS, to avoid SMS costs.)
- **Log in:** email *or* mobile number, and the password.
- **Staying logged in:** a login lasts 30 days and is renewed each time the app is used, so people who use it regularly stay logged in. They log in again after 30 days without use, after *Log out*, on a new device, or after a password change.
- **2-step login (Google Authenticator):** in *Your account → 2-step login*, press **Turn on 2-step login**, scan the QR code with Google Authenticator (or Microsoft Authenticator), and type the 6-digit code. From then on, each login asks for the password and then the code from the app. People get 10 backup codes for when they lose their phone; an admin can switch 2-step login off for someone under *Users → Manage* if they lose both.
- **Forgot password?** on the log-in screen: type the email or mobile number; a 6-digit code goes to the account's **email** (this needs the SMTP settings from section 6b, which are free with e.g. Gmail or Zoho). Accounts with only a mobile number can add an email in *Your account*; otherwise the admin resets the password (*Users → Manage*).
- **Your account → Mobile number & email:** add or change the mobile number, or add an email, by typing the account password. An existing email can only be changed by the admin.

Codes expire after 10 minutes, allow 5 tries, and are stored only as a keyed hash, with limits per network and per address. For testing on your own computer only: `OTP_DEV_LOG=1` prints email codes in the server log instead of sending them (ignored when `NODE_ENV=production`).

## 6c. Protection built in

- **Passwords** are stored as scrypt hashes (never readable). Wrong guesses are limited: 10 per account and 30 per network every 15 minutes. The answer takes the same time whether or not an email has an account.
- **Sign-up spam:** at most 10 accounts per hour (30 a day) from one network, 100 per hour for the whole site (change with `SIGNUP_MAX_PER_HOUR`), a hidden trap field that bots fill in, and no links allowed in names.
- **Browser protections:** HTTPS-only (HSTS), no framing of the site (stops click-jacking), a strict Content Security Policy (only the app's own scripts can run), no referrer leaks, camera, microphone and location switched off.
- **Forged requests (CSRF):** every change must come from the site's own pages; requests from other websites are refused.
- **PDF safety:** scripts inside PDFs never run (PDF.js runs without `eval` and without PDF JavaScript), so a booby-trapped PDF can't take over the page. Files are opened on the user's device and never uploaded, so they can't reach the server.
- **Signature checks** use a strict byte-for-byte RSA check, so forged signatures can't pass as valid.
- **Errors** show a short message; details go only to the server log.
- **Server-side checks:** e-Sign, licence keys, admin actions and the app's unlock key are all decided by the server. A user without a licence (when "block" is chosen) never receives the key, and a copied page can't run.
- **2-step login** with an authenticator app for everyone, and short-lived email codes for forgotten passwords (section 6d).
- **Desktop app:** runs the website in a locked-down window (sandbox, no Node.js in the page), only your own site can load inside it, other links open in the normal browser, and camera/microphone/location requests are refused.
- **Libraries:** `npm audit` reports 0 known problems (node-forge updated to 1.4.2). Run `npm audit` again from time to time.
- Set `PUBLIC_URL` to your real address once you have it.

## 7. Limits

- **USB-token DSCs** (ePass2003, ProxKey, mToken and similar Class 3 tokens) don't let you export the private key as a `.pfx`, so they can't be used yet. Supporting them needs a small helper in the desktop app that talks to the token driver (PKCS#11) or the Windows certificate store. This is the most useful next step for Indian users.
- One signature per document. A second signature on an already-signed PDF would need an "incremental update" writer (planned).
- Only RSA certificates (used by practically all Indian DSCs). ECC certificates are refused with a clear message.
- **Code lock:** the app's code is encrypted with AES-256 and the key is given only to people your server lets in (logged in, or guests while free access is on). A copied page can't run without your server. Someone who is let in could still capture the unlocked code from their browser's memory, as with any web or desktop app that processes files locally. The server fully controls accounts, e-Sign, licence keys and free access.
- Forgotten passwords: with email (SMTP) set up, people get a code by email and set a new password themselves. Otherwise the admin resets it (*Users → Manage → Set new password*).
- **Compression:** PDFs that are only text and vector drawings, or that were already compressed, can't get much smaller without turning pages into pictures. *Strong*/*Extreme* or a size limit do that (text stays searchable, but it is no longer editable as text). Very small limits (e.g. 50 KB for 40 scanned pages) may not be reachable; the app then gives the smallest file it could make and says so.
- **OCR** (reading scanned text) works best on clear, straight scans in English. Hindi and Kannada can be typed, but OCR reads English only for now.

## 8. Next steps worth doing

1. USB-token DSC support in the desktop app.
2. Automatic licence after payment (Razorpay webhook creates the licence and emails the key).
3. Sign in with Google.
4. Multiple signers on one document.
5. Code-signing the Windows installer.

## Where is what

- **Admin console** (the page with Overview, Visitors, Users…): open `https://your-site/admin` after logging in with your owner account. On your computer: http://localhost:8080/admin. The file is `public/admin.html` (+ `admin.js`, `admin.css`).

## Files

```
server/server.js      API: log-in, licences, trials, keys, e-Sign, admin
server/db.js          SQLite tables and default rules
server/esign-ca.js    The app's e-Sign certificate authority
server/security.js    2-step login and admin email alerts
server/otp.js         Email codes for “Forgot password?”, mobile-number helpers
server/seo.js         The tool pages for Google (/compress-pdf etc.) and the sitemap
server/cms.js         Builds and checks PDF signatures (used by the server and the app)
src/addon.js|css|-body.html   What was added to your app: log-in, licensing, signing, lock, merge, saving
src/compress.js       Strong PDF and image compression
src/textedit.js       Editing added and existing text, OCR for scanned pages
src/textremove.js     Takes changed words out of the page when saving
src/rename.js         Bulk rename PDFs from Excel, and PDF names to Excel
src/fonts/            Hindi and Kannada fonts (SIL Open Font License)
original/PDF-Tools.html       Your app as you sent it
build/build-app.js    Combines the two into public/app.html (updates the security policy)
public/               What the server serves: app, admin console, icons, install manifest
brand/                Your logo and icon; build/icons.py makes every size from it
render.yaml           One-click hosting on Render.com
desktop/              Windows/Mac desktop app (Electron) that registers for .pdf files
```
