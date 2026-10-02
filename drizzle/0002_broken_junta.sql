ALTER TABLE `memos` ADD `source_memo_id` text REFERENCES memos(id) ON DELETE SET NULL;
