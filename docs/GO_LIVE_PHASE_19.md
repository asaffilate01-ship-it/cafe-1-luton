# Phase 19: catalogue quality and menu discovery

Phase 19 removes defects observed on the live customer menu without rewriting
published migrations or deleting rows referenced by historic orders. It also
makes menu search more forgiving and fixes singular count wording.

## Changes in this phase

1. A forward-only migration merges the live legacy category labels **Cold Past
   Pot**, **Small Naan Rolls**, **Chicken Nuggets**, **Iced Matche Latte** and
   **Omlettes** into their canonical August 2026 categories.
2. Known item aliases and spelling errors are deactivated when the canonical
   seeded item exists. This includes the duplicate Desi breakfast descriptions,
   omelette misspellings, `Garlic mayoM` and `Iced Matche Latte`.
3. Exact active duplicates, including the repeated burger cards observed live,
   are resolved deterministically. Rows are deactivated rather than deleted so
   existing order, recipe and reporting references remain valid.
4. Partial unique indexes prevent a future import or administration action from
   creating duplicate active category or item names at the same site.
5. The pgTAP catalogue contract now checks ten controls, including canonical
   labels and the absence of active legacy aliases.
6. Customer search ignores accents and punctuation, supports multi-word matches
   across item descriptions and category names, and announces the result count.
7. Customer-facing labels now say **1 item** and **1 add-on**, not **1 items** or
   **1 add-ons**.

## Deployment check

Apply the migration in sequence through the existing Supabase deployment
workflow. After production deployment, run the database job and verify the
public menu once using a private browser session. Do not manually delete old
menu rows: inactive rows are deliberately retained for audit and order history.
