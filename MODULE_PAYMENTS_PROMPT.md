# Module Payments, Reports, and Cutback Prompt

Use this prompt when asking an AI to study and extend the current payables system.

---

## Prompt

Read the existing implementation first, especially the current payables flow, module management, receipts, and any related report screens. Study how the other modules were implemented before making changes, then follow the same patterns and structure in the codebase.

I need help improving and extending the **module payments** part of the system, including **reports**, **professor cutback reports**, and the overall workflow.

### Main goal

Build a module payment flow that is similar to the current professor/module share setup, but with this difference:

- For the **department share**, include the **full modules handled by CCS**.
- The **money amount should be adjustable**, not fixed.
- The system should support **module payments**, **department share**, **professor cutback**, and related **reports** in a clean and consistent way.

### What to inspect first

Before coding, inspect how these are already implemented:

- existing payables and module management screens
- receipt creation and printing flow
- report generation patterns in the app
- how faculty, modules, and department-related data are stored
- how other feature areas in the system were structured so the new work matches them

### What to implement

1. Module payments tracking
2. Department share handling for CCS modules
3. Adjustable money / amount configuration
4. Professor cutback computation and reporting
5. Reports for module payments and cutbacks
6. Any supporting UI, model, or database changes needed to make the flow work end to end

### Requirements

- Keep the implementation consistent with the current code style and architecture.
- Reuse existing utilities and patterns where possible.
- Do not break current payables behavior.
- Make the new functions easy to maintain and extend.
- If something is unclear, infer the intended behavior from the existing code before adding a new pattern.

### Expected output from the AI

Return:

- a short summary of the current implementation pattern
- the files that need to change
- the new functions or data fields needed
- the actual code changes
- any notes about how the new module payment and cutback flow works

### Extra note

The department share should be based on the **entire CCS module set**, and the amount should be **editable** so it can be adjusted later if needed.
