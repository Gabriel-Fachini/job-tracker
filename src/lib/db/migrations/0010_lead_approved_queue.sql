-- No schema change required: `job_leads.user_decision` is stored as text.
-- This migration documents the new app-level contract that now accepts
-- `approved` as an intermediate manual triage state before promotion.
SELECT 1;
