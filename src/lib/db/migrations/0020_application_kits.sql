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
CREATE UNIQUE INDEX `application_kits_application_id_unique` ON `application_kits` (`application_id`);