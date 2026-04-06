# Receipt Specification

This file describes how receipts are generated and printed from the Payables system.

## Receipt number format

- Format: `MMYY-XXXXX`
  - `MM` — two-digit month (01..12)
  - `YY` — two-digit year (e.g. 26 for 2026)
  - `XXXXX` — sequential number for that month-year, zero-padded to 5 digits (first payer = `00001`)
  - Example: `0426-00001` means April 2026, payer #1 for that month.

## Receipt content

Each receipt must include:
- Receipt number
- Copy label: `CCS Copy` or `Student Copy` (component renders both copies)
- Student name
- Date (full formatted)
- Course and year level
- A list of description(s) and price(s)
- Total amount
- Payment mode (cash, check, gcash, etc.)
- "Received by" line (blank for manual signature or typed name)

## Behavior

- When a payment is confirmed in the Payables workflow, generate a receipt number for the payment's date and sequence.
- The sequence for a month-year should be persisted in a backend (Firestore recommended) to prevent duplicates in multi-user setups. The component includes a localStorage fallback for local testing and single-user usage.
- The UI shows a modal with the receipt preview (both copies). The user can adjust UI settings as needed and click `Print` to render the receipt via `html2canvas` and open the print dialog.

## Integration notes

- Install dependency: `html2canvas`

```bash
npm install html2canvas
```

- Add the `Receipt.jsx` component to `src/components/payables-system` and import it into `PayablesSystem.jsx`.
- Trigger the receipt modal after confirming payments (call the component with `receiptData` including `items`, `student`, `date`, and optional `sequence` if you compute it server-side).

## Minimal receiptData shape

```js
{
  date: new Date(),
  student: { id, name, course, yearLevel },
  items: [ { description: 'Tuition Fee', amount: 1500.00 }, ... ],
  paymentMode: 'cash',
  sequence: 1 // optional if server provides sequence
}
```

## Example usage (in PayablesSystem)

1. After finalizing a payment, request the next sequence number from backend for the payment month-year.
2. Pass `receiptData` to `<Receipt />` and set `open` to `true`.
3. Use the `Print` button in the modal to generate the printable receipt (uses `html2canvas`).

## Notes

- Server-side sequence persistence is recommended for concurrent users. If you want, I can add an example Firestore-backed sequence allocator and wire the receipt generation into `PayablesSystem.jsx`.
