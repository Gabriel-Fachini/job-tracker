PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company` text,
	`title` text NOT NULL,
	`seniority` text,
	`work_model` text,
	`salary_min` integer,
	`salary_max` integer,
	`source_name` text,
	`source_url` text,
	`description` text,
	`status` text DEFAULT 'interesting' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_jobs` (
	`id`,
	`company`,
	`title`,
	`seniority`,
	`work_model`,
	`salary_min`,
	`salary_max`,
	`source_name`,
	`source_url`,
	`description`,
	`status`,
	`created_at`
)
SELECT
	`id`,
	NULL,
	`title`,
	`seniority`,
	`work_model`,
	`salary_min`,
	`salary_max`,
	`source_name`,
	`source_url`,
	`description`,
	`status`,
	`created_at`
FROM `jobs`;
--> statement-breakpoint
DROP TABLE `jobs`;
--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
