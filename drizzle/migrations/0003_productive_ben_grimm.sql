CREATE TABLE `upcoming_movies` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`image_url` text NOT NULL,
	`source` text NOT NULL,
	`actress` text NOT NULL,
	`release_date` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `movies` ADD `actress` text;