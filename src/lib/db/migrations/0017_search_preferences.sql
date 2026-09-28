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
