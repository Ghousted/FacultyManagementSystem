# Receipt Printing Customization (Feature 1)

## Objective
Implement a receipt printing feature that allows users to customize:
- Paper size (`A4`, `Letter`, or `Custom`)
- Print margins (`top`, `right`, `bottom`, `left`)

Users must be able to preview and print receipts using these settings before final print output.

## Scope
- Add print settings controls to the receipt preview modal.
- Apply selected print settings to the print stylesheet at runtime.
- Support predefined page sizes and custom width/height.
- Validate values and prevent invalid print configurations.
- Keep existing receipt rendering logic intact.

## UI Requirements

### 1. Print Settings Panel (inside `ReceiptModal`)
Add a settings section above the preview with:
- `Paper Size` select:
	- `A4`
	- `Letter`
	- `Custom`
- If `Custom` is selected:
	- `Width` input (number)
	- `Height` input (number)
	- Unit label (`in` for now)
- Margin inputs (number fields):
	- `Top`
	- `Right`
	- `Bottom`
	- `Left`

### 2. Defaults
- Default paper size: `A4`
- Default margins (inches):
	- Top: `0.22`
	- Right: `0.22`
	- Bottom: `0.22`
	- Left: `0.22`

### 3. Validation Rules
- Width/height (custom mode):
	- Must be `> 0`
	- Recommended min `3`, max `14` inches
- Margins:
	- Must be `>= 0`
	- Recommended max `2` inches each
- Disable print action when values are invalid.
- Show concise inline helper text for invalid fields.

## Behavior Requirements

### 1. Runtime Print CSS
Generate print CSS based on current settings and inject into the modal style block.

`@page` should be generated as:
- Predefined:
	- `size: A4 portrait;` or `size: Letter portrait;`
- Custom:
	- `size: {width}in {height}in;`

Margins:
- `margin: {top}in {right}in {bottom}in {left}in;`

### 2. Print Action
- When user clicks `Print`, use the selected settings immediately.
- Keep existing image/font-ready logic before calling `window.print()`.

### 3. Optional Persistence (recommended)
Persist user print settings using `localStorage`:
- Key example: `receiptPrintSettings`
- Load on modal open
- Save on setting change

## Suggested State Model (`ReceiptModal.jsx`)

```jsx
const [printSettings, setPrintSettings] = useState({
	paperSize: 'A4', // 'A4' | 'Letter' | 'Custom'
	customWidth: 5.83,
	customHeight: 8.27,
	margins: {
		top: 0.22,
		right: 0.22,
		bottom: 0.22,
		left: 0.22,
	},
});
```

## Print Style Integration Notes
- Replace hardcoded `@page` values with dynamic values from state.
- Keep existing receipt layout styles unless they conflict with custom paper dimensions.
- Ensure preview container width scales safely for all selected page sizes.

## Acceptance Criteria
1. User can choose `A4`, `Letter`, or `Custom` page size before printing.
2. User can set all four margins before printing.
3. Print output reflects selected size and margins in the final print dialog output.
4. Invalid settings prevent print and display user-friendly guidance.
5. Existing receipt content (2 copies, formatting, payment data) remains unchanged.

## Implementation Checklist
- [ ] Add print settings state in `ReceiptModal.jsx`
- [ ] Add print settings UI controls in modal header/body
- [ ] Add validation logic for page size and margins
- [ ] Generate dynamic `@page` CSS from settings
- [ ] Keep existing print preparation logic (fonts/images) before print
- [ ] (Optional) Persist settings in local storage
- [ ] Manually test A4, Letter, and 2 custom sizes

## Manual Test Cases
1. Select `A4`, set margins `0.22`, print preview should remain well aligned.
2. Select `Letter`, margins `0.5/0.5/0.5/0.5`, output should shift inward consistently.
3. Select `Custom` `6 x 9` inches with `0.25` margins, content should still render and print.
4. Enter negative margin or zero custom width, print button should be disabled.
5. Close and reopen modal, previously saved settings should load (if persistence enabled).
