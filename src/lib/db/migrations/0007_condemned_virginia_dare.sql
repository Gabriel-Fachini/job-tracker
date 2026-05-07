CREATE TABLE `job_leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`title` text NOT NULL,
	`source_url` text NOT NULL,
	`source_name` text DEFAULT 'company_site' NOT NULL,
	`description` text,
	`work_model` text,
	`seniority` text,
	`location_text` text,
	`salary_text` text,
	`classification_status` text DEFAULT 'review' NOT NULL,
	`classification_score` integer,
	`classification_reason` text,
	`promoted_to_application_id` integer,
	`discovered_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`promoted_to_application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_leads_company_source_url_unique` ON `job_leads` (`company_id`,`source_url`);--> statement-breakpoint
