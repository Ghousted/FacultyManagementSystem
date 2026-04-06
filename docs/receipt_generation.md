**Receipt Generation System**

This document describes a printable receipt generation system used after confirming a student's payment. The system shows a modal preview UI containing both a `CCS Copy` and a `Student Copy`, assigns a unique receipt number using the `MMYY-0000` format, and prints the preview using `html2canvas`.

**Overview**
- **Purpose:** Generate a printable two-copy receipt after payment confirmation so the cashier (CCS) and the student each retain a copy.
- **Outputs:** A modal preview that shows both copies side-by-side and a printable image/PDF triggered via `html2canvas`.

**Receipt Fields**
- **Receipt Number:** Format `MMYY-0000` (explained below).
- **Student Name:** Full name of the payer.
- **Date:** Date of payment (displayed e.g., Apr. 6, 2026).
- **Course:** Student's course/program.
- **Year Level:** `1st`, `2nd`, `3rd`, `4th` or `Irregular` as applicable.
- **Description:** What the payment covers (tuition, lab fee, previous balance, etc.).
- **Price / Amount:** Numeric amount paid for the line item.
- **Mode of Payment:** `cash` or `check` (capitalize when displayed as desired).
- **Received By:** Blank line for the receiver's signature / printed name.

Each receipt shows two identical sections: the top/left is labeled `CCS Copy` and the bottom/right (or second column) is labeled `Student Copy` so both parties have matching information.

**Receipt Numbering: MMYY-0000**
- **MM:** Two-digit month (01-12). Use local month from the confirmed-payment timestamp.
- **YY:** Two-digit year (e.g., 26 for 2026).
- **0000:** Four-digit, zero-padded incremental counter for that month-year (starts at `0001`). Example: the first payer on April 2026 -> `0426-0001`.

Generation strategy (recommended):
- Keep a small counter document keyed by `MMYY` in a server-side store (e.g., Firestore, SQL table or other DB). The counter holds the last used integer for that month-year.
- When confirming a payment, run an atomic increment (transaction) against the counter document for the current `MMYY`. Use the returned incremented value to build the final receipt number.

Why an atomic counter?
- Prevents race conditions (two concurrent payments getting the same serial) and ensures strictly increasing numbers per month.

Fallbacks and alternatives:
- If you cannot use transactions, create the receipt document with a server timestamp and rely on a Cloud Function to generate a final, authoritative receipt number (server-side) and update the created receipt. This avoids client-side collisions.

Example pseudo-code (Firestore transaction):
```
const key = formatMMYY(new Date()); // e.g. "0426"
const counterRef = firestore.doc(`receiptCounters/${key}`);

await firestore.runTransaction(async (tx) => {
  const snap = await tx.get(counterRef);
  const next = (snap.exists ? snap.data().last || 0 : 0) + 1;
  tx.set(counterRef, { last: next }, { merge: true });
  const receiptNumber = `${key}-${String(next).padStart(4,'0')}`; // 0426-0001
  // create receipt document using `receiptNumber` and payment data
  tx.set(firestore.doc(`receipts/${receiptId}`), { receiptNumber, ...paymentData });
});
```

**Modal Preview UI**
- Workflow:
  - After a user confirms payment data, prepare a `receiptData` object with all fields (name, date, course, year level, description, amount, mode, and receipt number).
  - Open a modal that renders both copies (side-by-side or stacked depending on screen/print layout). Show the `CCS Copy` label and the `Student Copy` label clearly.
  - Provide actions: `Print`, `Download (optional)`, `Close`.
  - Allow a final confirmation (if receipt number is generated client-side) or show the server-assigned number (if the server produced it).

UI details and accessibility:
- The modal content should be a simple, semantic DOM tree with stable IDs or class hooks for screenshot capture (e.g., container `#receipt-preview`).
- Use localizable strings for labels and provide clear keyboard focus handling for accessibility.

**Printing using html2canvas**
Recommended pattern:
1. Render the receipt preview modal and ensure all fonts and images are loaded.
2. Use `html2canvas` to capture the modal DOM element into a canvas at high scale for print-quality output.
3. Convert canvas to `dataURL` (PNG) or to a `Blob`, then open a new window or create an `iframe` with a minimal printable HTML containing the image and appropriate print CSS.
4. Call `window.print()` on the printable window and close it after printing (optionally).

Example implementation snippet:
```
import html2canvas from 'html2canvas';

async function printReceipt(containerElement) {
  // increase scale for better print resolution
  const canvas = await html2canvas(containerElement, { scale: 2, useCORS: true });
  const dataUrl = canvas.toDataURL('image/png');

  // Open new window with the image and print
  const w = window.open('', '_blank');
  w.document.write(`
    <html>
      <head>
        <title>Receipt</title>
        <style>
          @media print { img { width: 100%; height: auto; } body { margin: 0; } }
          body { margin: 0; padding: 8mm; }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" style="width:100%;height:auto;" />
        <script>window.onload = () => { setTimeout(() => { window.print(); }, 200); };</script>
      </body>
    </html>
  `);
}
```

Notes on html2canvas options:
- Use `scale: 2` (or higher) to improve DPI of printed output; adjust depending on quality and file size.
- Use `useCORS: true` if you load fonts or images from other origins (ensure appropriate CORS headers).
- Ensure web fonts are loaded (await `document.fonts.ready`) before calling `html2canvas` to avoid fallback fonts in the image.

CSS / Print styling tips:
- Create a print stylesheet (`@media print`) to remove modal backdrop, hide UI chrome (buttons, overlays), and ensure both copies fit on the printed page.
- Use `page-break-inside: avoid;` and `break-inside: avoid;` to keep each copy together.
- If you want two physical copies on a single printed page, style the modal to place both logical copies side-by-side within the same container sized for a printable page (A4 / Letter).

Edge cases and concurrency
- If you expect high concurrent payments, prefer server-side numbering (Cloud Function or server) with an atomic increment in a transactional DB to guarantee uniqueness.
- Keep a fallback path: if receipt number generation fails, mark the receipt as `pending-number` and reorder/assign numbers later with an admin reconciliation job.

Security and audit
- Store the full receipt and payment record server-side (with timestamps, user IDs for the cashier) for auditability. The printed copy should be a printable representation only; the authoritative data lives in the DB.

Summary
- The system generates a clear `MMYY-0000` receipt number using an atomic counter per month-year, displays a two-copy modal preview, and prints via `html2canvas` at a high scale for quality.
- Use server-side transactions for robust numbering and keep a server-stored receipt document as the source of truth.

If you want, I can add example React components and a Firestore Cloud Function implementation for the counter next.
