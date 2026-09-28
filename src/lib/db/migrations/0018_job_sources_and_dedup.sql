CREATE TABLE `job_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`config` text,
	`enabled` integer DEFAULT true NOT NULL,
	`last_run_at` integer,
	`last_cursor` text,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `origin` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `source_kind` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `apply_url` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `dedup_key` text;--> statement-breakpoint
CREATE INDEX `job_leads_dedup_key_idx` ON `job_leads` (`dedup_key`);