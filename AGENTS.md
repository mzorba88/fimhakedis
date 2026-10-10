# AGENTS.md

- Stored contract/hakediş amounts are always VAT-exclusive; the entered price and its basis live alongside (`enteredUnitPrice`, `priceBasis`). Why: one consistent base for all totals.
- A contract's value counts in "agreed value"/"remaining contract" only when `countsInContractTotal` (src/utils/agreements.ts) is true. Why: unit-price agreements with missing quantities must not look like definitive totals.
- Agreement line items and payment-plan stages use persistent `wie_<uuid>` / `pi_<uuid>` ids inside the contract JSON. Why: future hakediş links must survive edits.
- Hakediş items copy the unit price at creation (`snapshotItemForHakedis`); never recompute approved hakedişler from contract prices. Why: past prices are immutable.
- Schema drafts awaiting approval live in `docs/`, never in `supabase/migrations`. Why: production system; migrations need explicit user approval.
- New DB columns are read defensively and written only when their flag in `src/config/schemaFeatures.ts` is on (via `schema3b*Fields`; undefined = leave untouched, null = explicitly unknown). Why: features are enabled stage by stage with user approval.
- Legacy contract form saves go through `reconcileLegacyEdit`: non-pricing edits never touch price_basis/value_status; pricing edits require an explicit basis choice. Why: no silent loss between the two contract screens.
- Cost-screen value buckets (`contractValueBreakdown`) are display-only and never feed cari/hakediş/payment totals. Why: estimated values must stay visible without altering balances.
- Götürü plan links live in `hakedisler.plan_links`; validate with `validatePlanLinks`, revize hakedişler release their share. Why: prevents duplicate accrual of a payment stage.
