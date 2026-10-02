export * from "./auth-schema";
import { type AnySQLiteColumn, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// userId stores the Better Auth user ID. Application-table foreign keys are deferred.
// Timestamps are ISO 8601 UTC strings supplied by the application on insert/update.
export const memos = sqliteTable("memos", {
	id: text("id").primaryKey().notNull(),
	userId: text("user_id").notNull(),
	title: text("title").notNull(),
	content: text("content").notNull(),
	sourceMemoId: text("source_memo_id").references((): AnySQLiteColumn => memos.id, { onDelete: "set null" }),
	orderIndex: integer("order_index").notNull().default(0),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
}, (table) => [index("memos_user_id_idx").on(table.userId)]);

export const labels = sqliteTable("labels", {
	id: text("id").primaryKey().notNull(),
	userId: text("user_id").notNull(),
	name: text("name").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
}, (table) => [index("labels_user_id_idx").on(table.userId)]);

export const memoLabels = sqliteTable("memo_labels", {
	memoId: text("memo_id").notNull().references(() => memos.id, { onDelete: "cascade" }),
	labelId: text("label_id").notNull().references(() => labels.id, { onDelete: "cascade" }),
}, (table) => [
	primaryKey({ columns: [table.memoId, table.labelId] }),
	index("memo_labels_label_id_idx").on(table.labelId),
]);
