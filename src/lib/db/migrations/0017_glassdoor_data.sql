CREATE TABLE `glassdoor_interviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`glassdoor_interview_id` integer NOT NULL,
	`date` text,
	`job_title` text,
	`difficulty` text,
	`experience` text,
	`outcome` text,
	`duration_days` integer,
	`process` text,
	`questions_json` text,
	`first_seen_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `glassdoor_interviews_glassdoor_interview_id_unique` ON `glassdoor_interviews` (`glassdoor_interview_id`);--> statement-breakpoint
CREATE TABLE `glassdoor_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`glassdoor_review_id` integer NOT NULL,
	`date` text,
	`job_title` text,
	`rating` integer,
	`summary` text,
	`pros` text,
	`cons` text,
	`advice` text,
	`is_current` integer,
	`years_employed` integer,
	`extra_json` text,
	`first_seen_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `glassdoor_reviews_glassdoor_review_id_unique` ON `glassdoor_reviews` (`glassdoor_review_id`);--> statement-breakpoint
CREATE TABLE `glassdoor_salaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`job_title` text NOT NULL,
	`salary_count` integer,
	`base_p10` real,
	`base_p25` real,
	`base_p50` real,
	`base_p75` real,
	`base_p90` real,
	`total_p10` real,
	`total_p25` real,
	`total_p50` real,
	`total_p75` real,
	`total_p90` real,
	`extra_json` text,
	FOREIGN KEY (`snapshot_id`) REFERENCES `glassdoor_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `glassdoor_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`glassdoor_id` integer NOT NULL,
	`collected_at` integer NOT NULL,
	`since` text,
	`overall` real,
	`culture_values` real,
	`work_life_balance` real,
	`compensation_benefits` real,
	`career_opportunities` real,
	`senior_management` real,
	`diversity_inclusion` real,
	`recommend_to_friend` real,
	`business_outlook` real,
	`ceo_approval` real,
	`review_count` integer,
	`interview_difficulty` real,
	`interview_positive` integer,
	`interview_neutral` integer,
	`interview_negative` integer,
	`interview_count` integer,
	`data_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `glassdoor_snapshots_company_collected_unique` ON `glassdoor_snapshots` (`company_id`,`collected_at`);--> statement-breakpoint
CREATE INDEX `glassdoor_snapshots_glassdoor_id_idx` ON `glassdoor_snapshots` (`glassdoor_id`);