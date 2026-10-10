# AGENTS.md

- Stored contract/hakediş amounts are always VAT-exclusive; the entered price and its basis live alongside (`enteredUnitPrice`, `priceBasis`). Why: one consistent base for all totals.
- A contract's value counts in "agreed value"/"remaining contract" only when `countsInContractTotal` (src/utils/agreements.ts) is true. Why: unit-price agreements with missing quantities must not look like definitive totals.
- Agreement line items and payment-plan stages use persistent `wie_<uuid>` / `pi_<uuid>` ids inside the contract JSON. Why: future hakediş links must survive edits.
- Hakediş items copy the unit price at creation (`snapshotItemForHakedis`); never recompute approved hakedişler from contract prices. Why: past prices are immutable.
- Schema drafts awaiting approval live in `docs/`, never in `supabase/migrations`. Why: production system; migrations need explicit user approval.
