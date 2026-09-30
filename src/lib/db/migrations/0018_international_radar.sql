CREATE TABLE `application_kits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`apply_url` text,
	`resume_path` text,
	`cover_letter` text,
	`form_fields` text,
	`answers` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_kits_application_id_unique` ON `application_kits` (`application_id`);--> statement-breakpoint
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
CREATE TABLE `search_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`min_monthly_usd` integer,
	`min_annual_usd` integer,
	`accepted_contracts` text,
	`accepted_eligibility` text,
	`timezone` text,
	`max_utc_offset_distance_hours` integer,
	`target_seniorities` text,
	`target_job_families` text,
	`title_include_keywords` text,
	`title_exclude_keywords` text,
	`default_answers` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `origin` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `source_kind` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `apply_url` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `dedup_key` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `eligibility` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `contract_types` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `salary_min_usd_annual` integer;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `salary_max_usd_annual` integer;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `discard_reason` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `user_discard_reason` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `triage_engine` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `triage_model` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `triage_confidence` real;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `triage_details` text;--> statement-breakpoint
CREATE INDEX `job_leads_dedup_key_idx` ON `job_leads` (`dedup_key`);