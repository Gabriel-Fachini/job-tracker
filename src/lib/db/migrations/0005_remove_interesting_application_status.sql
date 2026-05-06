UPDATE `applications`
SET `status` = 'applied'
WHERE `status` = 'interesting';
--> statement-breakpoint
UPDATE `application_status_history`
SET `from_status` = 'applied'
WHERE `from_status` = 'interesting';
--> statement-breakpoint
UPDATE `application_status_history`
SET `to_status` = 'applied'
WHERE `to_status` = 'interesting';
