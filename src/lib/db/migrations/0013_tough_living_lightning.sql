PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_job_leads` (
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
	`user_decision` text DEFAULT 'none' NOT NULL,
	`user_decision_at` integer,
	`promoted_to_application_id` integer,
	`discovered_at` integer NOT NULL,
	`last_viewed` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`promoted_to_application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_job_leads`("id", "company_id", "title", "source_url", "source_name", "description", "work_model", "seniority", "location_text", "salary_text", "classification_status", "classification_score", "classification_reason", "user_decision", "user_decision_at", "promoted_to_application_id", "discovered_at", "last_viewed", "updated_at") SELECT "id", "company_id", "title", "source_url", "source_name", "description", "work_model", "seniority", "location_text", "salary_text", "classification_status", "classification_score", "classification_reason", "user_decision", "user_decision_at", "promoted_to_application_id", "discovered_at", "last_viewed", "updated_at" FROM `job_leads`;--> statement-breakpoint
DROP TABLE `job_leads`;--> statement-breakpoint
ALTER TABLE `__new_job_leads` RENAME TO `job_leads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `job_leads_company_source_url_unique` ON `job_leads` (`company_id`,`source_url`);