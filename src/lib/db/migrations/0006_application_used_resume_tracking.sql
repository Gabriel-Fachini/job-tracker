ALTER TABLE `applications`
ADD COLUMN `used_resume_status` text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE `applications`
ADD COLUMN `used_resume_path` text;
--> statement-breakpoint
ALTER TABLE `applications`
ADD COLUMN `used_resume_original_filename` text;
