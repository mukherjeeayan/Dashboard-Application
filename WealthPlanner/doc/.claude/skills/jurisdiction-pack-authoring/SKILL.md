---
name: jurisdiction-pack-authoring
description: Use this skill when creating a new Jurisdiction Pack (e.g. authoring US-2025.json or UK-2025.json) or updating an existing one for a new tax year. Ensures every pack is complete, schema-valid, and requires zero changes to packages/engine.
---

# Jurisdiction Pack Authoring

## When to use this skill

Creating a brand-new country pack, or revising an existing pack for a new
tax year (e.g. `IN-2025.json` → `IN-2026.json`).

## Procedure — new pack

1. **Copy `packages/jurisdictions/packs/GENERIC-TEMPLATE.json`** as your
   starting point. Do not start from a blank file — the template's inline
   comments map every field to what it means and what source-doc section
   the India pack's equivalent field came from.

2. **Work through the seven `InstrumentType`s** (`docs/04-domain-model.md`
   §4.2) one at a time. For each type that has a real local equivalent in
   this country:
   - Give it a `displayLabel` in the local common name (e.g. "Traditional
     IRA" for `GOV_SAFE_LOCKED` in a US pack).
   - Fill in every rule field the schema requires for that instrument
     type's contribution/ROI/liquidity/tax-treatment shape.
   - If the country has **no** local equivalent for a given
     `InstrumentType`, omit that block entirely — don't fabricate a
     placeholder.

3. **Fill in `incomeTax` and `capitalGains`.** Check
   `docs/05-jurisdiction-tax-framework.md` §5.5's table of supported tax
   shapes first. If this country's tax system matches one of the existing
   `kind` discriminants, use it directly. If it genuinely doesn't fit any
   existing shape, this is a schema-extension task — see
   `docs/05-` §5.5's closing note; do not force an ill-fitting shape into
   an existing `kind` just to avoid touching the schema.

4. **Fill in `withdrawalWaterfall`.** Think about this country's natural
   tax-efficient draw order — it will often differ from India's
   Bank/FD → MF → PPF → NPS order. This is exactly the field that's meant
   to vary per country (`docs/05-` §5.4) — there's no "default" order to
   fall back on; reason about it explicitly for this jurisdiction.

5. **Fill in `statutoryConstants`, `fiscalYear`, `currency`, `locale`.**

6. **Validate:** run `npm run jurisdiction:validate -- <packId>`. Fix every
   error before proceeding — do not hand-wave past a validation failure.

7. **Golden-value fixtures (if available for this country):** if
   real-world worked examples exist for this jurisdiction (analogous to
   the India pack's use of the source Excel workbook's own examples),
   write golden-value tests the same way as described in the
   `formula-porting` skill, using this pack instead of `IN-2025`.

8. **Prove zero engine changes were needed.** After authoring, run `git
   diff --stat packages/engine` — it should be empty. If it isn't, that's
   a signal the engine wasn't actually jurisdiction-agnostic somewhere,
   and the correct fix is in `packages/engine` (delegate to the Financial
   Engine Builder agent), not a workaround in the pack file.

## Procedure — new tax year for an existing pack

1. Copy the prior year's pack file to the new `packId` (e.g.
   `IN-2025.json` → `IN-2026.json`).
2. Update **only** the fields that actually changed for the new tax year
   (a government rate revision, a new bracket, an updated cap) — leave
   everything else untouched, to keep the diff reviewable.
3. Write a changelog entry (in a `CHANGELOG.md` alongside the pack, or in
   the pack's own `_changeNotes` field if the schema supports it) stating
   exactly what changed and citing a source for the new figure.
4. Re-run validation and the full golden-value/regression protocol
   described in `docs/12-testing-strategy.md` §12.8 before this becomes
   the default pack for new plans.
5. Confirm existing plans continue referencing their originally-selected
   pack version (per `docs/05-` §5.6 point 6) — a new pack version must
   never silently change the numbers behind an already-created plan.
