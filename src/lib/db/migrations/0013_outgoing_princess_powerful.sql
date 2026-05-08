ALTER TABLE `applications` ADD `generated_resume_path` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `ats_provider` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `ats_board_token` text;