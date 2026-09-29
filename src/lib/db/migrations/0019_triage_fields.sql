ALTER TABLE `job_leads` ADD `eligibility` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `contract_types` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `salary_min_usd_annual` integer;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `salary_max_usd_annual` integer;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `discard_reason` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `user_discard_reason` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `triage_engine` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `triage_model` text;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `triage_confidence` real;--> statement-breakpoint
ALTER TABLE `job_leads` ADD `triage_details` text;