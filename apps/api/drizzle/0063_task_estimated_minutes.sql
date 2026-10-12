-- Optional per-task estimate in whole minutes. Idempotent so it is safe to re-run.
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "estimated_minutes" integer;
