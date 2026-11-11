'use strict';
// The words on each tool's search page (what Google reads and ranks).
// title: shown in Google (about 60 characters); {F} becomes " Free" while the free period is on.
// desc: the grey text under the title in Google (about 150 characters).
// Each page: a lead line, two intro paragraphs, steps, features, questions and related tools.
// To add a tool page: add its line to PAGES in seo.js and an entry here.

const UPDATED = '2026-11-02'; // change when you edit this file, so Google re-reads the pages

const C = {
  'pdf-reader': {
    title: 'PDF Reader Online{F} – Open, Read & Print PDF Files',
    desc: 'Open and read PDF files in your browser or phone. Search, zoom, night mode, bookmarks and printing. No install, files stay on your device.',
    lead: 'Open any PDF instantly in your browser, on a computer or a phone.',
    intro: [
      'The PDF reader opens documents straight away, without installing anything. Page thumbnails, the bookmark outline and full-text search make long reports, statements and e-books easy to move around in.',
      'Because the file is opened on your own device, even confidential documents such as salary slips, bank statements or contracts never leave your computer. Password-protected PDFs open after you type the password.'
    ],
    steps: ['Click “Choose PDF file” or drop a PDF onto this page.', 'Read with thumbnails, bookmarks and search on the left side.', 'Zoom, rotate the view, switch to night mode or print when you need to.'],
    feats: [['Fast search', 'Find every place a word appears, highlighted on the page.'], ['Thumbnails and bookmarks', 'Jump to any page or chapter in one click.'], ['Night mode and zoom', 'Comfortable reading on a large monitor or a small phone screen.'], ['Print', 'Print all pages or only the ones you choose.']],
    faq: [['Can I open a password-protected PDF?', 'Yes. Type the password when asked and the document opens. Use Unlock PDF if you want a copy without the password.'], ['Can I open PDFs by double-clicking them?', 'Yes. Install the app from your browser (or the Windows desktop app) and choose it under “Open with” for .pdf files.'], ['Will the reader open damaged files?', 'It repairs small problems automatically. For badly damaged files, try Repair PDF.']],
    rel: ['edit-pdf', 'annotate-pdf', 'pdf-to-word', 'compress-pdf', 'sign-pdf']
  },
  'edit-pdf': {
    title: 'Edit PDF Online{F} – Change PDF Text, Add Images',
    desc: 'Edit PDF files online: change existing text, add new text, images and shapes, or white-out parts. Works on computer and phone, no sign-up.',
    lead: 'Change the words already in a PDF, or add text and pictures anywhere on the page.',
    intro: [
      'Click on any line of text in the PDF to change it. The editor matches the original font size and colour and fills the background so the edit blends in with the page. You can also add new text boxes, pictures, logos and shapes.',
      'Use white-out to cover parts you want to hide, then save a clean copy. Everything happens in your browser, so there is no upload and no waiting for a server.'
    ],
    steps: ['Choose the PDF you want to edit.', 'Click any text to change it, or use Add text, Image or Shape on the Edit tab.', 'Click Save to download the edited PDF.'],
    feats: [['Edit existing text', 'Fix a typo, a date, an amount or a name directly on the page.'], ['Seamless background', 'Edited text keeps the page’s own background colour, not a white box.'], ['Add images and logos', 'Place a stamp, logo or photo and resize it freely.'], ['Undo and redo', 'Every change can be undone before you save.']],
    faq: [['Can I edit a scanned PDF?', 'A scan is a picture of text. Run OCR PDF first to recognise the words, then edit or add text boxes over it.'], ['Will the edited text use the same font?', 'The editor uses the closest standard font at the same size and colour. Uncommon fonts are replaced by a similar one.'], ['Can I edit Hindi or Kannada text?', 'You can read and annotate PDFs in any language. Typing new text in Indian scripts is not supported yet.']],
    rel: ['annotate-pdf', 'sign-pdf', 'fill-pdf-form', 'redact-pdf', 'ocr-pdf', 'watermark-pdf']
  },
  'annotate-pdf': {
    title: 'Annotate PDF Online{F} – Highlight, Comment & Draw',
    desc: 'Highlight, underline and strike out PDF text, draw, add sticky notes, shapes and stamps. Comments open in every PDF reader.',
    lead: 'Highlight, comment and mark up PDF documents for review.',
    intro: [
      'Mark up contracts, study material and reports with highlights, underlines, strike-outs, freehand drawing, arrows, boxes and sticky notes. Stamps such as APPROVED or DRAFT can be added in one click.',
      'Comments are saved as standard PDF annotations, so colleagues see them in whatever PDF reader they use, and they can reply or remove them.'
    ],
    steps: ['Open your PDF.', 'Pick a tool on the Comment tab: highlight, underline, note, pen, shape or stamp.', 'Mark up the pages and save the annotated PDF.'],
    feats: [['Text markup', 'Highlight, underline or strike out selected text in any colour.'], ['Sticky notes', 'Add comments to any spot on the page.'], ['Drawing and shapes', 'Freehand pen, lines, arrows, rectangles and circles.'], ['Stamps', 'Approved, Rejected, Draft, Confidential and more.']],
    faq: [['Will others see my comments?', 'Yes. Annotations are saved in the standard PDF format, so they show in other PDF readers too.'], ['Can I flatten comments so nobody can remove them?', 'Yes. Use Flatten PDF after annotating to make the comments part of the page.'], ['Does annotating change the original text?', 'No. Comments sit on top of the page; the original content stays as it was.']],
    rel: ['edit-pdf', 'flatten-pdf', 'pdf-reader', 'sign-pdf', 'compare-pdf']
  },
  'sign-pdf': {
    title: 'Sign PDF Online{F} – Add Your Signature to a PDF',
    desc: 'Sign PDF documents online: draw, type or upload your signature and place it anywhere. Add initials and dates. No sign-up, files stay on your device.',
    lead: 'Put your handwritten signature on any PDF in a few seconds.',
    intro: [
      'Create your signature once by drawing it with a mouse or finger, typing your name in a handwriting style, or uploading a photo of your signature. It is saved on your device so you can reuse it on the next document.',
      'Place the signature, your initials and the date anywhere on the page, resize it, and download the signed PDF. For a signature that also locks the document against changes, use e-Sign PDF or DSC signing.'
    ],
    steps: ['Choose the PDF to sign.', 'Click Signature on the Fill & Sign tab and draw, type or upload your signature.', 'Place it on the page, add the date if needed, and save.'],
    feats: [['Draw, type or upload', 'Three ways to create a signature that looks like yours.'], ['Initials and dates', 'Add initials on every page and today’s date in one click.'], ['Reusable', 'Your signature is remembered on this device for next time.'], ['Works on phones', 'Sign with your finger on a touch screen.']],
    faq: [['Is a drawn signature legally valid?', 'A drawn signature on a PDF is accepted for many everyday documents. For documents that need proof of who signed and that nothing changed later, use e-Sign or a DSC.'], ['Is my signature uploaded?', 'No. It is stored only in your browser on this device.'], ['Can I sign on my phone?', 'Yes. Open this page on your phone and draw your signature with your finger.']],
    rel: ['esign-pdf', 'dsc-sign-pdf', 'fill-pdf-form', 'verify-pdf-signature', 'edit-pdf']
  },
  'esign-pdf': {
    title: 'e-Sign PDF Online{F} – Digitally Sign & Lock a PDF',
    desc: 'e-Sign a PDF with a certified digital signature that locks the document. Any later change shows the signature as invalid. With or without an account.',
    lead: 'A certified digital signature that proves the document hasn’t changed since you signed it.',
    intro: [
      'e-Sign adds a cryptographic digital signature to the PDF and certifies it with “no changes allowed”. If anyone edits the signed file later, PDF readers show the signature as invalid, so the person receiving it can trust the content.',
      'Sign with your account for a signature that carries your verified name and email, or sign without an account by typing your name (shown as not verified). Only the document’s fingerprint is sent to the server, never the file itself.'
    ],
    steps: ['Open the PDF and optionally place your handwritten signature first.', 'Click e-Sign & lock on the Fill & Sign tab.', 'Confirm your name (or account password), choose where the signature box appears and click Sign and save.'],
    feats: [['Tamper-evident', 'Any change after signing breaks the signature visibly.'], ['Visible signature box', 'Shows “Digitally signed by”, the date, the reason and the place.'], ['No upload', 'Only a SHA-256 fingerprint of the file goes to the signing service.'], ['Verify anytime', 'Open the signed PDF to see who signed and whether it changed.']],
    faq: [['Is e-Sign the same as Aadhaar eSign or a DSC?', 'No. It is an electronic signature from this app’s own signing service. Where the law requires a DSC or Aadhaar eSign (for example many government filings), use DSC signing instead.'], ['Can I e-Sign without creating an account?', 'Yes. Type your full name and confirm. The signature shows your name marked as not verified. Sign in for a verified name and email.'], ['Can I edit the PDF after signing?', 'No. Signed PDFs are locked. Edit first, then sign the final version.']],
    rel: ['dsc-sign-pdf', 'verify-pdf-signature', 'sign-pdf', 'protect-pdf', 'fill-pdf-form']
  },
  'dsc-sign-pdf': {
    title: 'Sign PDF with DSC Online – Class 3 Digital Signature',
    desc: 'Sign PDFs with your Class 2 or Class 3 Digital Signature Certificate (.pfx/.p12) for GST, MCA, income tax and tenders. The key never leaves your device.',
    lead: 'Use your Digital Signature Certificate to sign PDFs with full legal weight under the IT Act.',
    intro: [
      'A DSC issued by a licensed Certifying Authority such as eMudhra, Capricorn or Sify gives the strongest form of electronic signature recognised in India. This tool signs PDFs with your .pfx or .p12 certificate file and certifies the document against changes.',
      'Signing happens entirely on your computer. The certificate, its password and the document are never uploaded. The signature box shows your name as in the certificate, the date, reason and location, as Indian authorities expect.'
    ],
    steps: ['Open the PDF to sign.', 'Click DSC sign on the Fill & Sign tab and choose your .pfx or .p12 certificate file.', 'Type the certificate password, pick where the signature appears and click Sign and save.'],
    feats: [['Legally strong', 'A DSC signature has full legal recognition under the Information Technology Act, 2000.'], ['Private', 'Your certificate and password stay on your device.'], ['Certified PDF', 'The document is locked so any change shows up.'], ['Checks the certificate', 'Warns you if the DSC has expired or is not yet valid.']],
    faq: [['Can I use a USB token DSC (ePass, ProxKey)?', 'Export the certificate as a .pfx file if your token allows it, or use the desktop app, which can work with tokens through a helper.'], ['Which documents need a DSC?', 'Common examples are GST and income-tax filings, MCA/ROC forms, e-tenders and some court filings. Check what the receiving authority requires.'], ['Will the signature show as valid in other readers?', 'Yes, when the issuing Certifying Authority is trusted on the recipient’s computer, which is usual for licensed Indian CAs.']],
    rel: ['esign-pdf', 'verify-pdf-signature', 'sign-pdf', 'protect-pdf', 'compress-pdf']
  },
  'verify-pdf-signature': {
    title: 'Verify PDF Signature Online{F} – Check Who Signed',
    desc: 'Check a signed PDF: see who signed it, when, the certificate details and whether the document was changed after signing.',
    lead: 'Find out whether a signed PDF is genuine and unchanged.',
    intro: [
      'Open any digitally signed PDF to see every signature in it: the signer’s name and email, the signing time, the certificate and who issued it, and whether the signature is valid.',
      'The check also tells you if the document was changed after it was signed, which is the main sign of tampering. It works for e-Sign, DSC and other standard PDF signatures.'
    ],
    steps: ['Choose the signed PDF.', 'Read the status bar at the top: valid, changed or invalid.', 'Click Details to see each signature, its certificate and signing time.'],
    feats: [['Tamper check', 'Detects changes made after signing.'], ['Signer details', 'Name, email, organisation and certificate validity.'], ['Multiple signatures', 'Lists every signature in the file separately.'], ['Certification level', 'Shows whether the PDF was locked with “no changes allowed”.']],
    faq: [['What does “changed after signing” mean?', 'Someone saved new content into the file after the signature was applied. The signed part is intact, but you should check what was added.'], ['Why is the signer shown as not trusted?', 'The certificate’s issuer is not on this computer’s trusted list. The signature can still be mathematically valid.'], ['Is the file uploaded for checking?', 'No. The verification runs in your browser.']],
    rel: ['esign-pdf', 'dsc-sign-pdf', 'sign-pdf', 'compare-pdf', 'pdf-reader']
  },
  'fill-pdf-form': {
    title: 'Fill PDF Form Online{F} – Type into Any PDF Form',
    desc: 'Fill PDF forms online: type into form fields, tick boxes, add dates and your signature. Works even on forms without fillable fields.',
    lead: 'Complete application forms, KYC forms and declarations without printing them.',
    intro: [
      'Fillable PDF forms open with their fields ready to type into: text boxes, check boxes, radio buttons and drop-downs. For scanned or flat forms that have no fields, click anywhere on the page to type text, add ticks and dates.',
      'Sign the form with your saved signature, then download the completed PDF ready to email or upload to a portal.'
    ],
    steps: ['Choose the PDF form.', 'Click into fields to type, or add text anywhere on forms without fields.', 'Add your signature and the date, then save the filled form.'],
    feats: [['Fillable fields', 'Text, check boxes, radio buttons and lists work as expected.'], ['Flat forms too', 'Type anywhere on scanned forms that have no fields.'], ['Ticks and dates', 'Add ✓ marks and today’s date in one click.'], ['Sign', 'Place your signature on the form before saving.']],
    faq: [['Can I fill a scanned form?', 'Yes. Click on the page where you want to type and add a text box there.'], ['Will the answers stay editable?', 'Yes, until you flatten the form. Use Flatten PDF to lock the answers.'], ['Does it work on my phone?', 'Yes. Forms can be filled on Android and iPhone browsers.']],
    rel: ['sign-pdf', 'flatten-pdf', 'edit-pdf', 'esign-pdf', 'compress-pdf']
  },
  'merge-pdf': {
    title: 'Merge PDF Online{F} – Combine PDF Files into One',
    desc: 'Merge PDF files online: combine several PDFs and images into one PDF in the order you want. Fast, no upload, no sign-up, works on phone.',
    lead: 'Join PDFs and pictures into a single document in seconds.',
    intro: [
      'Add as many PDF files and images as you like, drag them into the right order, and merge them into one PDF. It is the quickest way to combine invoices, scanned pages, certificates or chapters into a single file for email or upload.',
      'Merging runs on your own device, so even large files are combined without uploading anything, and your documents stay private.'
    ],
    steps: ['Choose or drop all the PDF and image files you want to combine.', 'Drag the files into the order you want.', 'Click Merge and download the combined PDF.'],
    feats: [['PDFs and images', 'Mix PDF files with JPG and PNG pictures.'], ['Any order', 'Rearrange files before merging.'], ['No size limit from us', 'Large files are merged on your device, limited only by its memory.'], ['Keeps quality', 'Pages are copied as they are, without re-compressing.']],
    faq: [['How many files can I merge?', 'There is no fixed limit. Dozens of files work fine on a normal computer or phone.'], ['Can I merge only some pages of a file?', 'Merge the files, then use Remove pages or Organize PDF to keep only the pages you need.'], ['Can I merge files automatically by their names?', 'Yes. Merge PDFs by File Name joins files that start the same, such as 01_a and 01_b, into one PDF each.']],
    rel: ['merge-pdf-by-name', 'split-pdf', 'organize-pdf', 'compress-pdf', 'jpg-to-pdf']
  },
  'merge-pdf-by-name': {
    title: 'Merge PDFs by File Name – Batch Combine into Sets',
    desc: 'Batch merge PDFs and images by file name: files starting 01_, 02_ and so on become one PDF per set, downloaded together as a ZIP.',
    lead: 'Combine hundreds of files into sets automatically, using the start of each file name.',
    intro: [
      'When files are named by a number or code, such as 01_invoice.pdf, 01_receipt.jpg and 02_invoice.pdf, this tool groups them by that starting part and creates one PDF per group: 01.pdf, 02.pdf and so on. Names like _01, 01- and 1 are treated as the same set.',
      'Check and rename the sets in the preview before merging. All the merged PDFs download together in one ZIP file. It is ideal for employee files, student documents, property records and audit bundles.'
    ],
    steps: ['Choose all the PDF and picture files at once, or drop a whole folder’s files.', 'Check the sets in the preview and change a set name if needed.', 'Click Merge and download one ZIP with a PDF for each set.'],
    feats: [['Automatic grouping', 'Files that start the same go together, however many there are.'], ['Smart matching', '01_, _01, 01- and 1 count as the same set.'], ['Preview and rename', 'See every set before merging and adjust names.'], ['One ZIP', 'Download every merged PDF at once.']],
    faq: [['What if a file has no number at the start?', 'It goes into its own set named after the file. You can rename it in the preview.'], ['In what order are files merged inside a set?', 'In natural name order, so 2 comes before 10.'], ['Can I mix images and PDFs?', 'Yes. Pictures become PDF pages inside their set.']],
    rel: ['merge-pdf', 'split-pdf', 'jpg-to-pdf', 'compress-pdf', 'organize-pdf']
  },
  'bulk-rename-pdf': {
    title: 'Bulk Rename PDFs{F} – Rename Many PDF Files from Excel',
    desc: 'Rename hundreds of PDFs at once from an Excel or CSV list. Get the current names into Excel, type the new names, and download the renamed PDFs as a ZIP.',
    lead: 'Rename a whole folder of PDFs from an Excel list, in one go.',
    intro: [
      'Make a list in Excel: column A is the number in each PDF’s file name (001, 002 …) and column B is the new name. Add the list and the PDFs, and every file is renamed to match its row. 001.pdf, Scan_001.pdf and 1.pdf all match row 001.',
      'No list yet? Add the PDFs and press Get PDF names as Excel to get one ready to fill in. A preview shows old name → new name with warnings before anything is renamed, and your original files are never changed.'
    ],
    steps: ['Add the PDFs and your Excel or CSV list (or get the PDF names as Excel first).', 'Check the preview of old and new names and fix any warnings.', 'Click Rename PDFs and download a ZIP with the renamed files and a log.'],
    feats: [['From Excel or CSV', 'Column A is the number in the file name, column B the new name.'], ['Smart matching', '001.pdf, Scan_001.pdf and 1.pdf all match row 001, or match by order.'], ['Preview with warnings', 'Missing rows, empty names and duplicate names are flagged before renaming.'], ['ZIP and log', 'Download the renamed PDFs with rename-log.csv (old → new), or save into a folder on computers.']],
    faq: [['Are my original files changed?', 'No. You get renamed copies in a ZIP, or saved into a folder you pick. The originals stay as they are.'], ['What if two rows have the same new name?', 'You can add _1, _2 to the repeats, or stop and fix the list first.'], ['Which characters are removed?', 'Characters that are not allowed in file names, such as / \\ : * ? " < > |, are removed, and names are kept to 35 letters.']],
    rel: ['merge-pdf-by-name', 'merge-pdf', 'split-pdf', 'organize-pdf', 'compress-pdf']
  },
  'split-pdf': {
    title: 'Split PDF Online{F} – Separate PDF Pages into Files',
    desc: 'Split a PDF into single pages, page ranges or equal parts. Download the separate PDFs together in a ZIP. Free, fast and private.',
    lead: 'Break a large PDF into smaller files by page, range or size.',
    intro: [
      'Split a long document into one file per page, into groups of a fixed number of pages, into your own ranges such as 1-3, 4-10, or simply into two halves. Each part is saved as its own PDF.',
      'This is useful when a portal accepts only small files, when you need to send one chapter, or when a scanner joined several documents into one.'
    ],
    steps: ['Choose the PDF to split.', 'Pick how to split: every page, every N pages, custom ranges or in half.', 'Click Split and download the parts as a ZIP.'],
    feats: [['Every page', 'One PDF for each page.'], ['Custom ranges', 'Type ranges like 1-3, 5, 8-12.'], ['Fixed groups', 'Split every 2, 5 or 10 pages.'], ['ZIP download', 'All parts in one download.']],
    faq: [['Will splitting reduce quality?', 'No. Pages are copied exactly as they are.'], ['Can I extract just a few pages into one file?', 'Yes. Use Extract PDF Pages to pick pages and keep them in one PDF.'], ['Is there a page limit?', 'No fixed limit. Very large files depend on your device’s memory.']],
    rel: ['extract-pdf-pages', 'remove-pdf-pages', 'merge-pdf', 'organize-pdf', 'compress-pdf']
  },
  'organize-pdf': {
    title: 'Organize PDF Pages Online{F} – Reorder, Rotate, Delete',
    desc: 'Rearrange PDF pages by dragging thumbnails. Rotate, delete, duplicate or insert pages from other PDFs, then save. No upload needed.',
    lead: 'See every page as a thumbnail and put them in the right order.',
    intro: [
      'Organize shows all pages of your PDF as thumbnails. Drag pages to reorder them, rotate pages that were scanned sideways, delete blank or unwanted pages, duplicate pages, or insert pages from another PDF.',
      'It is the all-in-one tool for tidying scanned bundles and assembling documents before you send them.'
    ],
    steps: ['Choose your PDF.', 'Drag thumbnails to reorder; use the buttons to rotate, delete, duplicate or insert pages.', 'Save the reorganised PDF.'],
    feats: [['Drag and drop', 'Move pages with your mouse or finger.'], ['Rotate', 'Fix sideways or upside-down pages.'], ['Delete and duplicate', 'Remove blanks or copy a page.'], ['Insert pages', 'Add pages from another PDF anywhere.']],
    faq: [['Can I select several pages at once?', 'Yes. Select multiple thumbnails and rotate or delete them together.'], ['Does rotating change the quality?', 'No. Rotation only changes how the page is displayed and printed.'], ['Can I undo a mistake?', 'Yes. Use Undo before saving.']],
    rel: ['rotate-pdf', 'remove-pdf-pages', 'extract-pdf-pages', 'merge-pdf', 'split-pdf']
  },
  'remove-pdf-pages': {
    title: 'Remove Pages from PDF Online{F} – Delete PDF Pages',
    desc: 'Delete pages from a PDF online. Type the pages to remove, like 2, 5-7, and download the PDF without them. Fast, free and private.',
    lead: 'Take unwanted pages out of a PDF in a few clicks.',
    intro: [
      'Remove blank pages, cover sheets, advertisements or pages with private information. Type the page numbers or ranges to delete, for example 1, 4-6, and the rest of the document is kept exactly as it was.',
      'You get a smaller, cleaner PDF that is ready to share or upload.'
    ],
    steps: ['Choose the PDF.', 'Type the pages to delete, such as 2, 5-7.', 'Click Remove and download the new PDF.'],
    feats: [['Ranges', 'Delete single pages and ranges together.'], ['Thumbnails', 'Check page numbers visually before removing.'], ['Original quality', 'Remaining pages are not re-compressed.'], ['Private', 'The file is processed on your device.']],
    faq: [['Can I remove pages from a password-protected PDF?', 'Yes, after typing the password to open it.'], ['Can I get the removed pages back?', 'Your original file is unchanged; the result is saved as a new file.'], ['How do I remove blank pages?', 'Look at the thumbnails, note the blank page numbers and type them in.']],
    rel: ['extract-pdf-pages', 'organize-pdf', 'split-pdf', 'compress-pdf', 'merge-pdf']
  },
  'extract-pdf-pages': {
    title: 'Extract PDF Pages Online{F} – Save Selected Pages',
    desc: 'Extract pages from a PDF into a new file. Choose the pages and their order, like 3, 1, 7-9, and download. Free, no sign-up.',
    lead: 'Pick only the pages you need and save them as a new PDF.',
    intro: [
      'Extract creates a new PDF with just the pages you choose, in the order you type them. Send only the relevant pages of a long report, a single statement month, or the signed page of an agreement.',
      'The original document stays untouched, and the extracted pages keep their original quality.'
    ],
    steps: ['Choose the PDF.', 'Type the pages to keep in the order you want, for example 3, 1, 7-9.', 'Click Extract and download the new PDF.'],
    feats: [['Custom order', 'Pages come out in the order you type.'], ['Ranges', 'Use ranges like 10-15.'], ['No quality loss', 'Pages are copied exactly.'], ['Fast', 'Runs instantly in your browser.']],
    faq: [['What is the difference between Extract and Split?', 'Extract makes one new PDF from chosen pages. Split makes several PDFs from one.'], ['Can I extract the same page twice?', 'Yes. Type it twice and it appears twice.'], ['Can I extract pages as images?', 'Use PDF to JPG to save pages as pictures.']],
    rel: ['split-pdf', 'remove-pdf-pages', 'organize-pdf', 'pdf-to-jpg', 'merge-pdf']
  },
  'rotate-pdf': {
    title: 'Rotate PDF Online{F} – Turn PDF Pages and Save',
    desc: 'Rotate PDF pages permanently: all pages, only landscape or portrait pages, or chosen pages. Save the turned PDF in seconds.',
    lead: 'Fix sideways and upside-down pages and save them that way.',
    intro: [
      'Scanned documents and phone photos often come out sideways. Rotate turns every page, only the landscape or portrait pages, or the pages you list, by 90°, 180° or 270°, and saves the result permanently.',
      'The page content is not re-compressed, so text and images stay sharp.'
    ],
    steps: ['Choose the PDF.', 'Choose the angle and which pages to rotate.', 'Click Rotate and download.'],
    feats: [['Any angle', '90° left or right, or 180°.'], ['Selective', 'Only the pages you choose.'], ['By orientation', 'Turn only landscape or only portrait pages.'], ['Permanent', 'Saved in the file, not just the view.']],
    faq: [['Will the rotation stay when I send the file?', 'Yes. The rotation is saved in the PDF.'], ['Can I rotate just one page?', 'Yes. Type its page number.'], ['Does rotating reduce quality?', 'No.']],
    rel: ['organize-pdf', 'crop-pdf', 'resize-pdf', 'jpg-to-pdf', 'merge-pdf']
  },
  'crop-pdf': {
    title: 'Crop PDF Online{F} – Trim PDF Margins',
    desc: 'Crop PDF pages: remove white margins automatically or trim exact margins in millimetres. Free, private, works on phone.',
    lead: 'Remove extra white space around PDF pages.',
    intro: [
      'Cropping trims the edges of each page. Auto-crop finds the content and removes the empty margins, which makes documents easier to read on phones and e-readers. You can also set exact margins in millimetres.',
      'Cropping is useful for scanned documents with dark borders and for printing slides or receipts without waste.'
    ],
    steps: ['Choose the PDF.', 'Use automatic cropping or type the margins to cut.', 'Click Crop and download.'],
    feats: [['Auto-crop', 'Detects and trims white margins.'], ['Exact margins', 'Set top, bottom, left and right in mm.'], ['All or some pages', 'Crop the whole document or chosen pages.'], ['Sharp output', 'Content is not re-compressed.']],
    faq: [['Is cropped content deleted?', 'The hidden area is outside the visible page. To remove private content permanently, use Redact PDF.'], ['Can I crop to A4?', 'Use Resize PDF to fit pages to A4 or another paper size.'], ['Does it work for scans?', 'Yes, including scans with dark edges.']],
    rel: ['resize-pdf', 'rotate-pdf', 'redact-pdf', 'compress-pdf', 'organize-pdf']
  },
  'resize-pdf': {
    title: 'Resize PDF Pages Online{F} – Change to A4, Letter',
    desc: 'Resize PDF pages to A4, Letter, Legal, A3 or A5. Make every page the same paper size for printing and portals.',
    lead: 'Make all pages the same paper size.',
    intro: [
      'Documents that mix page sizes print badly and are rejected by some upload portals. Resize fits every page to the paper size you pick, such as A4, Letter, Legal, A3 or A5, keeping the content centred and in proportion.',
      'To make the file smaller in megabytes instead, use Compress PDF.'
    ],
    steps: ['Choose the PDF.', 'Pick the paper size and orientation.', 'Click Resize and download.'],
    feats: [['Standard sizes', 'A3, A4, A5, Letter and Legal.'], ['Keeps proportions', 'Content is scaled without stretching.'], ['Portrait or landscape', 'Follows each page or forces one orientation.'], ['Print ready', 'Every page prints on the same paper.']],
    faq: [['Does this reduce the file size?', 'No. It changes the paper size. Use Compress PDF to reduce megabytes.'], ['Will text become blurry?', 'No. Text stays sharp because it is scaled as vector content.'], ['Can I resize images?', 'Use Resize Image for JPG and PNG pictures.']],
    rel: ['compress-pdf', 'crop-pdf', 'pdf-pages-per-sheet', 'resize-image', 'rotate-pdf']
  },
  'pdf-pages-per-sheet': {
    title: 'Multiple PDF Pages per Sheet – 2, 4, 6 or 9 Up',
    desc: 'Put 2, 4, 6 or 9 PDF pages on one sheet (N-up) to save paper when printing handouts, notes and slides.',
    lead: 'Save paper by printing several pages on each sheet.',
    intro: [
      'N-up arranges two, four, six or nine pages of your PDF on each sheet, in order, with even spacing. It is ideal for printing lecture slides, study notes, handouts and long reports cheaply.',
      'The result is a new PDF you can print on any printer, without fiddling with printer settings.'
    ],
    steps: ['Choose the PDF.', 'Pick how many pages per sheet and the paper size.', 'Click Create and download, then print.'],
    feats: [['2, 4, 6 or 9 up', 'Choose the layout you need.'], ['Paper sizes', 'A4, Letter and more.'], ['Clean layout', 'Even margins and order.'], ['Any printer', 'Works without special printer drivers.']],
    faq: [['Will the text be readable?', '2 or 4 per sheet is readable for most documents. 6 or 9 suits slides.'], ['Can I add borders?', 'Yes. Choose “Border around pages” to frame each page.'], ['Does it change the original?', 'No. A new PDF is created.']],
    rel: ['resize-pdf', 'compress-pdf', 'organize-pdf', 'add-page-numbers-to-pdf', 'merge-pdf']
  },
  'compress-pdf': {
    title: 'Compress PDF Online{F} – Reduce PDF Size (100KB, 200KB)',
    desc: 'Compress PDF files online to reduce size for email and upload portals. Choose 90%, 75%, 50% or 25% quality. No upload, no sign-up.',
    lead: 'Make PDF files smaller while keeping text sharp.',
    intro: [
      'Large PDFs bounce off email limits and get rejected by job, exam, passport, GST and bank portals that ask for files under 100 KB, 200 KB, 500 KB or 1 MB. Compress PDF shrinks the pictures inside the file and removes unused data, while text stays crisp.',
      'Choose a quality level: 90% for documents you will print, 75% for everyday sharing, 50% for uploads and 25% for the smallest possible file. A lossless option tidies the file without touching image quality.'
    ],
    steps: ['Choose or drop the PDF you want to shrink.', 'Pick a quality level: 90%, 75%, 50%, 25%, extreme or lossless.', 'Click Compress and download the smaller PDF. The new size is shown.'],
    feats: [['Four quality levels', 'Clear notes explain what each level is good for.'], ['Sharp text', 'Only images are compressed; text and lines stay vector.'], ['Scans shrink the most', 'Scanned documents often get 70–90% smaller.'], ['No upload', 'Compression runs on your device, so confidential files stay private.']],
    faq: [['How do I compress a PDF to under 100 KB or 200 KB?', 'Start with 50%. If the file is still too big, try 25%. Scanned documents usually reach these sizes easily; files full of photos may need splitting.'], ['Will compression make my PDF blurry?', 'Text stays sharp at every level. Photos lose some detail at 50% and 25%; use 75% or 90% when appearance matters.'], ['Can I compress pictures too?', 'Yes. Compress PDF also accepts JPG and PNG, and Compress Image handles many pictures at once.']],
    rel: ['compress-image', 'split-pdf', 'pdf-to-jpg', 'merge-pdf', 'resize-pdf', 'grayscale-pdf']
  },
  'compress-image': {
    title: 'Compress Image Online{F} – Reduce JPG/PNG Size in KB',
    desc: 'Compress JPG, PNG and WebP images online to reduce file size in KB for forms, exams and job portals. Choose 90%, 75%, 50% or 25%.',
    lead: 'Shrink photos and pictures to the size a form or portal asks for.',
    intro: [
      'Government, exam and job application portals often require a photo under 50 KB or a signature under 20 KB. Compress Image reduces JPG, PNG and WebP files in seconds, with four clear quality levels.',
      'Compress many pictures at once and download them together. The images never leave your device, which matters for ID cards and personal photos.'
    ],
    steps: ['Choose or drop one or more images.', 'Pick the quality level: 90%, 75%, 50% or 25%.', 'Click Compress and download the smaller images.'],
    feats: [['Several formats', 'JPG, PNG and WebP.'], ['Batch', 'Compress many images in one go.'], ['ZIP download', 'Several pictures are saved together in one ZIP.'], ['Private', 'Photos are processed on your device.']],
    faq: [['How do I make a photo under 50 KB?', 'Try 50% first. If it is still too large, use 25%, or make it smaller in pixels with Resize Image.'], ['What format do I get?', 'Compressed pictures are saved as JPG, the smallest format for photos. Transparent areas become white.'], ['Can I compress images inside a PDF?', 'Use Compress PDF for that.']],
    rel: ['resize-image', 'crop-image', 'passport-size-photo', 'png-to-jpg', 'compress-pdf', 'jpg-to-pdf']
  },
  'resize-image': {
    title: 'Resize Image Online{F} – Change Photo Size in Pixels',
    desc: 'Resize JPG, PNG and WebP pictures to exact pixels or a percentage without stretching. For forms, passport photos and websites.',
    lead: 'Change a picture’s width and height without distorting it.',
    intro: [
      'Resize Image makes pictures smaller in pixels: longest side 1920 px (Full HD), 1280 px, 800 px, a 600 px form or passport photo size, or 75%, 50% or 25% of the original. Proportions are kept, so faces and documents never look stretched, and the file gets smaller too.',
      'Use it for passport-size photos, portal uploads with fixed dimensions, website images and social media.'
    ],
    steps: ['Choose one or more images.', 'Pick the new size: 1920, 1280, 800 or 600 px, or a percentage.', 'Click Resize and download.'],
    feats: [['Keep proportions', 'No stretching or squashing.'], ['Ready-made sizes', 'Full HD, medium, small, form photo or a percentage.'], ['Batch', 'Resize many pictures at once.'], ['Transparency kept', 'PNG and WebP keep their transparent background.']],
    faq: [['Which size should I pick for an online form photo?', 'Choose “Passport / form photo · 600 px”. If the form also has a KB limit, run Compress Image afterwards.'], ['Will resizing reduce quality?', 'Making images smaller keeps them sharp. Making them much larger can look soft.'], ['How do I reduce KB instead?', 'Use Compress Image.']],
    rel: ['compress-image', 'crop-image', 'passport-size-photo', 'png-to-jpg', 'jpg-to-pdf']
  },
  'crop-image': {
    title: 'Crop Image Online{F} – Cut Photos to Any Size or Shape',
    desc: 'Crop images online: drag a box over the part you want, or pick square, 16:9, 4:5 or passport size. Rotate too. JPG, PNG and WebP, no upload.',
    lead: 'Cut a photo down to exactly the part you want to keep.',
    intro: [
      'Crop Image shows your picture with a box on top. Drag the box to move it and drag its corners to make it bigger or smaller, then download only that part. Choose a ready-made shape to keep the proportions exact: square for profile pictures, 4:5 for Instagram, 16:9 for YouTube thumbnails and slides, A4, or passport size.',
      'Rotate the picture left or right first if it was taken sideways. The cropped picture keeps the original quality and format, and everything happens on your device, so ID photos and documents are never uploaded.'
    ],
    steps: ['Choose or drop the picture you want to crop.', 'Pick a shape (or Free) and drag the box over the part to keep. Rotate if needed.', 'Click Crop and save to download the cropped picture.'],
    feats: [['Drag to crop', 'Move and resize the box with a mouse or finger.'], ['Ready-made shapes', 'Square, 4:5, 3:4, 4:3, 16:9, A4 and passport.'], ['Rotate', 'Turn sideways photos before cropping.'], ['Exact size shown', 'See the crop size in pixels while you drag.']],
    faq: [['How do I crop a photo to a square?', 'Choose “Square 1:1”, move the box over the face or object, and click Crop and save.'], ['Will cropping reduce quality?', 'No. The kept part is saved at its original resolution. Use Compress Image afterwards if you need fewer KB.'], ['Can I crop on my phone?', 'Yes. Drag the box and its corners with your finger.']],
    rel: ['passport-size-photo', 'resize-image', 'compress-image', 'png-to-jpg', 'jpg-to-pdf']
  },
  'passport-size-photo': {
    title: 'Passport Size Photo Maker Online{F} – Crop to 3.5 × 4.5 cm',
    desc: 'Make a passport size photo online: crop any photo to the 3.5 × 4.5 cm shape for passport, visa, ID and exam forms, then reduce the KB.',
    lead: 'Crop any photo to the exact passport-photo shape in seconds.',
    intro: [
      'Indian passport, PAN, Aadhaar updates, exam and job application forms ask for a photo in the 3.5 × 4.5 cm passport shape. This tool opens your photo with a crop box already set to that shape: move it so your face is centred with a little space above the head, then save.',
      'If the form also has a size limit such as 20–50 KB, run the cropped photo through Compress Image, or set its pixel size with Resize Image. Your photo is processed on your own device and never uploaded.'
    ],
    steps: ['Choose a clear, front-facing photo with a plain background.', 'Move and resize the passport-shaped box so the face is centred.', 'Click Crop and save, then compress it if the form has a KB limit.'],
    feats: [['Exact shape', '3.5 × 4.5 cm proportions (7:9) are kept while you resize.'], ['Works with any photo', 'From your phone camera or a scan.'], ['Then compress', 'Bring the file under 20 KB, 50 KB or 100 KB with Compress Image.'], ['Private', 'Your face photo never leaves your device.']],
    faq: [['What size is a passport photo in pixels?', 'Forms vary. Many ask for about 200 × 230 px up to 600 × 600 px; check your form, then use Resize Image after cropping.'], ['Can I change the background to white?', 'Not in this tool. Take the photo against a white or light wall for the best result.'], ['How do I print several passport photos on one sheet?', 'Convert the photo to PDF with JPG to PDF, then use Multiple Pages per Sheet, or print several copies from your photo app.']],
    rel: ['crop-image', 'compress-image', 'resize-image', 'jpg-to-pdf', 'png-to-jpg']
  },
  'jpg-to-png': {
    title: 'JPG to PNG Converter Online{F} – Convert JPG to PNG',
    desc: 'Convert JPG images to PNG online. Batch convert many photos at once, in high quality. Free, no upload, works on phone and computer.',
    lead: 'Turn JPG pictures into PNG files in one click.',
    intro: [
      'PNG is the format designers and many websites prefer for logos, screenshots and images you plan to edit, because it never adds compression blur when saved again. JPG to PNG converts one or many JPG photos into PNG files at full quality.',
      'Note that PNG files of photographs are usually larger than JPG. To make a picture smaller instead, use Compress Image. Conversion runs in your browser, so nothing is uploaded.'
    ],
    steps: ['Choose or drop one or more JPG pictures.', 'Check that “PNG” is selected as the format.', 'Click Convert and download the PNG files (several come as a ZIP).'],
    feats: [['Batch', 'Convert many JPGs together.'], ['Full quality', 'No extra compression is added.'], ['Other formats too', 'Also converts to JPG and WebP.'], ['Private', 'No upload.']],
    faq: [['Does converting JPG to PNG improve quality?', 'No. It keeps the quality the JPG already has and stops further loss when you edit and save again.'], ['Will the background become transparent?', 'No. A JPG has no transparency, so the PNG keeps the same background.'], ['Why is the PNG bigger?', 'PNG stores every pixel without lossy compression. Use JPG for photos when file size matters.']],
    rel: ['png-to-jpg', 'webp-to-jpg', 'compress-image', 'crop-image', 'resize-image']
  },
  'webp-to-jpg': {
    title: 'WebP to JPG Converter Online{F} – Convert WebP Images',
    desc: 'Convert WebP images to JPG online so they open in every app and upload form. Batch convert, high quality, no upload.',
    lead: 'Turn WebP pictures from websites into JPG files that work everywhere.',
    intro: [
      'Pictures saved from websites often come as .webp files, which some apps, older phones and upload forms refuse to accept. WebP to JPG converts them into standard JPG photos in high quality, one at a time or many together.',
      'You can also convert WebP to PNG if you need transparency. Everything happens on your device.'
    ],
    steps: ['Choose or drop the WebP pictures.', 'Check that “JPG” is selected as the format.', 'Click Convert and download the JPG files.'],
    feats: [['Works everywhere', 'JPG opens in every app, phone and form.'], ['Batch', 'Convert many WebP files at once.'], ['High quality', 'Saved at 92% JPG quality.'], ['Private', 'No upload.']],
    faq: [['Why are some pictures saved as WebP?', 'Websites use WebP because it is small and loads fast.'], ['What happens to transparent areas?', 'JPG has no transparency, so they become white. Choose PNG to keep them.'], ['Can I convert WebP to PDF?', 'Yes. Use JPG to PDF, which accepts WebP pictures too.']],
    rel: ['png-to-jpg', 'jpg-to-png', 'compress-image', 'jpg-to-pdf', 'resize-image']
  },
  'png-to-jpg': {
    title: 'PNG to JPG Converter Online{F} – Also JPG to PNG, WebP',
    desc: 'Convert PNG to JPG, JPG to PNG, or images to WebP online. Batch convert pictures in seconds. No upload, no sign-up.',
    lead: 'Change a picture’s format in one click.',
    intro: [
      'Some forms accept only JPG, while websites load faster with WebP and designers often need PNG. This converter changes PNG, JPG and WebP images into the format you need.',
      'Convert many pictures at once. Transparent PNG backgrounds become white when converted to JPG, since JPG has no transparency.'
    ],
    steps: ['Choose the images.', 'Pick the output format: JPG, PNG or WebP.', 'Click Convert and download.'],
    feats: [['Three formats', 'JPG, PNG and WebP in any direction.'], ['Batch', 'Convert many files together.'], ['High quality', 'Pictures are saved at 92% quality, with no visible loss.'], ['Private', 'No uploads.']],
    faq: [['Why is my JPG bigger than the PNG?', 'Simple graphics compress better as PNG. Keep PNG, or run Compress Image on the JPG.'], ['Can I convert HEIC from iPhone?', 'Most iPhones share photos as JPG automatically. If not, set Camera Formats to Most Compatible.'], ['Can I convert images to PDF?', 'Yes. Use JPG to PDF.']],
    rel: ['jpg-to-png', 'webp-to-jpg', 'compress-image', 'resize-image', 'crop-image', 'jpg-to-pdf']
  },
  'repair-pdf': {
    title: 'Repair PDF Online{F} – Fix Damaged PDF Files',
    desc: 'Repair corrupted or damaged PDF files that won’t open. Rebuilds the file from what can be recovered. Free and private.',
    lead: 'Recover PDFs that show errors or won’t open.',
    intro: [
      'PDFs can break when a download is interrupted, an email attachment is cut short or a program crashes while saving. Repair PDF rebuilds the file structure and recovers the pages and content that are still readable.',
      'The repaired file is saved as a new PDF; your original stays as it was.'
    ],
    steps: ['Choose the damaged PDF.', 'Click Repair.', 'Download the rebuilt PDF and check its pages.'],
    feats: [['Rebuilds structure', 'Fixes broken cross-reference tables and objects.'], ['Recovers pages', 'Keeps everything that can be read.'], ['Safe', 'The original file is not changed.'], ['Private', 'Runs on your device.']],
    faq: [['Can every PDF be repaired?', 'Not always. If the data is missing, it can’t be recovered, but the readable parts are saved.'], ['Why does my PDF say it is damaged?', 'Usually an incomplete download or a faulty program that saved it.'], ['Will repairing remove a password?', 'No. Use Unlock PDF if you know the password.']],
    rel: ['pdf-reader', 'compress-pdf', 'unlock-pdf', 'pdf-to-word', 'ocr-pdf']
  },
  'ocr-pdf': {
    title: 'OCR PDF Online{F} – Make Scanned PDFs Searchable',
    desc: 'OCR scanned PDFs online: recognise the text so you can search, select and copy it. English text recognition, runs on your device.',
    lead: 'Turn scanned pages into searchable, selectable text.',
    intro: [
      'A scanned PDF is a picture of a page, so you can’t search it or copy from it. OCR (optical character recognition) reads the text in the images and adds an invisible text layer, so the PDF looks the same but becomes searchable and selectable.',
      'Recognition runs in your browser, so scanned contracts, statements and IDs are never uploaded. It currently reads English text; always check names and numbers.'
    ],
    steps: ['Choose the scanned PDF.', 'Click Start OCR and wait while each page is read.', 'Download the searchable PDF.'],
    feats: [['Searchable', 'Find words in scanned documents.'], ['Copy text', 'Select and copy from scanned pages.'], ['Looks the same', 'The page image is kept as it was.'], ['Private', 'No upload to an OCR server.']],
    faq: [['Which languages are supported?', 'English text is recognised. Other languages may give poor results for now.'], ['How long does OCR take?', 'A few seconds per page on a modern computer; longer on phones.'], ['Can I convert a scan to Word or Excel?', 'Yes. PDF to Word and PDF to Excel can read scanned pages too.']],
    rel: ['pdf-to-text', 'pdf-to-word', 'pdf-to-excel', 'edit-pdf', 'compress-pdf']
  },
  'flatten-pdf': {
    title: 'Flatten PDF Online{F} – Lock Form Fields & Comments',
    desc: 'Flatten a PDF to make form answers, comments and signatures part of the page so they can’t be changed or removed.',
    lead: 'Make filled forms and comments permanent.',
    intro: [
      'After filling a form or adding comments, the answers can still be edited by anyone who opens the file. Flattening merges form fields, annotations and stamps into the page itself, so they look the same everywhere and can’t be changed.',
      'Flatten before submitting forms, sending marked-up documents or printing.'
    ],
    steps: ['Choose the PDF.', 'Click Flatten.', 'Download the flattened PDF.'],
    feats: [['Locks answers', 'Form values become fixed text.'], ['Keeps comments visible', 'Annotations print and display everywhere.'], ['Prevents removal', 'Stamps and notes can’t be deleted.'], ['Fast', 'One click.']],
    faq: [['Can I unflatten a PDF?', 'No. Keep the original if you may need to edit again.'], ['Does flattening reduce file size?', 'Sometimes slightly. Use Compress PDF to reduce it further.'], ['Will a digital signature survive flattening?', 'Flatten before signing. Flattening a signed PDF breaks the signature.']],
    rel: ['fill-pdf-form', 'annotate-pdf', 'protect-pdf', 'esign-pdf', 'compress-pdf']
  },
  'grayscale-pdf': {
    title: 'Grayscale PDF Online{F} – Convert PDF to Black & White',
    desc: 'Convert a colour PDF to grayscale (black and white) for cheaper printing and smaller files. Free, private, works on phone.',
    lead: 'Turn colour pages into black and white.',
    intro: [
      'Grayscale converts every page of a colour PDF to shades of grey. Printing in black and white is cheaper, and some offices and portals ask for monochrome documents.',
      'Pick the quality: standard for most documents, high for printing, or small file for email.'
    ],
    steps: ['Choose the PDF.', 'Click Convert to grayscale.', 'Download the black-and-white PDF.'],
    feats: [['All pages', 'Text, images and graphics.'], ['Print savings', 'No colour ink used.'], ['Quality choice', 'Standard 150 dpi, high 220 dpi or small file 100 dpi.'], ['Private', 'Runs on your device.']],
    faq: [['Will text stay sharp?', 'Pages are redrawn as grey images at the quality you pick. Choose High (220 dpi) for crisp printing.'], ['Can I convert only some pages?', 'Extract those pages first, convert, then merge back.'], ['Is the original changed?', 'No. A new file is saved.']],
    rel: ['compress-pdf', 'pdf-pages-per-sheet', 'resize-pdf', 'watermark-pdf', 'pdf-to-jpg']
  },
  'jpg-to-pdf': {
    title: 'JPG to PDF Converter Online{F} – Images to One PDF',
    desc: 'Convert JPG, PNG and other images to PDF. Combine photos, scans and screenshots into one PDF with page size and margin options.',
    lead: 'Turn photos and scans into a neat PDF document.',
    intro: [
      'Combine photos of documents, scanned pages, screenshots and receipts into one PDF. Choose the page size (A4, Letter or fit to image), orientation and margins, and put the pictures in the right order.',
      'It is the easiest way to send ID proofs, certificates and handwritten notes as a single PDF from your phone or computer.'
    ],
    steps: ['Choose or drop your images.', 'Arrange them and pick page size, orientation and margins.', 'Click Convert and download the PDF.'],
    feats: [['Many images', 'All in one PDF.'], ['Page size options', 'A4, Letter or same as the image.'], ['Margins', 'None, small or large.'], ['From your phone', 'Take photos and convert them directly.']],
    faq: [['How do I make the PDF smaller?', 'Run Compress PDF on the result, or compress the images first.'], ['Can I add images to an existing PDF?', 'Convert the images, then use Merge PDF.'], ['Which formats are supported?', 'JPG, PNG, WebP and other common picture formats.']],
    rel: ['image-to-pdf', 'merge-pdf', 'compress-pdf', 'compress-image', 'pdf-to-jpg']
  },
  'image-to-pdf': {
    title: 'Image to PDF Converter Online{F} – Photos to PDF',
    desc: 'Convert pictures to a PDF file online. Combine one or many images, in any order, into a single PDF. Works on phone and computer.',
    lead: 'Make a PDF from one picture or many.',
    intro: [
      'Turn any picture into a PDF document, or combine a whole set of photos into one file. Useful for assignments, receipts for expense claims, property photos and scanned forms.',
      'Pictures are placed one per page, in the order you choose, with clean margins.'
    ],
    steps: ['Choose your pictures.', 'Put them in order and pick the page layout.', 'Click Convert and download the PDF.'],
    feats: [['Any picture format', 'JPG, PNG, WebP and more.'], ['Order', 'Drag images into place.'], ['Layout', 'Page size and margins.'], ['Private', 'No upload.']],
    faq: [['Can I put two photos on one page?', 'Convert them first, then use Multiple Pages per Sheet.'], ['Will the photo quality drop?', 'No. Pictures are kept as they are. Compress afterwards if needed.'], ['Does it work on iPhone?', 'Yes, in Safari and Chrome.']],
    rel: ['jpg-to-pdf', 'merge-pdf', 'compress-pdf', 'pdf-pages-per-sheet', 'png-to-jpg']
  },
  'word-to-pdf': {
    title: 'Word to PDF Converter Online{F} – DOCX to PDF',
    desc: 'Convert Word documents (.docx) to PDF online. Keep text, headings, tables and images. No Microsoft Word needed, files stay on your device.',
    lead: 'Turn Word documents into PDFs that look the same everywhere.',
    intro: [
      'A PDF looks the same on every phone, computer and printer, while a Word file can shift around. Word to PDF converts .docx documents, keeping paragraphs, headings, lists, tables and pictures.',
      'You don’t need Microsoft Word installed. The conversion runs in your browser, so resumes, letters and agreements stay private.'
    ],
    steps: ['Choose the .docx file.', 'Click Convert.', 'Download the PDF.'],
    feats: [['No Word needed', 'Works in any browser.'], ['Keeps layout', 'Headings, lists, tables and images.'], ['Unicode text', 'Symbols like ₹ and € are kept.'], ['Private', 'No upload.']],
    faq: [['Does it support old .doc files?', 'Save the file as .docx in Word or LibreOffice first.'], ['Will complex designs look identical?', 'Most documents convert closely. Very complex layouts may differ slightly.'], ['Can I convert PDF back to Word?', 'Yes, with PDF to Word.']],
    rel: ['pdf-to-word', 'excel-to-pdf', 'text-to-pdf', 'merge-pdf', 'compress-pdf']
  },
  'excel-to-pdf': {
    title: 'Excel to PDF Converter Online{F} – XLSX & CSV to PDF',
    desc: 'Convert Excel spreadsheets (.xlsx) and CSV files to neat PDF tables. Free, no Excel needed, files stay on your device.',
    lead: 'Turn spreadsheets into tidy PDF tables for sharing and printing.',
    intro: [
      'Excel to PDF turns each sheet of an .xlsx workbook, or a .csv file, into a clean PDF table with readable columns. Send price lists, invoices, attendance sheets and reports to people who don’t have Excel.',
      'The conversion happens on your device, so financial data is never uploaded.'
    ],
    steps: ['Choose the .xlsx or .csv file.', 'Click Convert.', 'Download the PDF.'],
    feats: [['XLSX and CSV', 'Both formats supported.'], ['All sheets', 'Each sheet becomes its own section.'], ['Readable tables', 'Columns sized to fit the page.'], ['Private', 'No upload.']],
    faq: [['Are formulas kept?', 'The PDF shows the calculated values, not formulas.'], ['Can I convert PDF tables to Excel?', 'Yes, with PDF to Excel.'], ['What about very wide sheets?', 'Wide sheets are scaled to fit; landscape helps.']],
    rel: ['pdf-to-excel', 'word-to-pdf', 'text-to-pdf', 'merge-pdf', 'compress-pdf']
  },
  'text-to-pdf': {
    title: 'Text to PDF Converter Online{F} – TXT to PDF',
    desc: 'Convert plain text (.txt) files to clean, readable PDF pages online. Free, fast and private.',
    lead: 'Turn .txt files into tidy PDF pages.',
    intro: [
      'Text to PDF lays out plain text files on standard pages with comfortable margins and line spacing, so notes, logs and code listings are easy to read, print and share.',
      'Long lines wrap neatly and pages break automatically.'
    ],
    steps: ['Choose the .txt file.', 'Click Convert.', 'Download the PDF.'],
    feats: [['Font choice', 'Helvetica, Times or Courier.'], ['Wrapping', 'Long lines wrap automatically.'], ['Unicode', 'Symbols such as ₹ are kept.'], ['Private', 'No upload.']],
    faq: [['Can I choose the font?', 'Yes. Helvetica, Times or Courier (fixed width), from 9 to 12 pt.'], ['Can I convert PDF to text?', 'Yes, with PDF to Text.'], ['Does it work with large files?', 'Yes, thousands of lines are fine.']],
    rel: ['pdf-to-text', 'word-to-pdf', 'excel-to-pdf', 'merge-pdf', 'compress-pdf']
  },
  'pdf-to-word': {
    title: 'PDF to Word Converter Online{F} – Editable DOCX',
    desc: 'Convert PDF to an editable Word document (.docx) online, scanned PDFs included. Keeps text, paragraphs and images. No sign-up.',
    lead: 'Turn a PDF into a Word file you can edit.',
    intro: [
      'PDF to Word rebuilds the text, paragraphs and pictures of your PDF as an editable .docx document, so you can change a resume, update an agreement or reuse a report in Microsoft Word, Google Docs or LibreOffice.',
      'Scanned PDFs are read with text recognition. The conversion runs on your device, keeping confidential documents private.'
    ],
    steps: ['Choose the PDF.', 'Click Convert to Word.', 'Download the .docx file and open it in Word.'],
    feats: [['Editable text', 'Paragraphs you can type into.'], ['Images kept', 'Pictures are placed in the document.'], ['Scans too', 'Text recognition for scanned pages.'], ['Private', 'No upload.']],
    faq: [['Will the Word file look exactly like the PDF?', 'Simple documents convert closely. Complex designs are rebuilt as closely as possible and may need small fixes.'], ['Can I convert a scanned PDF to Word?', 'Yes. English text in scans is recognised.'], ['Do I need Microsoft Word?', 'Only to open the result. Google Docs and LibreOffice open .docx files too.']],
    rel: ['word-to-pdf', 'pdf-to-excel', 'pdf-to-text', 'ocr-pdf', 'edit-pdf', 'pdf-to-powerpoint']
  },
  'pdf-to-powerpoint': {
    title: 'PDF to PowerPoint Converter Online{F} – PDF to PPTX',
    desc: 'Convert PDF to PowerPoint slides (.pptx) online, one page per slide. Present any PDF in PowerPoint or Google Slides.',
    lead: 'Turn PDF pages into a slide deck.',
    intro: [
      'PDF to PowerPoint creates a .pptx presentation with one slide for each PDF page, in high quality, so you can present a PDF in PowerPoint, add speaker notes or insert the pages into another deck.',
      'Conversion runs in your browser without uploading.'
    ],
    steps: ['Choose the PDF.', 'Click Convert.', 'Download the .pptx file.'],
    feats: [['One page per slide', 'Keeps the order.'], ['High quality', 'Sharp slides for projectors.'], ['Widescreen or standard', 'Slides match the page shape.'], ['Private', 'No upload.']],
    faq: [['Is the text editable in PowerPoint?', 'Each page is placed as a high-quality picture. Use PDF to Word for editable text.'], ['Does it work with Google Slides?', 'Yes. Import the .pptx file.'], ['Can I convert slides back to PDF?', 'Save as PDF from PowerPoint.']],
    rel: ['pdf-to-jpg', 'pdf-to-word', 'pdf-to-excel', 'compress-pdf', 'pdf-pages-per-sheet']
  },
  'pdf-to-excel': {
    title: 'PDF to Excel Converter Online{F} – Bank Statement to Excel',
    desc: 'Convert PDF to Excel online: bank statements, invoices and tables to .xlsx, scanned PDFs included. Accurate columns, no upload.',
    lead: 'Get the tables out of a PDF and into a spreadsheet.',
    intro: [
      'PDF to Excel detects the tables in your PDF and rebuilds them as rows and columns in an .xlsx spreadsheet. Statement mode reads bank, wallet and credit-card statements in any layout: it keeps multi-line descriptions in one cell, splits CR/DR amounts into Debit and Credit columns and checks the running balance. Any table mode handles invoices, price lists and reports.',
      'Scanned statements are read with text recognition. Everything runs on your device, which matters for bank and salary data.'
    ],
    steps: ['Choose the PDF statement or report (or photos of the pages).', 'Pick Statement or Any table, check the rows and correct any cell by typing.', 'Download as Excel or CSV.'],
    feats: [['Bank statements', 'Dates, descriptions, debits, credits and balances in separate columns.'], ['Scanned PDFs', 'Text recognition for scans and photos.'], ['Balance check', 'Rows that don’t add up to the running balance are shown in red.'], ['Private', 'Financial data never leaves your device.']],
    faq: [['How do I convert a bank statement PDF to Excel?', 'Choose the statement, check the columns in the preview and download. Password-protected statements open after you type the password (often your customer ID or date of birth).'], ['Are numbers kept as numbers?', 'Yes. Amounts become numbers you can sum in Excel.'], ['Can I convert Excel back to PDF?', 'Yes, with Excel to PDF.']],
    rel: ['excel-to-pdf', 'pdf-to-word', 'unlock-pdf', 'ocr-pdf', 'pdf-to-text']
  },
  'pdf-to-jpg': {
    title: 'PDF to JPG Converter Online{F} – Save Pages as Images',
    desc: 'Convert PDF pages to JPG or PNG images online in high quality. All pages or chosen pages, downloaded as a ZIP. No upload.',
    lead: 'Save each PDF page as a picture.',
    intro: [
      'PDF to JPG turns every page, or the pages you choose, into JPG or PNG images in the resolution you pick. Use the images on websites, in WhatsApp chats, presentations or upload forms that accept only pictures.',
      'Multiple pages download together as a ZIP.'
    ],
    steps: ['Choose the PDF.', 'Pick JPG or PNG, the quality and the pages.', 'Click Convert and download.'],
    feats: [['JPG or PNG', 'Choose the format.'], ['Resolution', 'From screen quality to print quality.'], ['Selected pages', 'Convert only what you need.'], ['ZIP', 'All images in one download.']],
    faq: [['What resolution should I pick?', 'Screen quality for sharing, high for printing.'], ['Can I get the pictures inside a PDF instead?', 'Use Extract Images from PDF.'], ['Can I convert JPG back to PDF?', 'Yes, with JPG to PDF.']],
    rel: ['jpg-to-pdf', 'extract-images-from-pdf', 'compress-image', 'pdf-to-powerpoint', 'compress-pdf']
  },
  'pdf-to-text': {
    title: 'PDF to Text Online{F} – Extract Text from PDF',
    desc: 'Extract all text from a PDF online, scanned PDFs included. Copy it or download a .txt file. Free, private, no sign-up.',
    lead: 'Copy all the words out of a PDF.',
    intro: [
      'PDF to Text pulls every word from your PDF into plain text you can copy, search or paste into another program. Scanned pages are read with text recognition.',
      'Ideal for quoting reports, reusing content or feeding text into other tools.'
    ],
    steps: ['Choose the PDF.', 'Click Extract text.', 'Copy the text or download it as a .txt file.'],
    feats: [['All pages', 'The whole document at once.'], ['Scans', 'Text recognition included.'], ['Copy or save', 'Clipboard or .txt.'], ['Private', 'No upload.']],
    faq: [['Will formatting be kept?', 'Plain text has no formatting. Use PDF to Word to keep layout.'], ['Can it read Hindi?', 'Text that is already in the PDF in any language is extracted. Recognition of scans works for English.'], ['Is there a page limit?', 'No fixed limit.']],
    rel: ['pdf-to-word', 'ocr-pdf', 'text-to-pdf', 'pdf-to-excel', 'pdf-reader']
  },
  'extract-images-from-pdf': {
    title: 'Extract Images from PDF Online{F} – Save All Pictures',
    desc: 'Extract every image from a PDF in its original quality and download them as a ZIP. Free, private, works on phone.',
    lead: 'Get the original pictures out of a PDF.',
    intro: [
      'Extract Images saves the photos, logos and graphics embedded in your PDF as separate image files, in the quality they were stored, without screenshots.',
      'All images download together in one ZIP file.'
    ],
    steps: ['Choose the PDF.', 'Click Extract.', 'Download the images as a ZIP.'],
    feats: [['Original quality', 'No re-compression.'], ['Every image', 'From all pages.'], ['ZIP download', 'One file.'], ['Private', 'No upload.']],
    faq: [['Why are some images missing?', 'Vector drawings and text are not images. Use PDF to JPG to capture whole pages.'], ['What formats do I get?', 'Usually JPG or PNG, depending on how the image was stored.'], ['Can I extract from scanned PDFs?', 'Each scanned page is one image, so you get the page scans.']],
    rel: ['pdf-to-jpg', 'compress-image', 'pdf-to-word', 'jpg-to-pdf', 'compress-pdf']
  },
  'protect-pdf': {
    title: 'Protect PDF with Password Online{F} – Encrypt PDF',
    desc: 'Add a password to a PDF and choose whether others can print, copy or edit it. Strong AES encryption, done on your device.',
    lead: 'Lock a PDF with a password before you send it.',
    intro: [
      'Protect PDF encrypts your document so it opens only with the password you set. You can also set permissions, such as stopping printing, copying text or editing.',
      'Encryption is done in your browser with strong AES, so the unprotected file never leaves your device.'
    ],
    steps: ['Choose the PDF.', 'Type a password and choose the permissions.', 'Click Protect and download the encrypted PDF.'],
    feats: [['AES encryption', 'Industry-standard protection.'], ['Permissions', 'Control printing, copying and editing.'], ['Works everywhere', 'Opens in any PDF reader with the password.'], ['Private', 'No upload.']],
    faq: [['What if I forget the password?', 'It can’t be recovered. Keep the password safe or keep an unprotected copy.'], ['How do I remove the password later?', 'Use Unlock PDF and type the password.'], ['Can I protect a signed PDF?', 'Protect before signing, because changing a signed file breaks the signature.']],
    rel: ['unlock-pdf', 'redact-pdf', 'esign-pdf', 'watermark-pdf', 'flatten-pdf']
  },
  'unlock-pdf': {
    title: 'Unlock PDF Online{F} – Remove PDF Password',
    desc: 'Remove the password from a PDF you can open, and lift printing and copying restrictions. Ideal for bank statements. No upload.',
    lead: 'Save a copy of a PDF without its password.',
    intro: [
      'Bank statements, salary slips and e-statements often come protected with a password such as your date of birth or customer ID. Unlock PDF removes the password, and any printing or copying restrictions, so you don’t have to type it every time.',
      'You need to know the password; this tool does not crack passwords. The file is processed on your device.'
    ],
    steps: ['Choose the protected PDF.', 'Type its password.', 'Click Unlock and download the copy without a password.'],
    feats: [['Removes open password', 'No more typing the password.'], ['Lifts restrictions', 'Allows printing and copying.'], ['Bank statements', 'Works with common bank and card statement PDFs.'], ['Private', 'No upload.']],
    faq: [['Can you unlock a PDF without the password?', 'No. You need the password to open it. Restrictions on printing or copying can be removed if the file opens without a password.'], ['What is my bank statement password?', 'Banks usually use a combination of your name, date of birth or customer ID; check the email that came with the statement.'], ['Is it legal?', 'Yes, for documents you own or are allowed to use.']],
    rel: ['protect-pdf', 'pdf-to-excel', 'compress-pdf', 'merge-pdf', 'pdf-reader']
  },
  'redact-pdf': {
    title: 'Redact PDF Online{F} – Black Out Text Permanently',
    desc: 'Redact a PDF: permanently black out account numbers, addresses and private details. The hidden text is removed, not just covered.',
    lead: 'Hide private information so it can’t be recovered.',
    intro: [
      'Drawing a black box over text in most editors only covers it; the words can still be copied out. Redact PDF removes the content under the box for good, so account numbers, Aadhaar and PAN numbers, phone numbers and addresses are really gone.',
      'Redact before sharing documents with third parties, uploading to portals or publishing.'
    ],
    steps: ['Choose the PDF.', 'Draw boxes over the information to hide.', 'Apply the redaction and download the cleaned PDF.'],
    feats: [['Permanent', 'Text and images under the box are removed.'], ['Any area', 'Draw boxes anywhere.'], ['Pictures too', 'Black out parts of photos and scans, not just text.'], ['Private', 'No upload.']],
    faq: [['Can redacted text be recovered?', 'No. The content under the box is deleted from the file.'], ['Can I redact a scanned page?', 'Yes. The image area under the box is removed.'], ['Should I keep the original?', 'Yes, store the unredacted original safely.']],
    rel: ['protect-pdf', 'edit-pdf', 'crop-pdf', 'flatten-pdf', 'edit-pdf-metadata']
  },
  'compare-pdf': {
    title: 'Compare PDF Online{F} – Find Differences Between PDFs',
    desc: 'Compare two PDF files and see what changed: added, removed and changed text highlighted side by side. Free and private.',
    lead: 'Spot the changes between two versions of a document.',
    intro: [
      'Compare PDF puts two versions side by side and highlights the text that was added, removed or changed. Check what the other side edited in a contract, catch changes between drafts, or verify a revised quotation.',
      'Both files are compared on your device, so confidential drafts stay private.'
    ],
    steps: ['Choose the original PDF.', 'Choose the new version.', 'Review the highlighted differences page by page.'],
    feats: [['Side by side', 'Both versions together.'], ['Highlights', 'Added and removed text in colour.'], ['Page by page', 'Move through every change.'], ['Private', 'No upload.']],
    faq: [['Can it compare scanned PDFs?', 'Run OCR on both first so the text can be compared.'], ['Does it compare images?', 'It compares the text. Check pictures visually in the side-by-side view.'], ['Can I compare Word files?', 'Convert them to PDF first with Word to PDF.']],
    rel: ['verify-pdf-signature', 'ocr-pdf', 'word-to-pdf', 'annotate-pdf', 'pdf-reader']
  },
  'add-page-numbers-to-pdf': {
    title: 'Add Page Numbers to PDF Online{F} – Number Pages',
    desc: 'Add page numbers to a PDF: choose position, style (1, Page 1 of 10), font size and starting number. Free, fast and private.',
    lead: 'Number the pages of any PDF.',
    intro: [
      'Add page numbers at the top or bottom, left, centre or right, in styles like “1”, “Page 1”, “Page 1 of 10” or Roman numerals. Start from any number and skip the cover page if you need to.',
      'Numbered pages make reports, theses, legal bundles and manuals easy to reference.'
    ],
    steps: ['Choose the PDF.', 'Pick the position, style and starting number.', 'Click Add numbers and download.'],
    feats: [['Six positions', 'Top or bottom, left, centre or right.'], ['Styles', '1, Page 1, Page 1 of N, 1 / N or i, ii, iii.'], ['Start anywhere', 'Choose the first number and first page.'], ['Private', 'No upload.']],
    faq: [['Can I skip the first page?', 'Yes. Start numbering from page 2.'], ['Can I use Roman numerals?', 'Yes. Choose the i, ii, iii style. Other styles are 1, Page 1, Page 1 of 9 and 1 / 9.'], ['Can I add text with the number?', 'Use Header and Footer for custom text.']],
    rel: ['pdf-header-footer', 'watermark-pdf', 'merge-pdf', 'organize-pdf', 'edit-pdf']
  },
  'watermark-pdf': {
    title: 'Watermark PDF Online{F} – Add Text or Logo Watermark',
    desc: 'Add a text or logo watermark to PDF pages: CONFIDENTIAL, DRAFT or your company logo, with position, size and transparency.',
    lead: 'Stamp text or your logo across PDF pages.',
    intro: [
      'Watermarks mark documents as CONFIDENTIAL, DRAFT or COPY, or brand them with your company logo. Choose diagonal, straight or tiled layout, the strength and colour, on every page or selected pages.',
      'A watermark discourages misuse and shows where a document came from.'
    ],
    steps: ['Choose the PDF.', 'Type the watermark text or choose a logo, and set its style.', 'Click Add watermark and download.'],
    feats: [['Text or image', 'Words or your logo.'], ['Strength', 'Light, medium, strong or very strong.'], ['Layout', 'Diagonal, straight or repeated across the page.'], ['Pages', 'All or selected.']],
    faq: [['Can a watermark be removed?', 'Flatten the PDF after watermarking to make removal harder.'], ['Will it cover the text?', 'Use transparency so the content stays readable.'], ['Can I watermark images?', 'Convert them to PDF first.']],
    rel: ['pdf-header-footer', 'add-page-numbers-to-pdf', 'protect-pdf', 'flatten-pdf', 'edit-pdf']
  },
  'pdf-header-footer': {
    title: 'Add Header and Footer to PDF Online{F}',
    desc: 'Add header and footer text to PDF pages: company name, document title, date or reference number, at the top or bottom.',
    lead: 'Put the same text at the top or bottom of every page.',
    intro: [
      'Add a company name, document title, case number, date or confidentiality notice to the header or footer of every page, left, centre or right.',
      'Headers and footers give documents a consistent, professional look and make printed pages easy to identify.'
    ],
    steps: ['Choose the PDF.', 'Type the header and footer text and choose positions.', 'Click Apply and download.'],
    feats: [['Top and bottom', 'Header, footer or both.'], ['Codes', 'Use {page}, {pages}, {date} and {file} in the text.'], ['Alignment and size', 'Left, centre or right, 8 to 12 pt.'], ['Private', 'No upload.']],
    faq: [['Can I add page numbers too?', 'Yes. Use Add Page Numbers as well.'], ['Can I add the date or file name?', 'Yes. Type {date} or {file} and it is filled in on every page.'], ['Will it overlap existing text?', 'Leave a margin or use Resize PDF to make room.']],
    rel: ['add-page-numbers-to-pdf', 'watermark-pdf', 'edit-pdf', 'edit-pdf-metadata', 'merge-pdf']
  },
  'edit-pdf-metadata': {
    title: 'Edit PDF Metadata Online{F} – Title, Author, Keywords',
    desc: 'Change or remove a PDF’s title, author, subject and keywords. Clean hidden document properties before sharing.',
    lead: 'Change or clean the hidden properties of a PDF.',
    intro: [
      'Every PDF carries hidden properties: title, author, subject, keywords, the program that created it and dates. Edit them to give your document a proper title in browser tabs and search results, or remove them for privacy before sharing.',
      'Search engines show the PDF title in results, so a clear title helps documents you publish online.'
    ],
    steps: ['Choose the PDF.', 'Edit or clear the title, author, subject and keywords.', 'Save the updated PDF.'],
    feats: [['All main fields', 'Title, author, subject, keywords.'], ['Remove hidden data', 'Wipe hidden XMP metadata for privacy.'], ['Better titles', 'Shown in browser tabs and search.'], ['Private', 'No upload.']],
    faq: [['Why does my PDF show the wrong title?', 'The title property was set by the program that made it. Change it here.'], ['Does this change the content?', 'No. Only the properties change.'], ['Can I remove all metadata?', 'Yes, clear every field before saving.']],
    rel: ['protect-pdf', 'redact-pdf', 'pdf-header-footer', 'compress-pdf', 'edit-pdf']
  },
  'split-pdf-by-size': {
    title: 'Split PDF by Size Online{F} – Parts Under 1 MB, 2 MB',
    desc: 'Split a big PDF into smaller files that are each under 500 KB, 1 MB, 2 MB or your own size. Fits upload limits. Free, private, no sign-up.',
    lead: 'Cut a large PDF into parts that fit your upload or email limit.',
    intro: [
      'Many portals and email services refuse files above a size limit. Split by size cuts your PDF into several files, each under the size you choose, such as 1 MB or 2 MB. Pages are never cut in half, and every part is checked after it is made so it really is under the limit.',
      'If a single page is bigger than the limit on its own, you are told which page, so you can compress it. The parts download together in one ZIP file.'
    ],
    steps: ['Choose the PDF.', 'Pick the largest size each file may have, or type your own, like 800 KB.', 'Click Split by size and download the ZIP with all the parts.'],
    feats: [['Every part checked', 'Each file is saved and measured, so it is under your limit.'], ['Your own size', 'Choose 500 KB to 10 MB, or type any size.'], ['Whole pages', 'Pages stay complete and in order.'], ['Private', 'The file is processed on your device and never uploaded.']],
    faq: [['What if one page is bigger than the limit?', 'That page is kept on its own and the result tells you which page it is. Use Compress PDF on it.'], ['Does it change my original file?', 'No. Your original is untouched and the parts are new files.'], ['What is the difference from Split PDF?', 'Split PDF cuts by page numbers. Split by size cuts by file size.']],
    rel: ['split-pdf', 'compress-pdf', 'merge-pdf', 'extract-pdf-pages', 'remove-pdf-pages']
  },
  'remove-blank-pages-from-pdf': {
    title: 'Remove Blank Pages from PDF Online{F} – Delete Empty Pages',
    desc: 'Find and delete blank pages in a scanned PDF. Ignores dust and scanner marks. Your original is never changed. Free, private, no sign-up.',
    lead: 'Take the empty pages out of a scan automatically.',
    intro: [
      'Scanners often leave blank pages between sheets, especially with double-sided scanning. This tool looks at how each page really appears and removes the ones with nothing on them, including pages with only dust or scanner specks.',
      'Choose how strict it should be. Careful keeps any page with a small mark, Standard ignores dust and tiny marks, and Strict also removes pages with only a page number. The result lists the pages that were removed so you can check.'
    ],
    steps: ['Choose the PDF.', 'Pick Standard, Careful or Strict.', 'Click Remove blank pages and check the list of removed pages.'],
    feats: [['Three levels', 'Careful, Standard or Strict, to suit your scans.'], ['Ignores dust', 'Lone specks and scanner edges do not count as content.'], ['Tells you what it did', 'Shows exactly which pages were removed.'], ['Original kept', 'You get a new file; the original is unchanged.']],
    faq: [['Will it remove a page with only a page number?', 'Not on Standard or Careful. Choose Strict to remove those too.'], ['What if no page is blank?', 'The file is returned unchanged and you are told so.'], ['Does it work on scans?', 'Yes. It looks at the picture of each page, so scans work well.']],
    rel: ['remove-pdf-pages', 'organize-pdf', 'compress-pdf', 'ocr-pdf', 'split-pdf']
  },
  'image-to-text': {
    title: 'Image to Text Online{F} – Read Text from Photos (OCR)',
    desc: 'Read the text from a photo, scan or screenshot and save it as text, Word or a searchable PDF. Runs on your device. Free, no sign-up.',
    lead: 'Turn a picture of text into text you can copy and edit.',
    intro: [
      'Add one or more photos, scans or screenshots and the words in them are read on your own device. Save the result as a plain text file, an editable Word document, or a searchable PDF that keeps the picture and adds hidden text.',
      'It reads English. Clear, straight and well-lit pictures give the best results, so always check names and numbers before you rely on them.'
    ],
    steps: ['Choose your pictures and put them in order.', 'Pick text file, Word document or searchable PDF.', 'Click Read the text and download the result.'],
    feats: [['Three formats', 'Text file, Word document or searchable PDF.'], ['Many pictures', 'Add several and get one result.'], ['Private', 'Pictures are read on your device, never uploaded.'], ['Free', 'No sign-up needed.']],
    faq: [['Which languages work?', 'English. Other languages are not read yet.'], ['Why are some words wrong?', 'Blurry, tilted or dark pictures are harder to read. Retake the photo in good light.'], ['Can I read a PDF?', 'Yes, use PDF to Text or OCR PDF for scanned PDFs.']],
    rel: ['pdf-to-text', 'ocr-pdf', 'pdf-to-word', 'scan-to-pdf', 'jpg-to-pdf']
  },
  'scan-to-pdf': {
    title: 'Scan to PDF Online{F} – Make a PDF from Phone Photos',
    desc: 'Photograph papers with your phone and make one clean PDF. Trims the table, cleans the page, black and white mode. Free, private.',
    lead: 'Use your phone as a scanner.',
    intro: [
      'Take a photo of each page with your phone, or add photos you already have. Each picture is cleaned up like a scanner would: the table around the paper is trimmed away, the page is whitened, and black and white mode makes text sharp and readable.',
      'Put the pages in order and make one PDF. Everything happens on your device, so ID cards, bank papers and forms are never uploaded.'
    ],
    steps: ['Press Take a photo for each page, or add pictures.', 'Choose Black and white, Grey or Colour, and the page size.', 'Click Make PDF and download it.'],
    feats: [['Clean pages', 'Black and white mode makes text sharp, even in uneven light.'], ['Auto trim', 'Removes the table around the paper when it is clear.'], ['Many pages', 'Join any number of photos in your order.'], ['Private', 'Nothing is uploaded.']],
    faq: [['Does it straighten a tilted photo?', 'It trims the area around the paper but does not correct perspective. Hold the phone straight above the page.'], ['How do I make the file smaller?', 'Use Compress PDF on the result.'], ['Does it work on a computer?', 'Yes. Add photos or scans from your computer.']],
    rel: ['jpg-to-pdf', 'compress-pdf', 'merge-pdf', 'image-to-text', 'ocr-pdf']
  },
  'stamp-pdf': {
    title: 'Add Stamp or QR Code to PDF Online{F} – PAID, APPROVED',
    desc: 'Stamp PAID, RECEIVED, APPROVED or your own text, or add a QR code, to PDF pages. Choose position, colour and pages. Free and private.',
    lead: 'Put a PAID or APPROVED stamp, or a QR code, on your PDF.',
    intro: [
      'Add a ready-made stamp such as PAID, RECEIVED, APPROVED, REJECTED, CONFIDENTIAL, DRAFT or COPY, or type your own text. You can also add a QR code that holds a link or a number, for example an invoice or payment link.',
      'Choose the colour, size, position and the pages: all pages, the first or last page, or pages you pick. You can add today’s date to the stamp.'
    ],
    steps: ['Choose the PDF.', 'Pick the stamp or QR code, its position, size and pages.', 'Click Add stamp and download the PDF.'],
    feats: [['Ready-made stamps', 'PAID, APPROVED, RECEIVED and more, with an optional date.'], ['QR codes', 'Add a link or text up to about 200 characters.'], ['Any pages', 'All, first, last or a range.'], ['Private', 'Processed on your device.']],
    faq: [['Will the QR code scan?', 'Yes. It is black on white with a clear border, so phones read it easily.'], ['Can I use Hindi text in a stamp?', 'Not yet. Stamps use English letters and numbers. A QR code can hold any text.'], ['Can I remove a stamp later?', 'Keep your original file. The stamped copy is a new file.']],
    rel: ['watermark-pdf', 'add-page-numbers-to-pdf', 'sign-pdf', 'pdf-header-footer', 'edit-pdf']
  }
};

module.exports = { C, UPDATED };
