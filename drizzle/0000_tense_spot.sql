CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `labels_user_id_idx` ON `labels` (`user_id`);--> statement-breakpoint
CREATE TABLE `memo_labels` (
	`memo_id` text NOT NULL,
	`label_id` text NOT NULL,
	PRIMARY KEY(`memo_id`, `label_id`),
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memo_labels_label_id_idx` ON `memo_labels` (`label_id`);--> statement-breakpoint
CREATE TABLE `memos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `memos_user_id_idx` ON `memos` (`user_id`);