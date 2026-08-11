-- 0001_add_target_allocation.sql
-- Adds the optional user-editable target asset allocation for the Portfolio
-- Risk dashboard (docs/06 §6.5, source §3.7). Stored as a JSON string mapping
-- risk bucket -> weight (fractions summing to 1), e.g.
-- {"EQUITY":0.6,"DEBT":0.3,"GOLD":0.05,"CASH":0.05}. NULL means "no explicit
-- target" (the risk panel falls back to the current allocation).

ALTER TABLE plan_assumptions ADD COLUMN target_allocation_json TEXT;
