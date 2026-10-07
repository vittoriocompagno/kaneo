-- Subprojects (one level), manual project status. Idempotent so it is safe to
-- re-run against a database that already has any of these objects.
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "parent_project_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'in_corso' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_parent_project_id_project_id_fk') THEN
    ALTER TABLE "project" ADD CONSTRAINT "project_parent_project_id_project_id_fk" FOREIGN KEY ("parent_project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_parent_project_id_idx" ON "project" USING btree ("parent_project_id") WHERE "project"."parent_project_id" is not null;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_parent_not_self_check') THEN
    ALTER TABLE "project" ADD CONSTRAINT "project_parent_not_self_check" CHECK ("project"."parent_project_id" is null or "project"."parent_project_id" <> "project"."id");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_status_check') THEN
    ALTER TABLE "project" ADD CONSTRAINT "project_status_check" CHECK ("project"."status" in ('in_corso', 'in_attesa_cliente', 'in_pausa', 'chiuso'));
  END IF;
END $$;
