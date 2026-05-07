ALTER TABLE `job_leads` ADD `user_decision` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `user_decision_at` integer;