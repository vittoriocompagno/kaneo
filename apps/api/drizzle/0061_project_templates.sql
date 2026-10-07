-- Talia fork: production already has this column from the pre-v2.35 fork migration
-- 0051_abandoned_electro, so the statement must be a no-op there.
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "is_template" boolean DEFAULT false NOT NULL;
